# =====================================================
# PATH: pointage/app/routers/late_report.py
# =====================================================
"""
Late-report router — HTTP layer only.
All business logic lives in app.services.late_report_service.
"""

import csv
import io
from datetime import date
from typing import List, Optional

import asyncio
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.services.late_report_service import (
    compute_late_report,
    get_all_classifications,
    LateReportResult,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])

MONTH_NAMES = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


# ── Pydantic response schemas ──────────────────────────────────────────────────

class LateDaySchema(BaseModel):
    date:         date
    day_name:     str
    arrival:      Optional[str]
    minutes_late: int

    class Config:
        from_attributes = True


class LateEmployeeSchema(BaseModel):
    user_id:             int
    late_count:          int
    late_days:           List[LateDaySchema]
    total_days_present:  int
    late_rate_pct:       float

    class Config:
        from_attributes = True


class LateReportResponseSchema(BaseModel):
    year:                      int
    month:                     int
    min_late:                  int
    total_employees_analyzed:  int
    total_late_employees:      int
    employees:                 List[LateEmployeeSchema]

    class Config:
        from_attributes = True


class ClassificationsResponse(BaseModel):
    classifications: List[str]


# ── CSV generator (presentation concern → stays in router) ────────────────────

def _csv_generator(report: LateReportResult):
    """Yield CSV chunks — streamed so memory stays flat for large reports."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")

    yield "\ufeff" 

    writer.writerow([f"Rapport retards — {MONTH_NAMES[report.month]} {report.year}"])
    writer.writerow([f"Seuil minimum : {report.min_late} retard(s)"])
    writer.writerow([
        f"Employés analysés : {report.total_employees_analyzed}",
        f"Employés en retard ≥ {report.min_late}x : {report.total_late_employees}",
    ])
    writer.writerow([])

    writer.writerow([
        "ID Employé", "Nb retards", "Jours présents",
        "Taux retard (%)", "Date", "Jour", "Heure arrivée", "Minutes de retard",
    ])

    for emp in report.employees:
        for i, ld in enumerate(emp.late_days):
            writer.writerow([
                emp.user_id            if i == 0 else "",
                emp.late_count         if i == 0 else "",
                emp.total_days_present if i == 0 else "",
                emp.late_rate_pct      if i == 0 else "",
                ld.date.strftime("%d/%m/%Y"),
                ld.day_name,
                ld.arrival or "—",
                ld.minutes_late,
            ])
        buf.seek(0)
        yield buf.read()
        buf.seek(0)
        buf.truncate(0)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/classifications", response_model=ClassificationsResponse)
async def get_classifications():
    """
    Return all distinct employee classification values found in the HR database.
    The frontend uses this to populate the classification dropdown.
    """
    loop = asyncio.get_event_loop()
    classifications = await loop.run_in_executor(None, get_all_classifications)
    return ClassificationsResponse(classifications=classifications)


@router.get("/late-report", response_model=LateReportResponseSchema)
async def get_late_report(
    year:           int           = Query(..., ge=2020, le=2100, description="Year  e.g. 2025"),
    month:          int           = Query(..., ge=1,    le=12,   description="Month e.g. 4"),
    min_late:       int           = Query(3,   ge=1,             description="Minimum late occurrences"),
    classification: Optional[str] = Query(
        None,
        description=(
            "Filter by employee classification. "
            "Pass 'ALL' to include everyone. "
            "Pass a specific code (e.g. 'HC') to include only that group. "
            "Omit (or pass null) to exclude HC and analyse non-managers only."
        ),
    ),
    db: AsyncSession = Depends(get_async_db),
):
    """Return all employees late ≥ min_late times in the given month."""
    report = await compute_late_report(db, year, month, min_late, classification)
    return LateReportResponseSchema(
        year                     = report.year,
        month                    = report.month,
        min_late                 = report.min_late,
        total_employees_analyzed = report.total_employees_analyzed,
        total_late_employees     = report.total_late_employees,
        employees                = [
            LateEmployeeSchema(
                user_id            = e.user_id,
                late_count         = e.late_count,
                late_days          = [
                    LateDaySchema(
                        date         = ld.date,
                        day_name     = ld.day_name,
                        arrival      = ld.arrival,
                        minutes_late = ld.minutes_late,
                    ) for ld in e.late_days
                ],
                total_days_present = e.total_days_present,
                late_rate_pct      = e.late_rate_pct,
            ) for e in report.employees
        ],
    )


@router.get("/late-report/export")
async def export_late_report_csv(
    year:           int           = Query(..., ge=2020, le=2100),
    month:          int           = Query(..., ge=1,    le=12),
    min_late:       int           = Query(3,   ge=1),
    classification: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    """Stream the late report as a UTF-8 CSV file."""
    report = await compute_late_report(db, year, month, min_late, classification)
    fname  = f"retards_{year}_{month:02d}_min{min_late}.csv"
    return StreamingResponse(
        _csv_generator(report),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
