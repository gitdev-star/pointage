# =====================================================
# PATH: pointage/Dockerfiles/django_hr.Dockerfile
# =====================================================
FROM python:3.11-slim

WORKDIR /app

# -----------------------------------------------------
# ✅ Install system dependencies (LibreOffice + fonts)
# -----------------------------------------------------
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    cron \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------
# ✅ Install Python dependencies
# -----------------------------------------------------
COPY django_hr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------
# ✅ Copy Django project
# -----------------------------------------------------
COPY django_hr/ .

ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8002

CMD ["python", "manage.py", "runserver", "0.0.0.0:8002"]
