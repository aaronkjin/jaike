import json
import os
import shutil
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, redirect, session, make_response
from flask_cors import CORS, cross_origin
from moviepy import (
    VideoFileClip,
)
from moviepy.video.io.ffmpeg_tools import (
    ffmpeg_escape_filename,
)
from moviepy.tools import subprocess_call
from openai import OpenAI
import boto3
from authlib.integrations.flask_client import OAuth
import re
import time
import asyncio
from openai import AsyncOpenAI
import subprocess


FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")
FFPROBE_BINARY = os.getenv("FFPROBE_BINARY", "ffprobe")

SYSTEM_PROMPT = """
I want to identify {num_clips} key segments from lecture transcripts to create short-form summary videos.

Each segment must provide key components of the overarching lecture video while being brief and self-contained, with a maximum length of {max_length} seconds.

For each segment, return a JSON dictionary with the format (segment_title) : (start_time, end_time). The output should be only the JSON object with no additional explanations.

Be careful to ensure segments are no longer than {max_length} seconds, that timestamps are accurate, and that the output is valid JSON that can be parsed directly.

--

For context: I'm building Jaike, a platform that automatically generates short-form content from lecture videos. The input will be transcript data formatted as (sentence | seconds from start) separated by newlines. The platform needs exact start and end timestamps to clip the video appropriately. The segments should stand alone as educational content. The JSON output will be processed programmatically, so it must contain nothing but valid JSON syntax.
"""

app = Flask(__name__, static_folder=None)  # Disable Flask's default static file handling


# Use a strong, consistent secret key
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'secret_key')

FRONTEND_URL = os.environ.get('FRONTEND_URL', 
    'http://localhost:8000' 
)
BACKEND_URL = os.environ.get('BACKEND_URL',
    'http://localhost:8000' 
)

print("FRONTEND:", FRONTEND_URL)
print("BACKEND:", BACKEND_URL)

# Update CORS configuration
CORS(app,
    origins=[FRONTEND_URL],
    supports_credentials=True,
    expose_headers=["Set-Cookie", "Authorization"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    max_age=3600
)

# Update session configuration
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='None',  # Important for cross-site requests
)

# Update S3 configuration
S3_BUCKET = os.environ.get('S3_BUCKET')
S3_REGION = os.environ.get('S3_REGION')
s3_client = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_KEY'),
)

s3_accelerated = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_KEY'),
    config=boto3.session.Config(
        s3={'use_accelerate_endpoint': True},
        connect_timeout=60,
        read_timeout=120,
        retries={'max_attempts': 10, 'mode': 'adaptive'}
    )
)

# Add these near the top of your file
oauth = OAuth(app)

oauth.init_app(app)
# Update Google OAuth configuration
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'prompt': 'select_account'
    }
)


def save_txt(txt, output_path):
    with open(output_path, "w") as file:
        file.write(txt)


def read_txt(output_path):
    with open(output_path, "r") as file:
        return file.read()

def get_video_duration(video_path):
    """
    Get the duration of a video file using ffprobe
    """
    try:
        # Use ffprobe to get video duration
        cmd = [
            FFPROBE_BINARY, 
            '-v', 'error', 
            '-show_entries', 'format=duration', 
            '-of', 'json', 
            video_path
        ]
        
        print(f"Running ffprobe command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"ffprobe error: {result.stderr}")
            return 0
            
        data = json.loads(result.stdout)
        duration = float(data['format']['duration'])
        print(f"Video duration: {duration} seconds")
        return duration
    except Exception as e:
        print(f"Error getting video duration: {e}")
        # Return a default duration if ffprobe fails
        return 0

def convert_video_to_audio(video_path=None):
    """
    Takes a path to a video as input, splits the video into 10 minute segments
    and save the audio of each segment
    """

    if video_path is None:
        return None
    
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        return None
    
    clips = []

    try:
        # video_clip = VideoFileClip(video_path)

        # total_duration = int(video_clip.duration)
        total_duration = int(get_video_duration(video_path))
        start_time = 0
        segment_number = 1
        segment_duration = 600

        while start_time < total_duration:
            end_time = min(start_time + segment_duration, total_duration)

            output_path = f"{video_path[:-4]}_{segment_number}.mp3"
            clips.append(output_path)
            extract_subclip(
                video_path, start_time, end_time, output_path, audio_only=True
            )

            # Update start_time and increment segment counter
            start_time += segment_duration
            segment_number += 1

        # video_clip.close()

    except Exception as e:
        print(e)
        return None

    return clips


def transcribe_audio_file(client, input_path=None, file_idx=0):
    """
    Takes as input a path to an audio file and calls the OpenAI
    whisper api to transcribe the audio
    """

    if not os.path.exists(input_path):
        print(f"Error: Audio file {input_path} not found.")
        return []
    
    response = client.audio.transcriptions.create(
        model="whisper-1",
        file=open(input_path, "rb"),
        response_format="verbose_json",
        timestamp_granularities=["segment"],
        language="en"
    )

    return process_transcription(response, file_idx)


def process_transcription(transcription, file_idx=0):
    processed_segments = []
    for segment in transcription.segments:
        processed_segments.append(
            f"{segment.text} | {'{:.2f}'.format(segment.end + file_idx * 600)}"
        )
    return processed_segments


def select_segments(client, transcript, num_clips=5, max_length=60):
    """
    Prompt OpenAI to select multiple short segments from the transcript
    """

    formatted_prompt = SYSTEM_PROMPT.format(num_clips=num_clips, max_length=max_length)

    response = client.chat.completions.create(
        model="gpt-4-turbo",  # Choose the model
        messages=[
            {
                "role": "system",
                "content": formatted_prompt,
            },
            {"role": "user", "content": transcript},
        ],
        response_format={"type": "json_object"},
        temperature=0.01,
    )
    return json.loads(response.choices[0].message.content)


def extract_subclip(
    input_path, start_time, end_time, output_path=None, audio_only=False, logger="bar"
):
    """
    Takes as input a path to a video
    Saves video[start_time: end_time] as a new file
    """

    os.makedirs("tmpout", exist_ok=True) 

    if not output_path:
        name, ext = os.path.splitext(input_path)
        t1, t2 = [int(1000 * t) for t in [start_time, end_time]]
        output_path = "%sSUB%d_%d%s" % (name, t1, t2, ext)

    # Ensure input path exists
    if not os.path.exists(input_path):
        print(f"ERROR: Input file does not exist: {input_path}")
        return False

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        print(f"Created output directory: {output_dir}")

    # Construct the ffmpeg command
    cmd = [
        FFMPEG_BINARY,
        "-ss",
        "%0.2f" % start_time,
        "-i",
        ffmpeg_escape_filename(input_path),
        "-t",
        "%0.2f" % (end_time - start_time),
        "-y",
        "-c:v",
        "libx264",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-strict",
        "experimental",
        ffmpeg_escape_filename(output_path),
    ]
    if audio_only == True:
        cmd = [
            FFMPEG_BINARY,
            "-ss",
            "%0.2f" % start_time,
            "-t",
            "%0.2f" % (end_time - start_time),
            "-i",
            ffmpeg_escape_filename(input_path),
            "-y",
            "-map",
            "a",
            ffmpeg_escape_filename(output_path),
        ]

    # Print the command for debugging
    print(f"Running ffmpeg command: {' '.join(cmd)}")
    
    try:
        result = subprocess_call(cmd, logger=logger)
        print(f"ffmpeg result: {result}")
        return True
    except Exception as e:
        print(f"Error in ffmpeg command: {str(e)}")
        return False


def create_segments(input_video, segments):

    temp_clips = []

    for segment_title, (start_time, end_time) in segments.items():
        temp_clip_name = f"timestamp_{start_time:.2f}_{segment_title}.mp4"
        extract_subclip(input_video, start_time, end_time, f"tmpout/{temp_clip_name}")
        temp_clips.append(temp_clip_name)
    
    return temp_clips

def download_from_s3(video_folder, local_path):

    s3_key = f"{video_folder}/input/in.mp4"  # Dynamic path

    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    try:
        print('downloading from s3')
        s3_accelerated.download_file(S3_BUCKET, s3_key, local_path)
        print(f"Downloaded from S3: {s3_key} to {local_path}")
        return local_path
    except Exception as e:
        print(f"Error downloading from S3: {e}")
        return None

async def transcribe_audio_file_async(client, input_path=None, file_idx=0):
    """
    Async version of transcribe_audio_file that uses the AsyncOpenAI client
    """
    if not os.path.exists(input_path):
        print(f"Error: Audio file {input_path} not found.")
        return []
    
    with open(input_path, "rb") as audio_file:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
            language="en"
        )

    return process_transcription(response, file_idx)

async def transcribe_audio_files_async(audio_clips):

    client = AsyncOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    tasks = []
    
    for idx, clip_file in enumerate(audio_clips):
        print(f"Creating task for chunk {idx}: {clip_file}")
        task = asyncio.create_task(
            transcribe_audio_file_async(client, input_path=clip_file, file_idx=idx)
        )
        tasks.append(task)
    
    start_time = time.time()
    print(f"Starting async transcription of {len(tasks)} audio clips...")
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    elapsed = time.time() - start_time
    print(f"FINISHED ASYNC TRANSCRIPTION in {elapsed:.2f} seconds")
    
    all_lines = []
    
    for idx, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Error transcribing chunk {idx}: {str(result)}")
        else:
            all_lines.extend(result)

    all_lines.sort(key=lambda x: float(x.split(" | ")[-1]))
    
    return all_lines

def upload_folder_to_s3(local_folder, video_folder):

    uploaded_files = []

    for file_name in os.listdir(local_folder):
        local_file_path = os.path.join(local_folder, file_name)
        
        # Ensure we're only uploading files (not directories)
        if os.path.isfile(local_file_path):
            s3_key = f"{video_folder}/output/{file_name}"  # S3 Destination
            try:
                s3_client.upload_file(local_file_path, S3_BUCKET, s3_key)
                s3_url = f"https://{S3_BUCKET}.s3.{'us-west-1'}.amazonaws.com/{s3_key}"
                uploaded_files.append(s3_url)
                print(f"Uploaded {local_file_path} to {s3_url}")
            except Exception as e:
                print(f"Error uploading {local_file_path} to S3: {e}")

    return uploaded_files



def generate_videos(video_folder, num_clips=5, max_length=60):

    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    local_video_path = f"tmp/{video_folder}.mp4"  # Temporary storage
    download_from_s3(video_folder, local_video_path)

    print("FINISHED DOWNLOADING FROM S3")

    clips = convert_video_to_audio(local_video_path)

    print("FINISHED SPLITTING INTO CLIPS")

    lines = loop.run_until_complete(transcribe_audio_files_async(clips))

    
    print("FINISHED TRANSCRIPTION")
    
    os.makedirs('tmpout', exist_ok=True)

    transcript_path = "tmpout/test_video_transcript.txt"

    save_txt("\n".join(lines), transcript_path)

    transcript = read_txt(transcript_path)
    segments = select_segments(client, transcript, num_clips, max_length)

    print("OPEN AI FINISHED SELECTING CLIPS")
    print("SEGMENTS:", segments)

    create_segments(local_video_path, segments)

    upload_folder_to_s3("tmpout/", video_folder)

    for folder in ["tmp", "tmpout"]:
        if os.path.exists(folder):
            shutil.rmtree(folder) 
            print(f"Deleted {folder}/")
    
    loop.close()

@app.route("/generate_videos", methods=["POST"])
def generate_videos_endpoint():
    """
    Takes a JSON body with { "video_path": "<path>" }.
    Calls the generate_videos function using this path.
    """
    try:
        # Check if user is authenticated
        user = session.get('user')
        print(user)
        if not user:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.get_json()
        if not data or "video_folder" not in data:
            return jsonify({"error": "Missing 'video_folder' in request"}), 400

        video_folder = data["video_folder"]
        num_clips = data.get("num_clips", 5)  # Default to 5 if not provided
        length_of_clips = data.get("length_of_clips", 60)  # Default to 60 if not provided

        generate_videos(video_folder, num_clips, length_of_clips)
        return jsonify({"message": "Videos generated successfully"}), 200

    except Exception as e:
        print(f"Error processing videos: {str(e)}")
        return jsonify({"error": str(e)}), 500

def list_output_videos(video_folder):
    """List all videos in the output folder of a specific video folder"""
    try:
        # List objects in the specific output folder
        response = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix=f"{video_folder}/output/"
        )
        
        videos = []
        for obj in response.get('Contents', []):
            if obj['Key'].endswith('.mp4'):
                video_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{obj['Key']}"
                # Extract just the video name without the user's email path
                video_name = obj['Key'].split('/')[-1].replace('.mp4', '')
                videos.append({
                    "name": video_name,
                    "url": video_url
                })
        return videos
    except Exception as e:
        print(f"Error listing videos: {e}")
        return []

@app.route("/list_videos/<path:video_folder>", methods=["GET"])
def list_videos_endpoint(video_folder):
    """Endpoint to list all processed videos for a specific folder"""
    try:
        # Check if user is authenticated
        user = session.get('user')
        if not user:
            return jsonify({"error": "Not authenticated"}), 401

        videos = list_output_videos(video_folder)
        print(videos)
        return jsonify({"videos": videos}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add these new routes
@app.route('/auth/google')
@cross_origin(supports_credentials=True)
def google_auth():
    session.permanent = True
    state = os.urandom(16).hex()
    session['oauth_state'] = state
    
    # Use the backend URL for callback
    callback_url = f'{BACKEND_URL}/auth/google/callback'
    
    return oauth.google.authorize_redirect(
        redirect_uri=callback_url,
        state=state
    )

@app.route('/auth/google/callback')
@cross_origin(supports_credentials=True)
def google_auth_callback():
    try:
        token = oauth.google.authorize_access_token()
        userinfo = token.get('userinfo')
        if userinfo:
            session.permanent = True
            session['user'] = userinfo
            session.modified = True  # Ensure session is saved
            
            # Redirect to the frontend URL
            return redirect(f"{FRONTEND_URL.split(',')[0]}/upload")
        return 'Failed to get user info', 400
    except Exception as e:
        print(f"Error in callback: {str(e)}")
        return str(e), 400

@app.route('/auth/user')
@cross_origin(supports_credentials=True)
def get_user():
    print("Current session:", dict(session))
    user = session.get('user')
    print("Current user:", user)
    return jsonify(user)

@app.route('/auth/logout')
def logout():
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/user_videos', methods=['GET'])
def get_user_videos():
    try:
        user = session.get('user')
        if not user:
            return jsonify({"error": "Not authenticated"}), 401

        # Use Python's re module for regex
        user_email = re.sub(r'[^a-zA-Z0-9]', '_', user['email']).lower()
        
        # List all objects with user's email prefix
        response_user = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix=f"{user_email}/"
        )

        # List all objects with sample prefix
        response_sample = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix=f"sample/"
        )
        
        # Get unique folder names (excluding input/output subfolders)
        user_folders = set()
        for obj in response_user.get('Contents', []):
            path_parts = obj['Key'].split('/')
            if len(path_parts) > 2:  # user_email/folder_name/...
                user_folders.add(path_parts[1])
        
        sample_folders = set()
        for obj in response_sample.get('Contents', []):
            path_parts = obj['Key'].split('/')
            if len(path_parts) > 2:  # sample/folder_name/...
                sample_folders.add(path_parts[1])
        
        # Return both user folders and sample folders
        return jsonify({
            "user_folders": list(user_folders),
            "sample_folders": list(sample_folders)
        }), 200
    except Exception as e:
        print(f"Error fetching user videos: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/delete_video/<path:video_folder>', methods=['DELETE'])
def delete_video(video_folder):
    try:
        print(video_folder)
        user = session.get('user')
        if not user:
            return jsonify({"error": "Not authenticated"}), 401

        # Verify the video belongs to the user
        user_email = re.sub(r'[^a-zA-Z0-9]', '_', user['email']).lower()

        # List and delete all objects in the folder
        response = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix=f"{user_email}/{video_folder}/"
        )
        
        for obj in response.get('Contents', []):
            s3_client.delete_object(
                Bucket=S3_BUCKET,
                Key=obj['Key']
            )

        return jsonify({"message": "Video deleted successfully"}), 200
    except Exception as e:
        print(f"Error deleting video: {e}")
        return jsonify({"error": str(e)}), 500

@app.before_request
def debug_session():
    print("\n=== Request Info ===")
    print(f"Request URL: {request.url}")
    print(f"Request Headers: {dict(request.headers)}")
    print(f"Current Session: {dict(session)}")
    print(f"Cookies: {request.cookies}")

@app.after_request
def after_request(response):
    print("\n=== Response Info ===")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Set-Cookie Headers: {response.headers.getlist('Set-Cookie')}")
    print(f"Final Session: {dict(session)}")
    
    # Set CORS headers
    origin = request.headers.get('Origin')
    if origin and origin in [url.strip() for url in FRONTEND_URL.split(',')]:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
        response.headers['Access-Control-Expose-Headers'] = 'Set-Cookie, Authorization'
    
    return response

# Add OPTIONS handler for preflight requests
@app.route('/auth/user', methods=['OPTIONS'])
def auth_user_options():
    response = make_response()
    origin = request.headers.get('Origin')
    if origin and origin in [url.strip() for url in FRONTEND_URL.split(',')]:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
        response.headers['Access-Control-Expose-Headers'] = 'Set-Cookie, Authorization'
    return response


if __name__ == "__main__":
    app.run(
        debug=True, 
        host="0.0.0.0", 
        port=8000,
    )