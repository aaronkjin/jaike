# Use Node.js base image for building frontend
FROM node:18 AS frontend-build
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY frontend/video-processor/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY frontend/video-processor/ ./
# Load environment variables from .env file line by line
COPY .env ./
# Load variables from .env and set them as environment variables
RUN export $(cat .env | xargs) 

# Debug: Show directory contents
RUN echo "Contents of frontend directory:"
RUN ls -la

# Build the frontend
RUN npm run build || (echo "BUILD FAILED" && exit 1)

# Debug: List build directory contents
RUN echo "Contents of build directory:"
RUN ls -la build/ || echo "build directory not found"
RUN find . -name "build" -type d
RUN find . -path "*/build/*" -type f | head -20

# Use Python base image for the final image
FROM python:3.9-slim
WORKDIR /app

# Install system dependencies including a more recent version of ffmpeg
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    findutils \
    && rm -rf /var/lib/apt/lists/*

# Install a more recent version of ffmpeg and ffprobe
RUN wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xf ffmpeg-release-amd64-static.tar.xz && \
    find . -name "ffmpeg" -type f -executable -exec cp {} /usr/local/bin/ \; && \
    find . -name "ffprobe" -type f -executable -exec cp {} /usr/local/bin/ \; && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf ffmpeg-*

# Verify ffmpeg and ffprobe installation
RUN ffmpeg -version && ffprobe -version

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install gunicorn
RUN pip install gunicorn

# Create static directory explicitly
RUN mkdir -p /app/static

# Copy the built frontend - with verbose output
RUN echo "About to copy from frontend-build /app/build to ./static"
COPY --from=frontend-build /app/build/ ./static/
RUN echo "Copy completed"

# Debug: Check if static directory has content
RUN echo "Contents of /app/static after copy:"
RUN ls -la /app/static || echo "static directory empty or not found"
RUN find /app -type d | sort
RUN find /app/static -type f 2>/dev/null || echo "No files in static directory"

# Copy backend code
COPY src/ ./src/
COPY .env .

# Create tmp directory for video processing
RUN mkdir -p /app/tmp
RUN mkdir -p /app/tmpout
RUN chmod 777 /app/tmp /app/tmpout

# Copy a script to serve both frontend and backend
COPY serve.py .

# Final check of static directory
RUN echo "Final check of static directory:"
RUN ls -la /app/static
RUN find /app/static -type f 2>/dev/null || echo "No files in static directory"

# Create a startup script that sets environment variables
RUN echo '#!/bin/bash\n\
set -a\n\
[ -f .env ] && . ./.env\n\
set +a\n\
# Get the PORT from environment or default to 8000\n\
PORT="${PORT:-8000}"\n\
# Start gunicorn with the correct port\n\
exec gunicorn --bind 0.0.0.0:$PORT --workers 4 --threads 2 --timeout 120 "serve:app"\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose port
EXPOSE 8000

# Start the application with gunicorn
CMD ["/app/start.sh"]
