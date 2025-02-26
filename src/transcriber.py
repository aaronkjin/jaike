import json
import os
import shutil
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
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



FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")

SYSTEM_PROMPT = """
 You are an AI assistant for the platform Jaike, an application that generates short-form content based on lecture videos. As part of Jaike you will take as input a transcript of the lecture's audio where the format is (sentence | seconds from start) separated by newlines.  The short-form videos must each be under 1 minute, so please only select segments that are less than 60 seconds long. You should therefore return as output only a dictionary with format (segment title): (start time, end_time), ensuring that the output is directly a json.
"""

app = Flask(__name__)

#needs a secret key to encrypt session cookies
app.secret_key = 'secret-flask-server-key'

# Update CORS and session configuration
CORS(app,
    origins="http://localhost:3000",
    supports_credentials=True,
    expose_headers=["Set-Cookie"],
    allow_headers=["Content-Type"]
)

# Configure session
app.config.update(
    SESSION_COOKIE_SECURE=False,  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_DOMAIN=None,  # Allow cookies to be set for localhost
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

S3_BUCKET = "videolecturefiles"
S3_REGION = "us-west-1"  # Example: "us-east-1"
s3_client = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id='AKIA2NK3YJBY5WPPYDMV',
    aws_secret_access_key='V+s48rRN8kqQQQBiDioAkvzMN4f2OtEpK6zLpCv2',
)

# Add these near the top of your file
oauth = OAuth(app)

# Configure Google OAuth with additional settings
oauth.register(
    name='google',
    client_id='528134535091-gbucq1bhg751snvk7187ml9roc76cimh.apps.googleusercontent.com',
    client_secret='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',
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
        video_clip = VideoFileClip(video_path)

        total_duration = int(video_clip.duration)
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

        video_clip.close()

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


def select_segments(client, transcript):
    """
    Prompt OpenAI to select multiple short segments from the transcript
    """
    response = client.chat.completions.create(
        model="gpt-4-turbo",  # Choose the model
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
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

    subprocess_call(cmd, logger=logger)


def create_segments(input_video, segments):

    temp_clips = []

    for segment_title, (start_time, end_time) in segments.items():
        temp_clip_name = f"{segment_title}.mp4"
        extract_subclip(input_video, start_time, end_time, f"tmpout/{temp_clip_name}")
        temp_clips.append(temp_clip_name)


def download_from_s3(video_folder, local_path):

    s3_key = f"{video_folder}/input/in.mp4"  # Dynamic path

    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    try:
        print('downloading from s3')
        s3_client.download_file(S3_BUCKET, s3_key, local_path)
        print(f"Downloaded from S3: {s3_key} to {local_path}")
        return local_path
    except Exception as e:
        print(f"Error downloading from S3: {e}")
        return None


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

def generate_videos(video_folder):

    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    local_video_path = f"tmp/{video_folder}.mp4"  # Temporary storage
    download_from_s3(video_folder, local_video_path)

    clips = convert_video_to_audio(local_video_path)

    lines = []
    for idx, clip_file in enumerate(clips):
        print(clip_file)
        output = transcribe_audio_file(client, input_path=clip_file, file_idx=idx)
        lines += output

    
    os.makedirs('tmpout', exist_ok=True)

    transcript_path = "tmpout/test_video_transcript.txt"

    save_txt("\n".join(lines), transcript_path)

    transcript = read_txt(transcript_path)
    segments = select_segments(client, transcript)

    create_segments(local_video_path, segments)

    upload_folder_to_s3("tmpout/", video_folder)

    for folder in ["tmp", "tmpout"]:
        if os.path.exists(folder):
            shutil.rmtree(folder) 
            print(f"Deleted {folder}/")


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

        generate_videos(video_folder)
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
        return jsonify({"videos": videos}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add these new routes
@app.route('/auth/google')
def google_auth():
    return oauth.google.authorize_redirect(
        redirect_uri='http://localhost:5001/auth/google/callback'
    )

@app.route('/auth/google/callback')
def google_auth_callback():
    try:
        token = oauth.google.authorize_access_token()
        userinfo = token.get('userinfo')
        if userinfo:
            session.permanent = True  # Make the session permanent
            session['user'] = userinfo
            print("Setting user in session:", userinfo)
            return redirect('http://localhost:3000/upload')
        return 'Failed to get user info', 400
    except Exception as e:
        print(f"Error in callback: {str(e)}")
        return str(e), 400

@app.route('/auth/user')
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
        response = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix=f"{user_email}/"
        )
        
        # Get unique folder names (excluding input/output subfolders)
        folders = set()
        for obj in response.get('Contents', []):
            path_parts = obj['Key'].split('/')
            if len(path_parts) > 2:  # user_email/folder_name/...
                folders.add(path_parts[1])
        
        return jsonify({"folders": list(folders)}), 200
    except Exception as e:
        print(f"Error fetching user videos: {e}")
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
