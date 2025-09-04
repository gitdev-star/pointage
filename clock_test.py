#pointage/clock_test.py
import asyncio
from fastapi import HTTPException
from app.models.attendance import Attendance
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from zk import ZK
from datetime import datetime

# Initialize ZKTeco device connection
device_ip = "192.168.8.205"
device_port = 4370
zk = ZK(device_ip, port=device_port, timeout=5, password=0)  # You may need to update parameters

async def fetch_and_store_attendance(db: AsyncSession):
    # Try to connect to the device
    try:
        conn = zk.connect()
        if conn:
            print("Connected to ZKTeco device")

            # Fetch attendance records from the device
            logs = zk.get_attendance()  # Assuming this fetches logs from the device
            print(f"Attendance logs retrieved successfully. Total logs: {len(logs)}")

            for log in logs:
                try:
                    # Inspect the log attributes
                    print(f"Inspecting log: {log}")
                    print("Attributes of log:", dir(log))  # Print attributes of the log object
                    print("log.__dict__:", log.__dict__)  # Print the attributes and values

                    # Use correct field names after inspecting
                    user_id = int(log.user_id)  # Ensure user_id is an integer
                    timestamp = log.timestamp  # Assuming the timestamp is correct

                    # Handle missing check-in/check-out
                    check_in = log.check_in if hasattr(log, 'check_in') else timestamp
                    check_out = log.check_out if hasattr(log, 'check_out') else None

                    # Create the date from the timestamp
                    date = check_in.date() if check_in else timestamp.date()

                    # Determine status based on business logic
                    if check_in and not check_out:
                        status = 'Absent'  # If no check-out, mark as absent
                    else:
                        status = 'Present'  # Assume present if check-in and check-out exist

                    # Create attendance record
                    attendance_record = Attendance(
                        user_id=user_id,
                        check_in=check_in,  # Ensure check_in is set
                        check_out=check_out,  # Ensure check_out is set if available
                        date=date,            # Store the date separately
                        status=status         # Set status
                    )

                    db.add(attendance_record)

                except Exception as e:
                    print(f"Failed to process log {log}: {e}")
                    continue  # Skip this log and continue with others

            # Commit the changes to the database asynchronously
            await db.commit()
            print(f"Successfully saved {len(logs)} attendance records to the database.")

        else:
            print("Failed to connect to the device")
            raise HTTPException(status_code=500, detail="Failed to connect to the ZKTeco device")

    except Exception as e:
        print(f"Error occurred during attendance fetching and storing: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred: {e}")

async def main():
    async with AsyncSessionLocal() as session:
        await fetch_and_store_attendance(session)

if __name__ == "__main__":
    asyncio.run(main())
