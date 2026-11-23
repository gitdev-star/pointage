#!/bin/bash
# Lancé par cron (environnement vide) : recharge l'environnement du conteneur
while IFS= read -r -d '' kv; do
  case "$kv" in
    *=*) export "$kv" ;;
  esac
done < /proc/1/environ
cd /app || exit 1
exec /usr/local/bin/python3 manage.py send_overtime_limit_alerts "$@"
