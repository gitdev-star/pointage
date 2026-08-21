#!/bin/bash
set -e

echo "=== Backing up files ==="
cp app/routers/attendance_routes.py app/routers/attendance_routes.py.bak
cp app/services/analysis_service.py app/services/analysis_service.py.bak
cp app/services/late_report_service.py app/services/late_report_service.py.bak

echo "=== Patching attendance_routes.py (get_daily_kpi + get_late_today) ==="
python3 << 'PYEOF'
path = "app/routers/attendance_routes.py"
with open(path) as f:
    content = f.read()

old_kpi = '''    late = 0
    for row in rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        if row.first_punch >= threshold:
            late += 1'''

new_kpi = '''    late = 0
    for row in rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        first_punch = row.first_punch.replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late += 1'''

assert old_kpi in content, "get_daily_kpi block not found — aborting"
content = content.replace(old_kpi, new_kpi)

old_late = '''    late_rows = []
    for row in all_rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        if row.first_punch >= threshold:
            late_rows.append((row.user_id, row.first_punch, threshold))'''

new_late = '''    late_rows = []
    for row in all_rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        first_punch = row.first_punch.replace(tzinfo=None) if row.first_punch and row.first_punch.tzinfo else row.first_punch
        if first_punch >= threshold:
            late_rows.append((row.user_id, first_punch, threshold))'''

assert old_late in content, "get_late_today block not found — aborting"
content = content.replace(old_late, new_late)

with open(path, "w") as f:
    f.write(content)
print("attendance_routes.py patched OK")
PYEOF

echo "=== Patching analysis_service.py (_analyze_day) ==="
python3 << 'PYEOF'
path = "app/services/analysis_service.py"
with open(path) as f:
    content = f.read()

old = '''    first:      Optional[datetime]  = getattr(row, "first_punch", None)
    last:       Optional[datetime]  = getattr(row, "last_punch",  None)
    punch_count: int                = int(getattr(row, "punch_count", 0) or 0)'''

new = '''    first:      Optional[datetime]  = getattr(row, "first_punch", None)
    last:       Optional[datetime]  = getattr(row, "last_punch",  None)
    punch_count: int                = int(getattr(row, "punch_count", 0) or 0)

    # DB timestamp column is timestamptz — strip tzinfo so comparisons against
    # naive datetime.combine(...) reference points below don't raise TypeError.
    if first and first.tzinfo:
        first = first.replace(tzinfo=None)
    if last and last.tzinfo:
        last = last.replace(tzinfo=None)'''

assert old in content, "_analyze_day block not found — aborting"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("analysis_service.py patched OK")
PYEOF

echo "=== Patching late_report_service.py (_minutes_late) ==="
python3 << 'PYEOF'
path = "app/services/late_report_service.py"
with open(path) as f:
    content = f.read()

old = '''def _minutes_late(arrival: datetime, rules: ScheduleRules) -> int:
    """Return how many minutes after rules.work_start the arrival was."""
    work_start_dt = datetime.combine(arrival.date(), rules.work_start)
    delta = (arrival - work_start_dt).total_seconds()
    return max(0, int(delta // 60))'''

new = '''def _minutes_late(arrival: datetime, rules: ScheduleRules) -> int:
    """Return how many minutes after rules.work_start the arrival was."""
    arrival_naive = arrival.replace(tzinfo=None) if arrival.tzinfo else arrival
    work_start_dt = datetime.combine(arrival_naive.date(), rules.work_start)
    delta = (arrival_naive - work_start_dt).total_seconds()
    return max(0, int(delta // 60))'''

assert old in content, "_minutes_late block not found — aborting"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("late_report_service.py patched OK")
PYEOF

echo "=== Verifying ==="
grep -n "tzinfo" app/routers/attendance_routes.py
echo "---"
grep -n "tzinfo" app/services/analysis_service.py
echo "---"
grep -n "tzinfo" app/services/late_report_service.py

echo ""
echo "=== Restarting fastapi container ==="
docker compose restart fastapi
