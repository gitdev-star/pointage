#!/usr/bin/env python3
"""Export a daily series (present, late, ot_hours) using the SAME services as the HR dashboard,
so the numbers follow each employee's real schedule and the HC exclusion rule.

Run INSIDE the fastapi container (needs the app code, the database and the HR_DB_* variables). READ-ONLY.
  docker cp analytics/export_daily_series.py fastapi:/app/export_daily_series.py
  docker exec fastapi python export_daily_series.py --months 2 --out /tmp/daily_series.csv
  docker cp fastapi:/tmp/daily_series.csv analytics/out/daily_series.csv
"""
import argparse
import asyncio
import csv
from calendar import monthrange
from collections import defaultdict
from datetime import date

from sqlalchemy import distinct, func, select

from app.database import get_async_db
from app.models.attendance import Attendance
from app.services.late_report_service import compute_late_report
from app.services.overtime_report_service import compute_overtime_report


def last_months(n):
    t = date.today()
    y, m, out = t.year, t.month, []
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


async def run(args):
    today = date.today()
    present, late, ot = defaultdict(int), defaultdict(int), defaultdict(float)
    agen = get_async_db()
    db = await agen.__anext__()          # same session factory the FastAPI routes use
    try:
        for y, m in last_months(args.months):
            d1, d2 = date(y, m, 1), date(y, m, monthrange(y, m)[1])
            r = await db.execute(
                select(Attendance.date, func.count(distinct(Attendance.user_id)))
                .where(Attendance.date >= d1, Attendance.date <= d2)
                .group_by(Attendance.date))
            for d, n in r.all():
                present[d] = n

            lr = await compute_late_report(db=db, year=y, month=m, min_late=1)
            emps = getattr(lr, "employees", None)
            if emps is None:
                raise SystemExit("LateReportResult has no 'employees' attribute: send lines 78-97 of "
                                 "app/services/late_report_service.py so the export can be adapted")
            for e in emps:
                for ld in e.late_days:
                    late[ld.date] += 1

            orp = await compute_overtime_report(db=db, date_from=d1, date_to=d2)
            for e in orp.employees:
                for od in e.days:
                    ot[od.date] += float(od.overtime_hours)
            print(f"{y}-{m:02d}: late employees={len(emps)}  overtime employees={len(orp.employees)}", flush=True)
    finally:
        await agen.aclose()

    rows = [(d, present[d], late.get(d, 0), round(ot.get(d, 0.0), 2))
            for d in sorted(present) if d < today and d.weekday() < 5]
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "present", "late", "ot_hours"])
        w.writerows(rows)
    print(f"wrote {len(rows)} days to {args.out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=2, help="number of months back, current month included")
    ap.add_argument("--out", default="/tmp/daily_series.csv")
    asyncio.run(run(ap.parse_args()))
