#!/bin/bash
cd /app
if [ -n "$GLITCHTIP_CRON_HEARTBEAT_URL" ]; then
  python3 -c "
import urllib.request as r, ssl
r.urlopen(r.Request('$GLITCHTIP_CRON_HEARTBEAT_URL', method='POST'), context=ssl._create_unverified_context())
" >> /var/log/cron.log 2>&1
fi
