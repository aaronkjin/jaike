import os
import re
from datetime import datetime, timedelta
from moviepy import VideoFileClip
from openai import OpenAI


def convert_video_to_audio(video_path=None):
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
            print(start_time, end_time)
            clip = video_clip.subclipped(start_time, end_time).audio

            output_path = f"{video_path[:-4]}_{segment_number}.mp3"
            clips.append(output_path)
            clip.write_audiofile(output_path)

            # Update start_time and increment segment counter
            start_time += segment_duration
            segment_number += 1

        video_clip.close()

    except Exception as e:
        print(e)
        return None

    return clips


def transcribe_audio_file(client, input_path=None, file_idx=0):

    response = client.audio.transcriptions.create(
        model="whisper-1", file=open(input_path, "rb"), response_format="srt"
    )

    return process_transcription(response, file_idx)


def save_txt(txt, output_path):
    with open(output_path, "w") as file:
        file.write(txt)


def process_transcription(transcription, file_idx=0):
    blocks = transcription.split("\n\n")
    processed_lines = []
    for block in blocks:
        lines = block.split("\n")
        if len(lines) >= 3:
            time_range = lines[1]
            text = lines[2]
            start_time = time_range.split(" --> ")[0]
            dt = datetime.strptime(start_time, "%H:%M:%S,%f")
            dt += timedelta(minutes=(10 * file_idx))
            hour_str = str(dt.hour)  # '0', '1', '12', etc.
            minute_str = f"{dt.minute:02d}"
            second_str = f"{dt.second:02d}"
            formatted_start_time = f"{hour_str}:{minute_str}:{second_str}"

            processed_line = f"[{formatted_start_time}]{text}"
            processed_lines.append(processed_line)
    return processed_lines


clips = convert_video_to_audio(video_path="test_video.mp4")
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),  # This is the default and can be omitted
)

output = client.audio.transcriptions.create(
    model="whisper-1",
    file=open("test_video_6.mp3", "rb"),
    response_format="verbose_json",
    timestamp_granularities=["word"],
)
