#!/bin/bash
set -e

echo "=== Backing up files ==="
cp app/routers/attendance_routes.py app/routers/attendance_routes.py.bak2
cp app/services/analysis_service.py app/services/analysis_service.py.bak2
cp app/services/late_report_service.py app/services/late_report_service.py.bak2

echo "=== Fixing attendance_routes.py: proper local-time conversion ==="
python3 << 'PYEOF'
path = "app/routers/attendance_routes.py"
with open(path) as f:
    content = f.read()

# Add the timezone import once, right after the existing datetime import
old_import = "from datetime import datetime, date, time, timedelta"
new_import = "from datetime import datetime, date, time, timedelta\nfrom zoneinfo import ZoneInfo\n\nMADAGASCAR_TZ = ZoneInfo(\"Indian/Antananarivo\")"
assert old_import in content, "datetime import line not found"
content = content.replace(old_import, new_import, 1)

# Fix get_daily_kpi
old_kpi = '''        first_punch = row.first_punch.replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late += 1'''
new_kpi = '''        first_punch = row.first_punch.astimezone(MADAGASCAR_TZ).replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late += 1'''
assert old_kpi in content, "get_daily_kpi block not found"
content = content.replace(old_kpi, new_kpi)

# Fix get_late_today
old_late = '''        first_punch = row.first_punch.replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late_rows.append((row.user_id, first_punch, threshold))'''
new_late = '''        first_punch = row.first_punch.astimezone(MADAGASCAR_TZ).replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late_rows.append((row.user_id, first_punch, threshold))'''
assert old_late in content, "get_late_today block not found"
content = content.replace(old_late, new_late)

with open(path, "w") as f:
    f.write(content)
print("attendance_routes.py fixed OK")
PYEOF

echo "=== Fixing analysis_service.py: proper local-time conversion ==="
python3 << 'PYEOF'
path = "app/services/analysis_service.py"
with open(path) as f:
    content = f.read()

old_import = "from datetime import date, time, datetime, timedelta"
new_import = "from datetime import date, time, datetime, timedelta\nfrom zoneinfo import ZoneInfo\n\nMADAGASCAR_TZ = ZoneInfo(\"Indian/Antananarivo\")"
assert old_import in content, "datetime import line not found in analysis_service.py"
content = content.replace(old_import, new_import, 1)

old = '''    # DB timestamp column is timestamptz — strip tzinfo so comparisons against
    # naive datetime.combine(...) reference points below don't raise TypeError.
    if first and first.tzinfo:
        first = first.replace(tzinfo=None)
    if last and last.tzinfo:
        last = last.replace(tzinfo=None)'''
new = '''    # DB timestamp column is timestamptz (asyncpg returns it labeled UTC).
    # Convert to Madagascar local time BEFORE stripping tzinfo, so the naive
    # value's wall-clock numbers match the local schedule thresholds below.
    if first and first.tzinfo:
        first = first.astimezone(MADAGASCAR_TZ).replace(tzinfo=None)
    if last and last.tzinfo:
        last = last.astimezone(MADAGASCAR_TZ).replace(tzinfo=None)'''
assert old in content, "_analyze_day tz block not found"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("analysis_service.py fixed OK")
PYEOF

echo "=== Fixing late_report_service.py: proper local-time conversion ==="
python3 << 'PYEOF'
path = "app/services/late_report_service.py"
with open(path) as f:
    content = f.read()

old_import = "from datetime import date, datetime"
new_import = "from datetime import date, datetime\nfrom zoneinfo import ZoneInfo\n\nMADAGASCAR_TZ = ZoneInfo(\"Indian/Antananarivo\")"
assert old_import in content, "datetime import line not found in late_report_service.py"
content = content.replace(old_import, new_import, 1)

old = '''    arrival_naive = arrival.replace(tzinfo=None) if arrival.tzinfo else arrival'''
new = '''    arrival_naive = arrival.astimezone(MADAGASCAR_TZ).replace(tzinfo=None) if arrival.tzinfo else arrival'''
assert old in content, "_minutes_late line not found"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("late_report_service.py fixed OK")
PYEOF

echo "=== Verifying ==="
grep -n "MADAGASCAR_TZ\|astimezone" app/routers/attendance_routes.py
echo "---"
grep -n "MADAGASCAR_TZ\|astimezone" app/services/analysis_service.py
echo "---"
grep -n "MADAGASCAR_TZ\|astimezone" app/services/late_report_service.py

echo ""
echo "=== Restarting fastapi container ==="
docker compose restart fastapi
