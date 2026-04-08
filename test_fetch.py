import asyncio
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.attendance import Attendance

async def test_fetch():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Attendance).limit(5))
        records = result.scalars().all()
        print(f"Fetched {len(records)} records:")
        for r in records:
            print(r)

if __name__ == "__main__":
    asyncio.run(test_fetch())
