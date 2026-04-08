from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.responses import JSONResponse
import asyncio
from datetime import datetime, date, timedelta
from typing import Optional, List
from sqlalchemy import select, desc, asc, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.devices.zk_reader import ZKReader
from app.database import AsyncSessionLocal, get_db
from app.models.attendance import Attendance
from app.sync_attendance import device_ips

app = FastAPI(
    title="HR Attendance Management System",
    description="Employee attendance tracking and management for HR department",
    version="1.0.0"
)


# ===== BACKGROUND DEVICE SYNC =====
async def fetch_attendance_from_device(device_ip: str):
    """Background task to continuously sync attendance from ZK devices."""
    zk_reader = ZKReader(device_ip=device_ip)

    try:
        await zk_reader.connect()
        print(f"HR System: Connected to device {device_ip}")
    except Exception as e:
        print(f"HR System: Failed to connect to device {device_ip}: {e}")
        return

    async with AsyncSessionLocal() as db:
        while True:
            try:
                attendance_data = await zk_reader.fetch_attendance_logs()
                if attendance_data:
                    await zk_reader.process_logs(db)
            except Exception as e:
                print(f"HR System: Error processing device {device_ip}: {e}")
                await db.rollback()

            await asyncio.sleep(30)  # Check every 30 seconds


@app.on_event("startup")
async def startup_event():
    """Initialize background attendance sync from all devices."""
    print("🏢 HR Attendance Management System Starting...")
    print(f"📡 Syncing with {len(device_ips)} attendance devices...")

    # Start background sync for all devices
    for device_ip in device_ips:
        asyncio.create_task(fetch_attendance_from_device(device_ip))

    print("✅ HR System: Background sync initialized")


# ===== HR ENDPOINTS =====

@app.get("/")
async def system_status():
    """HR System status and overview."""
    async with AsyncSessionLocal() as db:
        # Get basic stats
        total_records = await db.scalar(select(func.count(Attendance.id)))
        today_records = await db.scalar(
            select(func.count(Attendance.id)).where(Attendance.date == date.today())
        )

        return {
            "system": "HR Attendance Management",
            "status": "active",
            "devices_monitored": len(device_ips),
            "device_ips": device_ips,
            "total_attendance_records": total_records,
            "today_attendance_count": today_records
        }


@app.get("/attendance/today")
async def get_today_attendance(db: AsyncSession = Depends(get_db)):
    """Get all attendance records for today - HR daily overview."""
    try:
        today = date.today()
        stmt = select(Attendance).where(
            Attendance.date == today
        ).order_by(desc(Attendance.timestamp))

        result = await db.execute(stmt)
        records = result.scalars().all()

        # Group by status for HR summary
        present_count = sum(1 for r in records if r.status == "Present")

        return {
            "date": today.isoformat(),
            "total_punches": len(records),
            "employees_present": present_count,
            "records": [
                {
                    "user_id": r.user_id,
                    "timestamp": r.timestamp.strftime("%H:%M:%S"),
                    "status": r.status,
                    "device": r.device_ip,
                    "punch_type": r.punch
                } for r in records
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching today's attendance: {str(e)}")


@app.get("/attendance/employee/{user_id}")
async def get_employee_attendance(
        user_id: int,
        start_date: Optional[date] = Query(None),
        end_date: Optional[date] = Query(None),
        db: AsyncSession = Depends(get_db)
):
    """Get attendance history for a specific employee - HR individual tracking."""
    try:
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        stmt = select(Attendance).where(
            and_(
                Attendance.user_id == user_id,
                Attendance.date >= start_date,
                Attendance.date <= end_date
            )
        ).order_by(desc(Attendance.date), asc(Attendance.timestamp))

        result = await db.execute(stmt)
        records = result.scalars().all()

        # Group by date for HR reporting
        daily_summary = {}
        for record in records:
            day = record.date.isoformat()
            if day not in daily_summary:
                daily_summary[day] = {
                    "date": day,
                    "punches": [],
                    "first_in": None,
                    "last_out": None,
                    "total_punches": 0
                }

            daily_summary[day]["punches"].append({
                "time": record.timestamp.strftime("%H:%M:%S"),
                "status": record.status,
                "device": record.device_ip,
                "punch_type": record.punch
            })
            daily_summary[day]["total_punches"] += 1

            # Track first in and last out times
            if not daily_summary[day]["first_in"] or record.timestamp.time() < datetime.strptime(
                    daily_summary[day]["first_in"], "%H:%M:%S").time():
                daily_summary[day]["first_in"] = record.timestamp.strftime("%H:%M:%S")
            if not daily_summary[day]["last_out"] or record.timestamp.time() > datetime.strptime(
                    daily_summary[day]["last_out"], "%H:%M:%S").time():
                daily_summary[day]["last_out"] = record.timestamp.strftime("%H:%M:%S")

        return {
            "user_id": user_id,
            "period": f"{start_date} to {end_date}",
            "total_days_with_activity": len(daily_summary),
            "daily_attendance": list(daily_summary.values())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching employee attendance: {str(e)}")


@app.get("/attendance/report/daily")
async def get_daily_report(
        target_date: Optional[date] = Query(None),
        db: AsyncSession = Depends(get_db)
):
    """Generate daily attendance report for HR management."""
    try:
        if not target_date:
            target_date = date.today()

        # Get all attendance for the target date
        stmt = select(Attendance).where(
            Attendance.date == target_date
        ).order_by(asc(Attendance.user_id), asc(Attendance.timestamp))

        result = await db.execute(stmt)
        records = result.scalars().all()

        # Group by employee
        employee_summary = {}
        for record in records:
            user_id = record.user_id
            if user_id not in employee_summary:
                employee_summary[user_id] = {
                    "user_id": user_id,
                    "total_punches": 0,
                    "first_in": None,
                    "last_out": None,
                    "devices_used": set(),
                    "punch_times": []
                }

            emp_data = employee_summary[user_id]
            emp_data["total_punches"] += 1
            emp_data["devices_used"].add(record.device_ip)
            emp_data["punch_times"].append({
                "time": record.timestamp.strftime("%H:%M:%S"),
                "device": record.device_ip,
                "punch_type": record.punch
            })

            # Track first in and last out
            if not emp_data["first_in"] or record.timestamp.time() < datetime.strptime(emp_data["first_in"],
                                                                                       "%H:%M:%S").time():
                emp_data["first_in"] = record.timestamp.strftime("%H:%M:%S")
            if not emp_data["last_out"] or record.timestamp.time() > datetime.strptime(emp_data["last_out"],
                                                                                       "%H:%M:%S").time():
                emp_data["last_out"] = record.timestamp.strftime("%H:%M:%S")

        # Convert sets to lists for JSON serialization
        for emp_id, emp_data in employee_summary.items():
            emp_data["devices_used"] = list(emp_data["devices_used"])

        return {
            "report_date": target_date.isoformat(),
            "total_employees": len(employee_summary),
            "total_punches": len(records),
            "employee_details": list(employee_summary.values())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating daily report: {str(e)}")


@app.get("/attendance/summary/weekly")
async def get_weekly_summary(
        week_start: Optional[date] = Query(None),
        db: AsyncSession = Depends(get_db)
):
    """Weekly attendance summary for HR planning."""
    try:
        if not week_start:
            # Default to current week (Monday as start)
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

        week_end = week_start + timedelta(days=6)

        stmt = select(Attendance).where(
            and_(
                Attendance.date >= week_start,
                Attendance.date <= week_end
            )
        ).order_by(asc(Attendance.date))

        result = await db.execute(stmt)
        records = result.scalars().all()

        # Group by day and count unique employees
        daily_stats = {}
        for record in records:
            day = record.date.isoformat()
            if day not in daily_stats:
                daily_stats[day] = {
                    "date": day,
                    "unique_employees": set(),
                    "total_punches": 0
                }

            daily_stats[day]["unique_employees"].add(record.user_id)
            daily_stats[day]["total_punches"] += 1

        # Convert to final format
        weekly_data = []
        for day_data in daily_stats.values():
            weekly_data.append({
                "date": day_data["date"],
                "employees_present": len(day_data["unique_employees"]),
                "total_punches": day_data["total_punches"]
            })

        return {
            "week_period": f"{week_start} to {week_end}",
            "total_days_with_data": len(weekly_data),
            "daily_breakdown": sorted(weekly_data, key=lambda x: x["date"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating weekly summary: {str(e)}")


@app.get("/devices/status")
async def get_device_status():
    """Check status of all attendance devices for HR monitoring."""
    device_status = []

    for device_ip in device_ips:
        try:
            # Test connection to each device
            zk_reader = ZKReader(device_ip=device_ip)
            await zk_reader.connect()

            # Get recent activity count
            async with AsyncSessionLocal() as db:
                recent_count = await db.scalar(
                    select(func.count(Attendance.id)).where(
                        and_(
                            Attendance.device_ip == device_ip,
                            Attendance.created_at >= datetime.now() - timedelta(hours=1)
                        )
                    )
                )

            device_status.append({
                "device_ip": device_ip,
                "status": "online",
                "recent_records": recent_count
            })

        except Exception as e:
            device_status.append({
                "device_ip": device_ip,
                "status": "offline",
                "error": str(e)
            })

    return {
        "devices": device_status,
        "total_devices": len(device_ips),
        "online_devices": len([d for d in device_status if d["status"] == "online"])
    }