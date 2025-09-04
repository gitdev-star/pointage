import asyncio
from zk import ZK

from .models import attendance
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.attendance import Attendance
from datetime import datetime
from fastapi import HTTPException
import time

device_ip = "192.168.8.205"
device_port = 4370

# Initialize the ZK object
zk = ZK(device_ip, port=device_port, timeout=10, password=0)  # Increased timeout


# Connect to the ZKTeco device (blocking function with retry mechanism)
def connect_to_device():
    retries = 3
    for _ in range(retries):
        try:
            conn = zk.connect()
            if conn:
                print("Connected to ZKTeco device")
                return zk
        except Exception as e:
            print(f"Connection failed: {e}")
            time.sleep(2)  # Wait before retrying
    raise Exception("Failed to connect to the device after retries")


# Fetch attendance logs from the device (blocking function)
def fetch_attendance_from_device(zk: ZK, date_filter: datetime):
    try:
        logs = zk.get_attendance()  # Fetch all logs from the device
        print(f"Fetched {len(logs)} attendance logs from the device.")

        # Filter logs for today (for testing, or for live data fetching)
        today_logs = [log for log in logs if log.timestamp.date() == date_filter.date()]
        print(f"Filtered {len(today_logs)} logs for today.")
        return today_logs
    except Exception as e:
        print(f"Failed to fetch attendance logs: {e}")
        raise Exception(f"Failed to fetch attendance logs: {e}")


# Save attendance logs to the database (async function)
from datetime import datetime

from datetime import datetime

async def save_attendance_to_db(logs, db: AsyncSession):
    try:
        # Track how many logs are saved successfully
        saved_count = 0

        for log in logs:
            if log.timestamp and log.timestamp.date() == datetime.now().date():  # Check if it's today's log
                # Ensure status is a string before inserting
                status_as_string = str(log.status)

                # Validate status value against the valid options (this could be '0', '1', '2' etc., depending on your DB)
                valid_statuses = ['0', '1', '2']  # Adjust these values according to your DB constraints
                if status_as_string not in valid_statuses:
                    print(f"Invalid status '{status_as_string}' for log {log.user_id}. Skipping this entry.")
                    continue  # Skip this log entry as its status is not valid

                # Create an attendance record
                attendance_record = Attendance(
                    user_id=int(log.user_id),  # Ensure you are using `log.user_id`, not `attendance.user_id`
                    check_in=log.timestamp,  # Use the timestamp as check_in
                    check_out=None,  # Set check_out to None if no checkout data is available
                    date=log.timestamp.date(),  # Store the date from the timestamp
                    status=status_as_string  # Use the string-converted status
                )

                db.add(attendance_record)
                saved_count += 1

        # Commit all the changes
        await db.commit()

        print(f"Successfully saved {saved_count} attendance records to the database.")
    except Exception as e:
        await db.rollback()  # Rollback in case of any error
        raise Exception(f"Failed to save attendance logs to DB: {e}")


# Wrapper function to handle blocking code asynchronously
async def sync_attendance(db: AsyncSession):
    try:
        today = datetime.now()  # Get today's date

        # Connect to the ZKTeco device
        zk_device = await asyncio.to_thread(connect_to_device)

        # Fetch attendance logs from the device (simulating real-time fetch)
        logs = await asyncio.to_thread(fetch_attendance_from_device, zk_device, today)

        if not logs:
            print("No attendance logs for today yet.")
        else:
            # Save today's logs to the database
            await save_attendance_to_db(logs, db)

        return {"message": f"Successfully fetched and saved {len(logs)} attendance records to the database."}
    except Exception as e:
        print(f"Error during sync: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync attendance: {e}")
