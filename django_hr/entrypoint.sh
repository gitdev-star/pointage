#!/bin/sh

# Run migrations
python manage.py migrate

# Register cron jobs — every day at 07:00
echo "0 7 * * * cd /app && python3 manage.py send_cdd_alerts >> /var/log/cdd_alerts.log 2>&1" > /etc/cron.d/hr-alerts
echo "0 7 * * * cd /app && python3 manage.py send_maternity_alerts >> /var/log/maternity_alerts.log 2>&1" >> /etc/cron.d/hr-alerts
chmod 0644 /etc/cron.d/hr-alerts
crontab /etc/cron.d/hr-alerts

# Start cron daemon in background (debian/ubuntu style)
service cron start

# Start gunicorn in foreground (keeps container alive)
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8002 \
  --workers 8 \
  --threads 2 \
  --worker-class gthread \
  --timeout 120 \
  --max-requests 1000 \
  --max-requests-jitter 50
