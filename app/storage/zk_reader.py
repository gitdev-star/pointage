import asyncio
from fastapi import HTTPException
from app.models.attendance import Attendance
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from zk import ZK
from datetime import datetime


class ZKReader:
    def __init__(self, device_ip="192.168.8.205", device_port=4370, timeout=10):
        self.device_ip = device_ip
        self.device_port = device_port
        self.zk = ZK(device_ip, port=device_port, timeout=timeout)

    async def connect(self):
        """Connect to the ZK device."""
        try:
            self.connection = self.zk.connect()
            print(f"Connected to {self.device_ip}:{self.device_port}")
        except Exception as e:
            print(f"Failed to connect to device: {e}")
            raise HTTPException(status_code=500, detail="Failed to connect to ZKTeco device")

    async def fetch_attendance_logs(self):
        """Fetch attendance logs from the device."""
        try:
            if self.connection:
                # Fetch attendance records from the device
                logs = self.zk.get_attendance()  # This fetches logs from the device
                print(f"Attendance logs retrieved successfully. Total logs: {len(logs)}")
                return logs
            else:
                print("No connection to ZK device.")
                return []
        except Exception as e:
            print(f"Error fetching logs: {e}")
            raise HTTPException(status_code=500, detail=f"Error occurred while fetching logs: {e}")


async def fetch_and_store_attendance(db: AsyncSession):
    zk_reader = ZKReader()

    # Try to connect to the device
    await zk_reader.connect()

    # Fetch attendance logs from the device
    logs = await zk_reader.fetch_attendance_logs()

    for log in logs:
        try:
            print(f"Inspecting log: {log}")
            print("Attributes of log:", dir(log))  # Print attributes of the log object
            print("log.__dict__:", log.__dict__)  # Print the attributes and values

            # Extract values (assuming 'log' is a dictionary or similar structure)
            user_id = int(log.get('user_id'))  # Adjust based on how the data is structured
            timestamp = datetime.fromtimestamp(log.get('timestamp'))  # Adjust this as needed

            # Handle check-in/check-out logic if needed
            check_in = timestamp
            check_out = None  # Set check-out if available in the log

            # Store date and status
            date = check_in.date()

            # Create attendance record
            attendance_record = Attendance(
                user_id=user_id,
                check_in=check_in,
                check_out=check_out,
                date=date,
            )

            db.add(attendance_record)

        except Exception as e:
            print(f"Failed to process log {log}: {e}")
            continue  # Skip this log and continue with others

    # Commit the changes to the database asynchronously
    await db.commit()
    print(f"Successfully saved {len(logs)} attendance records to the database.")


async def main():
    async with AsyncSessionLocal() as session:
        await fetch_and_store_attendance(session)

if __name__ == "__main__":
    asyncio.run(main())
