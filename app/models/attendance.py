#===============================
#app/models/attendance.py
#===============================
from sqlalchemy import Column, Integer, String, Date, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import Base

class Attendance(Base):
    __tablename__ = "attendance"

    # Primary key and other fields
    id = Column(Integer, primary_key=True, index=True)
    uid = Column(Integer, nullable=False)  # Unique ID from the device
    user_id = Column(Integer, nullable=False)  # User ID from the system
    timestamp = Column(DateTime, nullable=False)  # Time when the user clocked in/out on the device
    date = Column(Date, nullable=False)  # The actual date of attendance
    device_ip = Column(String, nullable=False)  # Device IP field (NOT NULL)

    # Unique constraint to avoid duplicate entries based on user_id, timestamp, and date
    __table_args__ = (
        UniqueConstraint('user_id', 'timestamp', 'date', name='uq_user_timestamp_date'),
    )

    def __repr__(self):
        return f"<Attendance(id={self.id}, user_id={self.user_id}, device_ip={self.device_ip})>"

    @classmethod
    async def insert_attendance(cls, session: AsyncSession, user_id: int, timestamp: datetime,
                                date: datetime, device_ip: str, uid: int):
        """Insert attendance record and skip if duplicate exists based on unique constraint."""
        try:
            # For SQLite compatibility, use a simple insert and catch unique constraint violations
            stmt = insert(Attendance).values(
                uid=uid,
                user_id=user_id,
                timestamp=timestamp,
                date=date,
                device_ip=device_ip
            )

            await session.execute(stmt)
            await session.commit()
            print(
                f"Attendance for user_id {user_id} (uid: {uid}) on {timestamp} inserted from device {device_ip}.")

        except Exception as e:
            # Check if it's a unique constraint violation
            if "UNIQUE constraint failed" in str(e) or "duplicate key value" in str(e):
                print(f"Duplicate attendance record for user_id {user_id} on {timestamp}, skipping.")
                await session.rollback()
            else:
                print(f"Error inserting attendance for user_id {user_id}: {e}")
                await session.rollback()
            raise
