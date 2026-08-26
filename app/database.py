# database.py
import os
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()
logger = logging.getLogger(__name__)

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


# --------------------------------------------------
# SCHEMA SELF-HEAL
# --------------------------------------------------
# Base.metadata.create_all() only creates MISSING tables/columns — it
# never ALTERs an existing column. Any database created before the
# attendance.timestamp fix (server-side now() default, timezone-aware)
# needs this to actually apply the change. A brand-new database already
# gets it right straight from the Attendance model definition, so this
# is a no-op there. Postgres-only — skipped entirely on sqlite (used in
# tests), since ALTER COLUMN ... TYPE timestamptz has no sqlite equivalent
# and sqlite test DBs are always created fresh from the model anyway.
_ENSURE_ATTENDANCE_TIMESTAMP_SQL = text("""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance'
          AND column_name = 'timestamp'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE attendance
            ALTER COLUMN timestamp TYPE timestamptz USING timestamp AT TIME ZONE 'UTC';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance'
          AND column_name = 'timestamp'
          AND (column_default IS NULL OR column_default NOT LIKE 'now()%')
    ) THEN
        ALTER TABLE attendance ALTER COLUMN timestamp SET DEFAULT now();
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE attendance DROP COLUMN created_at;
    END IF;
END $$;
""")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if not _is_sqlite:
            await conn.execute(_ENSURE_ATTENDANCE_TIMESTAMP_SQL)
    logger.info("✅ Database ready (schema verified)")