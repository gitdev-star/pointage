# app/models/attendance.py
import logging
from datetime import datetime

from sqlalchemy import Column, Integer, String, Date, DateTime, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

logger = logging.getLogger(__name__)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),   # DB-generated, same instant as created_at — no app code needed
    )
    device_timestamp = Column(DateTime, nullable=False)     # raw device clock — dedup key only
    date = Column(Date, nullable=False)
    device_ip = Column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'device_timestamp', 'date', name='uq_user_devicetimestamp_date'),
    )

    def __repr__(self):
        return f"<Attendance(id={self.id}, user_id={self.user_id}, device_ip={self.device_ip})>"


@classmethod
async def insert_attendance(
    cls,
    session: AsyncSession,
    user_id: int,
    device_timestamp: datetime,
    date,
    device_ip: str,
    uid: int,
    timestamp: datetime | None = None,
) -> int:
    """
    Insert one attendance record, skipping silently if it's a duplicate.

    `timestamp` — heure réelle de l'événement, utilisée pour tous les
    calculs métier (retards, présence).
      - PUSH : ne pas passer `timestamp` → server_default now() s'applique.
        Le push étant quasi temps réel, now() ≈ heure réelle du pointage.
      - PULL : passer `timestamp=device_timestamp` explicitement, car le
        fetch peut avoir lieu bien après le pointage réel — now() serait
        alors faux (heure du fetch, pas du pointage).

    `device_timestamp` — heure brute lue sur l'appareil, utilisée
    uniquement comme clé de dédoublonnage (push vs pull), inchangé.

    Uses ON CONFLICT DO NOTHING on (user_id, device_timestamp, date) —
    ce comportement est indépendant de la valeur de `timestamp`, donc
    aucun risque de duplication introduit par ce changement.
    """
    values = dict(
        uid=uid,
        user_id=user_id,
        device_timestamp=device_timestamp,
        date=date,
        device_ip=device_ip,
    )
    if timestamp is not None:
        values["timestamp"] = timestamp
    # sinon: clé absente du dict -> server_default now() s'applique (cas push)

    stmt = insert(Attendance.__table__).values(**values).on_conflict_do_nothing(
        index_elements=["user_id", "device_timestamp", "date"]
    )

    try:
        result = await session.execute(stmt)
        await session.commit()
    except Exception as e:
        logger.error(f"[Attendance] insert failed for user_id={user_id}: {e!r}", exc_info=True)
        await session.rollback()
        raise

    inserted = result.rowcount
    if inserted:
        logger.debug(f"[Attendance] user_id={user_id} uid={uid} inserted from {device_ip} (timestamp={'device' if timestamp else 'now()'})")
    else:
        logger.debug(f"[Attendance] user_id={user_id} device_timestamp={device_timestamp} duplicate, skipped")

    return inserted