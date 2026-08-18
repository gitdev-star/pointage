# Use official Python image
FROM python:3.10-slim


# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Upgrade pip and install dependencies including ping utility
RUN apt-get update && \
    apt-get install -y iputils-ping && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 8080

# Start the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips=*"]

