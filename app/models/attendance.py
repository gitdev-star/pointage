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
    ) -> int:
        """
        Insert one attendance record, skipping silently if it's a duplicate.

        `timestamp` is NOT passed in and NOT set here — it's left to the
        column's server_default (`now()`), same as `created_at`, so both
        are populated by the same Postgres `now()` call and stay identical
        (Postgres's `now()` returns the same value for the whole transaction).

        `device_timestamp` is the raw value read from the device and is
        used only for the unique constraint (push vs. pull dedup).

        Uses ON CONFLICT DO NOTHING, same as the push (adms_routes.py) and
        pull (zk_reader.py) paths.

        Returns the number of rows actually inserted (0 if it was a duplicate).
        """
        stmt = insert(Attendance.__table__).values(
            uid=uid,
            user_id=user_id,
            device_timestamp=device_timestamp,
            date=date,
            device_ip=device_ip,
            # timestamp intentionally omitted — server_default fills it
        ).on_conflict_do_nothing(
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
            logger.debug(f"[Attendance] user_id={user_id} uid={uid} inserted from {device_ip}")
        else:
            logger.debug(f"[Attendance] user_id={user_id} device_timestamp={device_timestamp} duplicate, skipped")

        return inserted