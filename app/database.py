# database.py
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://user:pass@postgres:5432/pointage_db"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # was True — was logging every query to stdout
    pool_size=20,        # up from default 5 — handles 100 concurrent users
    max_overflow=40,     # allows burst up to 60 total connections
    pool_timeout=30,     # wait max 30s for a free connection before error
    pool_recycle=1800,   # recycle connections every 30min to avoid stale ones
    pool_pre_ping=True,  # test connection before using it (avoids dead conn errors)
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
