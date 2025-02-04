# Jaike

An AI-powered application that generates short-form content based on lectures. Built for students, by students. A CS 194W project.

## Important Links

- [Team Milestones](https://github.com/StanfordCS194/win25-Team34/milestones)
- [Course Syllabus (accurate assignment deadlines and schedule)](https://docs.google.com/spreadsheets/d/1Y5Lcy-f3GsL_aUVHTDTYkmbaJQqK7sEhrNU9xM57UpQ/edit?usp=sharing)
- [Wiki Link](https://github.com/StanfordCS194/win25-Team34/wiki)

## Getting Started

1. Clone repo

```bash
git clone https://github.com/StanfordCS194/win25-Team34.git
cd win25-Team34
```

2. Create/activate virtual env

```bash
python -m venv venv
source venv/bin/activate
```

3. Install dependencies

```bash
pip install -r requirements.txt
```

4. Create a .env file in root directory and add

```bash
pip install -r requirements.txt
```

5. Run Flask server

```bash
python src/transcriber.py
```

6. Use curl command in separate terminal

```bash
curl -X POST -H "Content-Type: application/json" -d '{"video_path": "[VIDEO_FILE_PATH].mp4"}' http://localhost:[PORT]/generate_videos
```

## Source Control Task

Andrew C

Ryan C

Aaron J

Ryan S
