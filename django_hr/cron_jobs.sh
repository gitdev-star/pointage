#!/bin/bash
cd /app
python3 manage.py send_cdd_alerts >> /var/log/cron.log 2>&1
python3 manage.py send_maternity_alerts >> /var/log/cron.log 2>&1
if [ -n "$GLITCHTIP_CRON_HEARTBEAT_URL" ]; then
  python3 -c "
import urllib.request as r, ssl
r.urlopen(r.Request('$GLITCHTIP_CRON_HEARTBEAT_URL', method='POST'), context=ssl._create_unverified_context())
" >> /var/log/cron.log 2>&1
fi
