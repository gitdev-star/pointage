FROM python:3.11-slim
WORKDIR /app

COPY django_auth/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY django_auth .
