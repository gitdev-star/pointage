import asyncio
from zk import ZK
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.attendance import Attendance
import time

# List of ZKTeco device IPs
device_ips = ["192.168.8.200", "192.168.8.201", "192.168.8.202", "192.168.8.203", "192.168.8.204", "192.168.8.205", "192.168.8.206"]  # List of device IPs

class ZKReader:
    def __init__(self, device_ip, device_port=4370, timeout=10, password=0):
        self.device_ip = device_ip
        self.device_port = device_port
        self.timeout = timeout
        self.password = password
        self.zk = ZK(device_ip, port=device_port, timeout=timeout, password=password)
        self.connection = None

    async def connect(self):
        """Establish connection with the device."""
        retries = 3
        for _ in range(retries):
            try:
                self.connection = self.zk.connect()
                if self.connection:
                    print(f"Connected to device {self.device_ip}")
                    return self.zk
            except Exception as e:
                print(f"Failed to connect to {self.device_ip}: {e}")
                await asyncio.sleep(2)  # Retry after a brief wait
        raise Exception(f"Failed to connect to {self.device_ip} after retries")

    async def fetch_attendance_logs(self, date_filter: datetime):
        """Fetch attendance logs from the device."""
        try:
            if self.connection:
                logs = self.zk.get_attendance()  # Fetch all logs from the device
                print(f"Fetched {len(logs)} logs from {self.device_ip}")
                today_logs = [log for log in logs if log.timestamp.date() == date_filter.date()]
                print(f"Filtered {len(today_logs)} logs for today from {self.device_ip}")
                return today_logs
            else:
                print(f"No connection to {self.device_ip}.")
                return []
        except Exception as e:
            print(f"Error fetching logs from {self.device_ip}: {e}")
            return []

    async def save_attendance_to_db(self, logs, db: AsyncSession, device_ip: str):
        """Save attendance logs to the database."""
        saved_count = 0
        for log in logs:
            if log.timestamp and log.timestamp.date() == datetime.now().date():  # Only today’s logs
                # Insert attendance with the device_ip and required fields
                await Attendance.insert_attendance(
                    session=db,
                    uid=int(getattr(log, "uid", log.user_id)),  # Use log.uid if available, else log.user_id
                    user_id=int(log.user_id),
                    timestamp=log.timestamp,
                    date=log.timestamp.date(),
                    device_ip=device_ip
                )
                saved_count += 1

        print(f"Successfully saved {saved_count} attendance records to the database from device {device_ip}.")

async def process_device(device_ip, db: AsyncSession, date_filter: datetime):
    """Process each device: connect, fetch logs, and save to DB."""
    zk_reader = ZKReader(device_ip)
    try:
        await zk_reader.connect()  # Connect to the device
        logs = await zk_reader.fetch_attendance_logs(date_filter)  # Fetch logs
        if logs:
            await zk_reader.save_attendance_to_db(logs, db, device_ip)  # Pass device_ip to save_attendance_to_db
    except Exception as e:
        print(f"Error processing device {device_ip}: {e}")
        return {"device_ip": device_ip, "error": str(e)}

async def sync_attendance(db: AsyncSession):
    """Sync attendance logs for multiple devices."""
    today = datetime.now()  # Use today's date for filtering logs

    tasks = []
    for device_ip in device_ips:
        tasks.append(process_device(device_ip, db, today))

    try:
        results = await asyncio.gather(*tasks)  # Run all tasks concurrently
        # Check results for any errors
        error_devices = [result for result in results if isinstance(result, dict)]
        if error_devices:
            error_message = "Failed to sync the following devices:\n"
            for error in error_devices:
                error_message += f"Device {error['device_ip']} error: {error['error']}\n"
            print(error_message)
            raise HTTPException(status_code=500, detail=error_message)

        return {"message": f"Successfully fetched and saved attendance records for {len(device_ips)} devices."}
    except Exception as e:
        print(f"Error during sync: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync attendance: {e}")