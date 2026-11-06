#!/bin/bash
set -euo pipefail
cd /home/github-runner/pointage
set -a; . analytics/.env; set +a
mkdir -p analytics/out
echo "=== $(date '+%F %T') ===" >> analytics/out/anomaly_ml.log
analytics/.venv/bin/python analytics/anomaly_ml.py --test-days 3 >> analytics/out/anomaly_ml.log 2>&1
