import asyncio
from app.models.attendance import Attendance
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from zk import ZK
from datetime import datetime


class ZKReader:
    def __init__(self, device_ip, device_port=4370, timeout=10, polling_interval=5):
        self.device_ip = device_ip
        self.device_port = device_port
        self.timeout = timeout
        self.polling_interval = polling_interval
        self.zk = ZK(device_ip, port=device_port, timeout=timeout, password=0)
        self.connection = None

    async def connect(self):
        """Establish connection with the device."""
        try:
            self.connection = self.zk.connect()
            if self.connection:
                print(f"Connected to {self.device_ip}:{self.device_port}")
            else:
                print(f"Failed to connect to device at {self.device_ip}")
        except Exception as e:
            print(f"Failed to connect to {self.device_ip}: {e}")
            await self.retry_connect()

    async def retry_connect(self):
        """Try reconnecting if the initial connection fails."""
        print(f"Retrying connection to {self.device_ip}...")
        await asyncio.sleep(5)  # Retry after 5 seconds
        await self.connect()

    async def fetch_attendance_logs(self):
        """Fetch live attendance logs from the device."""
        try:
            if self.connection:
                logs = self.zk.get_attendance()
                print(f"Fetched {len(logs)} logs from {self.device_ip}.")
                return logs
            else:
                print(f"No connection to device {self.device_ip}.")
                return []
        except Exception as e:
            print(f"Error fetching logs from {self.device_ip}: {e}")
            return []

    async def process_logs(self, db: AsyncSession):
        """Process logs and store them in the database."""
        logs = await self.fetch_attendance_logs()
        if logs:

            processed_count = 0
            failed_count = 0

            for log in logs:
                try:
                    user_id = int(log.user_id)
                    timestamp = log.timestamp

                    # Handle missing check-in/check-out
                    check_in = log.check_in if hasattr(log, 'check_in') else timestamp
                    check_out = log.check_out if hasattr(log, 'check_out') else None
                    date = check_in.date() if check_in else timestamp.date()

                    # Generate uid if not available from device
                    if hasattr(log, 'uid') and log.uid is not None:
                        uid_value = log.uid
                    else:
                        uid_value = int(f"{user_id}{int(timestamp.timestamp())}")

                    # Insert attendance without status and punch
                    await Attendance.insert_attendance(
                        session=db,
                        uid=uid_value,  # ✅ Always provide a valid uid
                        user_id=user_id,
                        timestamp=timestamp,
                        date=date,
                        device_ip=self.device_ip  # ✅ Pass the device IP
                    )

                    processed_count += 1
                    print(f"Processed record for user {user_id} from device {self.device_ip}")

                except Exception as e:
                    print(f"Failed to process log {log}: {e}")
                    failed_count += 1
                    continue

            print(f"Device {self.device_ip}: Processed {processed_count} records, Failed {failed_count} records")

    async def poll_logs(self, db: AsyncSession):
        """Continuously fetch and process logs in real-time."""
        while True:
            print(f"Fetching attendance logs from device {self.device_ip}...")
            try:
                await self.process_logs(db)
            except Exception as e:
                print(f"Error during polling for device {self.device_ip}: {e}")
                await db.rollback()

            print(f"Waiting for {self.polling_interval} seconds before fetching again...")
            await asyncio.sleep(self.polling_interval)  # Wait before next fetch


async def run_device_polling(device_ip, db: AsyncSession):
    """Initialize and start polling for attendance logs for a single device."""
    zk_reader = ZKReader(device_ip=device_ip)
    await zk_reader.connect()
    await zk_reader.poll_logs(db)


async def main():
    async with AsyncSessionLocal() as session:
        device_ips = ["192.168.8.200", "192.168.8.201", "192.168.8.202", "192.168.8.203", "192.168.8.204", "192.168.8.205", "192.168.8.206"]
        tasks = [run_device_polling(device_ip, session) for device_ip in device_ips]
        await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
