# =====================================================
# PATH: pointage/app/services/overtime_report_service.py
# =====================================================
"""
Synthèse des heures supplémentaires (HS) sur une période — logique métier pure.

Même règle de calcul que la fiche individuelle (_analyze_day) :
  HS = départ − fin d'horaire, comptées dès que départ ≥ fin + 29 min.

Même stratégie que le rapport des retards :
  • UNE requête groupée (user_id, date) pour toute la période
  • HC exclus par défaut (même filtre que late_report_service)
"""

import asyncio
import logging
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
    heures_effectuees,
)
from app.services.late_report_service import _get_employee_ids_by_classification

logger = logging.getLogger(__name__)


@dataclass
class OvertimeDay:
    date:           date
    arrival:        Optional[str]     # "HH:MM"
    departure:      Optional[str]     # "HH:MM"
    hours_done:     Optional[float]   # sortie − max(arrivée, début d'horaire)
    overtime_hours: float


@dataclass
class OvertimeEmployee:
    user_id:        int
    overtime_hours: float
    overtime_days:  int
    days:           List[OvertimeDay]   # uniquement les jours avec HS


@dataclass
class OvertimeReportResult:
    date_from:      date
    date_to:        date
    total_hours:    float
    employees:      List[OvertimeEmployee]   # uniquement ceux qui ont des HS, triés par HS desc


def _hhmm(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%H:%M") if dt else None


async def compute_overtime_report(
    db:             AsyncSession,
    date_from:      date,
    date_to:        date,
    classification: Optional[str] = None,
) -> OvertimeReportResult:
    """
    classification=None  → par défaut : HC exclus (non-cadres uniquement)
    classification="ALL" → tout le monde
    classification="XYZ" → uniquement la classification XYZ
    """
    loop = asyncio.get_event_loop()

    allowed_ids:  Optional[Set[int]] = None
    excluded_ids: Optional[Set[int]] = None
    if classification and classification.upper() == "ALL":
        pass
    elif classification:
        allowed_ids = await loop.run_in_executor(
            None, _get_employee_ids_by_classification, classification
        )
    else:
        excluded_ids = await loop.run_in_executor(
            None, _get_employee_ids_by_classification, "HC"
        )

    result = await db.execute(
        select(
            Attendance.user_id,
            Attendance.date.label("date"),
            func.min(Attendance.timestamp).label("first_punch"),
            func.max(Attendance.timestamp).label("last_punch"),
            func.count(Attendance.id).label("punch_count"),
        )
        .where(
            and_(
                Attendance.date >= date_from,
                Attendance.date <= date_to,
                Attendance.timestamp.isnot(None),
            )
        )
        .group_by(Attendance.user_id, Attendance.date)
        .order_by(Attendance.user_id, Attendance.date)
    )

    user_rows: dict = defaultdict(list)
    for row in result.all():
        uid = row.user_id
        if allowed_ids is not None and uid not in allowed_ids:
            continue
        if excluded_ids is not None and uid in excluded_ids:
            continue
        user_rows[uid].append(row)

    # Un horaire par employé pour toute la période (comme le rapport des retards)
    def _fetch_schedule(uid: int) -> tuple:
        return uid, get_schedule_for_employee(uid, date_from)

    schedules = dict(await asyncio.gather(*[
        loop.run_in_executor(None, _fetch_schedule, uid) for uid in user_rows
    ]))

    employees: List[OvertimeEmployee] = []
    for uid, day_rows in user_rows.items():
        rules = schedules[uid]
        days_out: List[OvertimeDay] = []
        for row in day_rows:
            d = _analyze_day(row, rules)
            if not d.is_overtime:
                continue
            days_out.append(OvertimeDay(
                date           = d.date,
                arrival        = _hhmm(d.arrival),
                departure      = _hhmm(d.departure),
                hours_done     = heures_effectuees(d.arrival, d.departure, rules),
                overtime_hours = d.overtime_hours,
            ))
        if not days_out:
            continue
        employees.append(OvertimeEmployee(
            user_id        = uid,
            overtime_hours = round(sum(d.overtime_hours for d in days_out), 2),
            overtime_days  = len(days_out),
            days           = days_out,
        ))

    employees.sort(key=lambda e: e.overtime_hours, reverse=True)

    logger.info(
        f"[OVERTIME REPORT] {date_from} → {date_to} : "
        f"{len(user_rows)} employé(s) analysé(s), {len(employees)} avec HS"
    )

    return OvertimeReportResult(
        date_from   = date_from,
        date_to     = date_to,
        total_hours = round(sum(e.overtime_hours for e in employees), 2),
        employees   = employees,
    )