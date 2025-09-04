# services/attendance_service.py
from sqlalchemy.orm import Session
from app.models.attendance import Attendance
from datetime import datetime


def insert_attendance_data(db_session: Session, logs: list):
    for log in logs:
        # Convert check-in and check-out times to proper datetime objects if needed
        check_in_time = datetime.strptime(log['check_in'], "%Y-%m-%dT%H:%M:%S")
        check_out_time = datetime.strptime(log['check_out'], "%Y-%m-%dT%H:%M:%S")
        date = datetime.strptime(log['date'], "%Y-%m-%d").date()

        attendance_record = Attendance(
            user_id=log['user_id'],
            check_in=check_in_time,
            check_out=check_out_time,
            date=date,
        )
        db_session.add(attendance_record)

    db_session.commit()
