import json
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from moviepy import (
    VideoFileClip,
)
from moviepy.video.io.ffmpeg_tools import (
    ffmpeg_escape_filename,
)
from moviepy.tools import subprocess_call
from openai import OpenAI

FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")

SYSTEM_PROMPT = """
 You are an AI assistant for the platform Jaike, an application that generates short-form content based on lecture videos. As part of Jaike you will take as input a transcript of the lecture's audio where the format is (sentence | seconds from start) separated by newlines.  The short-form videos must each be under 1 minute, so please only select segments that are less than 60 seconds long. You should therefore return as output only a dictionary with format (segment title): (start time, end_time), ensuring that the output is directly a json.
"""

app = Flask(__name__)


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

    response = client.audio.transcriptions.create(
        model="whisper-1",
        file=open(input_path, "rb"),
        response_format="verbose_json",
        timestamp_granularities=["segment"],
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
    if not output_path:
        name, ext = os.path.splitext(input_path)
        t1, t2 = [int(1000 * t) for t in [start_time, end_time]]
        output_path = "%sSUB%d_%d%s" % (name, t1, t2, ext)

    cmd = [
        FFMPEG_BINARY,
        "-ss",
        "%0.2f" % start_time,
        "-t",
        "%0.2f" % (end_time - start_time),
        "-i",
        ffmpeg_escape_filename(input_path),
        "-y",
        "-c",
        "copy",
        ffmpeg_escape_filename(output_path),
    ]
    if audio_only == True:
        cmd[-3] = "-map"
        cmd[-2] = "a"

    subprocess_call(cmd, logger=logger)


def create_segments(input_video, segments):

    temp_clips = []

    for segment_title, (start_time, end_time) in segments.items():
        temp_clip_name = f"{segment_title}.mp4"
        extract_subclip(input_video, start_time, end_time, temp_clip_name)
        temp_clips.append(temp_clip_name)


def generate_videos(video_path):

    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    clips = convert_video_to_audio(video_path)

    lines = []
    for idx, clip_file in enumerate(clips):
        print(clip_file)
        output = transcribe_audio_file(client, input_path=clip_file, file_idx=idx)
        lines += output

    save_txt("\n".join(lines), "test_video_transcript.txt")

    transcript = read_txt("test_video_transcript.txt")
    segments = select_segments(client, transcript)

    create_segments(video_path, segments)


@app.route("/generate_videos", methods=["POST"])
def generate_videos_endpoint():
    """
    Takes a JSON body with { "video_path": "<path>" }.
    Calls the generate_videos function using this path.
    """
    try:
        data = request.get_json()
        if not data or "video_path" not in data:
            return jsonify({"error": "Missing 'video_path' in request"}), 400

        video_path = data["video_path"]
        generate_videos(video_path)
        return jsonify({"message": "Videos generated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
