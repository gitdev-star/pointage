# run_sync_attendance.py
import asyncio
from app.sync_attendance import sync_attendance
from app.database import AsyncSessionLocal

# Main function to run the attendance sync
async def main():
    # Get a database session
    async with AsyncSessionLocal() as db:
        # Sync attendance
        response = await sync_attendance(db)
        print(response)

# Run the sync process
if __name__ == "__main__":
    asyncio.run(main())  # Only run async operations
