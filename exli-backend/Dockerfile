# Use lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run using production server (Gunicorn)
# This expects a file named 'main.py' containing an app object named 'app'
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app