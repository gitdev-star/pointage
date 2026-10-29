# =====================================================
# PATH: pointage/app/routers/overtime_report.py
# =====================================================
"""
Synthèse des heures supplémentaires — couche HTTP uniquement.
La logique est dans app.services.overtime_report_service.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.services.overtime_report_service import compute_overtime_report

router = APIRouter(prefix="/attendance", tags=["attendance"])


class OvertimeDaySchema(BaseModel):
    date:           date
    arrival:        Optional[str]
    departure:      Optional[str]
    hours_done:     Optional[float]
    overtime_hours: float


class OvertimeEmployeeSchema(BaseModel):
    user_id:        int
    overtime_hours: float
    overtime_days:  int
    days:           List[OvertimeDaySchema]


class OvertimeReportResponseSchema(BaseModel):
    date_from:   date
    date_to:     date
    total_hours: float
    employees:   List[OvertimeEmployeeSchema]


@router.get("/overtime-report", response_model=OvertimeReportResponseSchema)
async def get_overtime_report(
    date_from:      date          = Query(..., description="Premier jour inclus, ex. 2026-10-19"),
    date_to:        date          = Query(..., description="Dernier jour inclus, ex. 2026-10-25"),
    classification: Optional[str] = Query(
        None,
        description="Omis : HC exclus. 'ALL' : tout le monde. Un code : uniquement ce groupe.",
    ),
    db: AsyncSession = Depends(get_async_db),
):
    """Heures supplémentaires par employé sur la période (employés sans HS omis)."""
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="date_to doit être >= date_from")
    if (date_to - date_from).days > 62:
        raise HTTPException(status_code=400, detail="Période limitée à 62 jours")

    report = await compute_overtime_report(db, date_from, date_to, classification)
    return OvertimeReportResponseSchema(
        date_from   = report.date_from,
        date_to     = report.date_to,
        total_hours = report.total_hours,
        employees   = [
            OvertimeEmployeeSchema(
                user_id        = e.user_id,
                overtime_hours = e.overtime_hours,
                overtime_days  = e.overtime_days,
                days           = [
                    OvertimeDaySchema(
                        date           = d.date,
                        arrival        = d.arrival,
                        departure      = d.departure,
                        hours_done     = d.hours_done,
                        overtime_hours = d.overtime_hours,
                    ) for d in e.days
                ],
            ) for e in report.employees
        ],
    )