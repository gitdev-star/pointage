# app/routers/attendance.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter()

# Rectified model: only fields relevant to your real attendance table
class AttendanceRecord(BaseModel):
    id: int
    uid: int
    user_id: int
    timestamp: datetime
    date: datetime
    device_ip: str

# Mock data for testing (adjust as needed)
mock_attendance = [
    AttendanceRecord(
        id=1,
        uid=1001,
        user_id=101,
        timestamp=datetime.now(),
        date=datetime.now().date(),
        device_ip="192.168.8.201"
    ),
    AttendanceRecord(
        id=2,
        uid=1002,
        user_id=102,
        timestamp=datetime.now(),
        date=datetime.now().date(),
        device_ip="192.168.8.202"
    )
]

# Routes
@router.get("/")
async def get_attendance():
    return {"message": "Attendance API", "total_records": len(mock_attendance)}

@router.get("/records", response_model=List[AttendanceRecord])
async def get_all_records():
    return mock_attendance

@router.get("/records/{record_id}", response_model=AttendanceRecord)
async def get_record(record_id: int):
    for record in mock_attendance:
        if record.id == record_id:
            return record
    raise HTTPException(status_code=404, detail="Record not found")

@router.post("/records", response_model=AttendanceRecord)
async def create_record(record: AttendanceRecord):
    mock_attendance.append(record)
    return record

@router.get("/stats")
async def get_stats():
    total = len(mock_attendance)
    # Example: count records for today
    today = datetime.now().date()
    today_records = len([r for r in mock_attendance if r.date == today])
    return {
        "total_records": total,
        "records_today": today_records
    }