# app/schemas/attendance.py
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional

class AttendanceSchema(BaseModel):
    id: int
    uid: int
    user_id: int
    timestamp: datetime
    date: date
    device_ip: str

    class Config:
        from_attributes = True  # For Pydantic v2 compatibility with SQLAlchemy
