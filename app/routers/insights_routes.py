from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.django_auth import get_current_user
from app.database import engine

router = APIRouter(prefix="/api/insights", tags=["insights"], dependencies=[Depends(get_current_user)])

ORDER = "CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, id"


class StatusUpdate(BaseModel):
    status: Literal["new", "seen", "resolved", "false_positive"]


@router.get("")
async def list_insights(
    on: Optional[date] = Query(None, alias="date"),
    kind: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(200, le=1000),
):
    sql = text(f"""
        SELECT id, insight_date, kind, rule, severity, scope_type, scope_value,
               title, message, payload, status, created_at
        FROM insights
        WHERE insight_date = COALESCE(CAST(:d AS date), (SELECT max(insight_date) FROM insights))
          AND (CAST(:kind AS text) IS NULL OR kind = :kind)
          AND (CAST(:severity AS text) IS NULL OR severity = :severity)
          AND (CAST(:status AS text) IS NULL OR status = :status)
        ORDER BY {ORDER}
        LIMIT :limit
    """)
    async with engine.connect() as conn:
        res = await conn.execute(sql, {"d": on, "kind": kind, "severity": severity,
                                       "status": status, "limit": limit})
        return [dict(r) for r in res.mappings().all()]


@router.get("/unread-count")
async def unread_count():
    sql = text("""
        SELECT severity, count(*) AS n FROM insights
        WHERE status = 'new' AND severity <> 'info'
          AND insight_date >= CURRENT_DATE - 7
        GROUP BY severity
    """)
    async with engine.connect() as conn:
        res = await conn.execute(sql)
        counts = {r["severity"]: r["n"] for r in res.mappings().all()}
    return {"critical": counts.get("critical", 0), "warning": counts.get("warning", 0),
            "total": sum(counts.values())}


@router.patch("/{insight_id}")
async def update_status(insight_id: int, body: StatusUpdate):
    sql = text("UPDATE insights SET status = :s, updated_at = now() WHERE id = :id RETURNING id, status")
    async with engine.begin() as conn:
        res = await conn.execute(sql, {"s": body.status, "id": insight_id})
        row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Insight not found")
    return dict(row)
