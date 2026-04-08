# run_sync_attendance.py
# run_sync_attendance.py
import asyncio
import logging
from app.sync_attendance import sync_attendance

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    """Run a one-time attendance sync for all devices."""
    try:
        response = await sync_attendance()
        logger.info(f"Attendance sync completed: {response}")
    except Exception as e:
        logger.error(f"Attendance sync failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())

