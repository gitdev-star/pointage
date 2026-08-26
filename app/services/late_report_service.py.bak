# =====================================================
# PATH: pointage/app/services/late_report_service.py
# =====================================================
"""
Late-report service — pure business logic, no FastAPI, no HTTP.

Performance strategy for 100+ employees:
  • ONE bulk DB query for the entire month (no per-user queries)
  • Python groups rows by user_id in O(n)
  • asyncio.gather runs per-user analysis concurrently

Classification filtering:
  Attendance.user_id = int(Employee.employee_id)  e.g. "000079" → 79
  Django is NOT available in the FastAPI container — HR DB is queried
  directly via psycopg2 using the HR_DB_* environment variables.
"""

import asyncio
import logging
import os
from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Optional, Set

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.services.analysis_service import (
    _analyze_day,
    get_schedule_for_employee,
    ScheduleRules,
)

logger = logging.getLogger(__name__)


# ── HR DB connection helper ────────────────────────────────────────────────────

def _get_hr_connection():
    """
    Open a psycopg2 connection to the HR database.
    Reads connection params from environment variables:
      HR_DB_HOST, HR_DB_PORT, HR_DB_NAME, HR_DB_USER, HR_DB_PASSWORD
    """
    import psycopg2
    return psycopg2.connect(
        host=os.environ.get("HR_DB_HOST", "localhost"),
        port=int(os.environ.get("HR_DB_PORT", "5432")),
        dbname=os.environ.get("HR_DB_NAME", "hr_db"),
        user=os.environ.get("HR_DB_USER", "user"),
        password=os.environ.get("HR_DB_PASSWORD", ""),
        connect_timeout=5,
        sslmode=os.environ.get("HR_DB_SSLMODE", "prefer"),
    )


# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class LateDay:
    date:         date
    day_name:     str
    arrival:      Optional[str]   # "HH:MM" or None
    minutes_late: int             # minutes after schedule work_start


@dataclass
class LateEmployee:
    user_id:             int
    late_count:          int
    late_days:           List[LateDay]
    total_days_present:  int
    late_rate_pct:       float    # late_count / present * 100


@dataclass
class LateReportResult:
    year:                      int
    month:                     int
    min_late:                  int
    total_employees_analyzed:  int
    total_late_employees:      int
    employees:                 List[LateEmployee]   # sorted by late_count desc


# ── Private helpers ────────────────────────────────────────────────────────────

def _hhmm(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%H:%M") if dt else None


def _minutes_late(arrival: datetime, rules: ScheduleRules) -> int:
    """Return how many minutes after rules.work_start the arrival was."""
    work_start_dt = datetime.combine(arrival.date(), rules.work_start)
    delta = (arrival - work_start_dt).total_seconds()
    return max(0, int(delta // 60))


def _get_employee_ids_by_classification(classification: Optional[str]) -> Optional[Set[int]]:
    """
    Return a set of user_id integers matching the given classification code,
    or None if no filtering is needed (classification is None / "ALL").

    Queries HR DB directly via psycopg2 (Django not available in FastAPI container).
    Attendance.user_id = int(Employee.employee_id), e.g. "000079" → 79.

    Runs synchronously — call via run_in_executor from async context.
    """
    if not classification or classification.upper() == "ALL":
        return None

    try:
        conn = _get_hr_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT e.employee_id
                    FROM employees_employee e
                    JOIN classification c ON c.id_classification = e.classification_id
                    WHERE c.classe = %s
                      AND e.employee_id IS NOT NULL
                    """,
                    (classification,)
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        result = set(int(row[0]) for row in rows if row[0] is not None)

        logger.warning(
            f"[CLASSIFICATION FILTER] classification={classification!r} "
            f"→ {len(result)} employee(s) found: {sorted(result)}"
        )

        return result

    except Exception as e:
        logger.error(
            f"[CLASSIFICATION FILTER] Failed to query HR DB for "
            f"classification={classification!r}: {e}",
            exc_info=True,
        )
        return None


def get_all_classifications() -> List[str]:
    """
    Return the list of distinct classification values from the HR database.
    Queries HR DB directly via psycopg2.
    Runs synchronously — wrap in run_in_executor if called from async context.
    """
    try:
        conn = _get_hr_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT classe FROM classification "
                    "WHERE classe IS NOT NULL AND classe != \'\' "
                    "ORDER BY classe"
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        return [row[0] for row in rows]

    except Exception as e:
        logger.error(f"[CLASSIFICATION] get_all_classifications failed: {e}", exc_info=True)
        return []


# ── Core service function ──────────────────────────────────────────────────────

async def compute_late_report(
    db:             AsyncSession,
    year:           int,
    month:          int,
    min_late:       int,
    classification: Optional[str] = None,
) -> LateReportResult:
    """
    Fetch all attendance rows for the month in ONE query,
    then analyse every employee concurrently.

    Three filtering modes based on `classification`:

      classification=None  → default: exclude HC employees (non-managers only)
      classification="ALL" → include everyone, no filter
      classification="HC"  → include only HC employees (managers only)
      classification="XYZ" → include only employees with classification XYZ

    Attendance.user_id maps to int(Employee.employee_id), e.g. "000079" → 79.

    Returns a LateReportResult with only employees whose late_count >= min_late.
    """
    first_day = date(year, month, 1)
    last_day  = date(year, month, monthrange(year, month)[1])

    loop = asyncio.get_event_loop()

    # ── Resolve the employee ID filter set (offloaded to thread pool) ─────────
    if classification and classification.upper() == "ALL":
        allowed_ids:  Optional[Set[int]] = None
        excluded_ids: Optional[Set[int]] = None
        logger.warning("[CLASSIFICATION FILTER] Mode: ALL — no filtering")

    elif classification:
        allowed_ids = await loop.run_in_executor(
            None, _get_employee_ids_by_classification, classification
        )
        excluded_ids = None
        logger.warning(
            f"[CLASSIFICATION FILTER] Mode: INCLUDE ONLY {classification!r} "
            f"→ allowed_ids count={len(allowed_ids) if allowed_ids else 0}"
        )

    else:
        allowed_ids  = None
        excluded_ids = await loop.run_in_executor(
            None, _get_employee_ids_by_classification, "HC"
        )
        logger.warning(
            f"[CLASSIFICATION FILTER] Mode: DEFAULT (exclude HC) "
            f"→ excluded_ids count={len(excluded_ids) if excluded_ids else 0}, "
            f"values={sorted(excluded_ids) if excluded_ids else None}"
        )

    # ── Single bulk query ──────────────────────────────────────────────────────
    query = (
        select(
            Attendance.user_id,
            Attendance.date.label("date"),
            func.min(Attendance.timestamp).label("first_punch"),
            func.max(Attendance.timestamp).label("last_punch"),
            func.count(Attendance.id).label("punch_count"),
        )
        .where(
            and_(
                Attendance.date >= first_day,
                Attendance.date <= last_day,
                Attendance.timestamp.isnot(None),
            )
        )
        .group_by(Attendance.user_id, Attendance.date)
        .order_by(Attendance.user_id, Attendance.date)
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return LateReportResult(
            year=year, month=month, min_late=min_late,
            total_employees_analyzed=0,
            total_late_employees=0,
            employees=[],
        )

    # ── Group rows by user_id — O(n), apply classification filter ─────────────
    user_rows: dict = defaultdict(list)
    skipped_ids: List[int] = []

    for row in rows:
        uid = row.user_id

        if allowed_ids is not None and uid not in allowed_ids:
            skipped_ids.append(uid)
            continue
        if excluded_ids is not None and uid in excluded_ids:
            skipped_ids.append(uid)
            continue

        user_rows[uid].append(row)

    logger.warning(
        f"[CLASSIFICATION FILTER] After filtering: "
        f"{len(user_rows)} user(s) kept, {len(set(skipped_ids))} skipped. "
        f"Skipped user_ids: {sorted(set(skipped_ids))}"
    )

    # ── Pre-fetch all schedules in parallel (1 thread per user, not per day) ────
    # get_schedule_for_employee returns the same rule for all days of the month
    # for a given user → cache it: uid → ScheduleRules
    schedule_cache: dict = {}

    def _fetch_schedule_for_user(uid: int, sample_date: date) -> tuple:
        return uid, get_schedule_for_employee(uid, sample_date)

    # Use first day of month as sample date for every user (schedules don't
    # change day-to-day within a month in practice)
    sample_date = first_day
    schedule_futures = [
        loop.run_in_executor(None, _fetch_schedule_for_user, uid, sample_date)
        for uid in user_rows
    ]
    for fut in await asyncio.gather(*schedule_futures):
        uid, rules = fut
        schedule_cache[uid] = rules

    logger.warning(
        f"[PERF] Schedule cache built for {len(schedule_cache)} users"
    )

    # ── Per-user analysis (concurrent, no more per-day thread calls) ──────────
    async def _analyze_user(uid: int, day_rows) -> Optional[LateEmployee]:
        late_days_out: List[LateDay] = []
        present_count = 0
        rules: ScheduleRules = schedule_cache[uid]

        for row in day_rows:
            day_rec = _analyze_day(row, rules)

            if day_rec.is_weekend:
                continue

            present_count += 1

            if day_rec.is_late and day_rec.arrival is not None:
                late_days_out.append(LateDay(
                    date         = day_rec.date,
                    day_name     = day_rec.day_name,
                    arrival      = _hhmm(day_rec.arrival),
                    minutes_late = _minutes_late(day_rec.arrival, rules),
                ))

        if len(late_days_out) < min_late:
            return None

        rate = round(len(late_days_out) / present_count * 100, 1) if present_count else 0.0
        return LateEmployee(
            user_id            = uid,
            late_count         = len(late_days_out),
            late_days          = late_days_out,
            total_days_present = present_count,
            late_rate_pct      = rate,
        )

    tasks   = [_analyze_user(uid, day_rows) for uid, day_rows in user_rows.items()]
    results = await asyncio.gather(*tasks)

    employees = sorted(
        [r for r in results if r is not None],
        key=lambda e: e.late_count,
        reverse=True,
    )

    return LateReportResult(
        year                     = year,
        month                    = month,
        min_late                 = min_late,
        total_employees_analyzed = len(user_rows),
        total_late_employees     = len(employees),
        employees                = employees,
    )
