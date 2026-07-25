#!/bin/bash
cd /app
python3 manage.py send_cdd_alerts >> /var/log/cron.log 2>&1
python3 manage.py send_maternity_alerts >> /var/log/cron.log 2>&1
python3 -c "
import urllib.request as r, ssl
r.urlopen(r.Request('https://192.168.8.217:8443/api/0/organizations/hr_nexus/heartbeat_check/81117d30-28a7-4e81-94db-73694eb33b9d/', method='POST'), context=ssl._create_unverified_context())
" >> /var/log/cron.log 2>&1
