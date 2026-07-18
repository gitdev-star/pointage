# database.py
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://user:pass@postgres:5432/pointage_db"
)

_is_sqlite = DATABASE_URL.startswith("sqlite")
_extra = {} if _is_sqlite else {
    "pool_size": 20,
    "max_overflow": 40,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True,
    "connect_args": {
        "server_settings": {"statement_timeout": "300000"},
        "command_timeout": 300,
        "ssl": False,
    },
}
engine = create_async_engine(DATABASE_URL, echo=False, **_extra)


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
