# Use lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# No system dependencies needed for Document AI! 
# We just update apt to be safe, but no heavy installs.
# Install compilation tools (fixes slow/hanging builds for grpcio/pandas)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run using production server (Gunicorn)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app

#Forcing build