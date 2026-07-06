import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

"""
Pytest configuration for FastAPI tests.
Provides fixtures for async database and HTTP client testing.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.routers import attendance_routes, hr_routes
from app.routers.late_report import router as late_report_router
from main import app


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def test_session(test_engine):
    """Create a test database session with rollback after each test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        yield session
        await session.close()
        await conn.rollback()


@pytest.fixture
async def test_client(test_session):
    """Create a test HTTP client."""
    from httpx import ASGITransport, AsyncClient
    from app.database import get_async_db

    # Override the database dependency to use test session
    async def override_get_async_db():
        yield test_session

    app.dependency_overrides[get_async_db] = override_get_async_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
async def mock_jwt_user():
    """Mock JWT user payload."""
    return {
        "user_id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "iat": 1234567890,
        "exp": 9999999999,
    }


@pytest.fixture
async def auth_headers(mock_jwt_user):
    """Generate mock authorization headers."""
    import jwt
    from app.auth.django_auth import DJANGO_SECRET, ALGORITHM

    token = jwt.encode(mock_jwt_user, DJANGO_SECRET, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="session", autouse=True)
async def cleanup_engine():
    """Dispose engine after all tests to prevent hang on exit."""
    yield
    from app.database import engine
    await engine.dispose()

def pytest_sessionfinish(session, exitstatus):
    """Force-kill any remaining threads after session ends."""
    import asyncio
    from app.database import engine
    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(engine.dispose())
        loop.close()
    except Exception:
        pass


@pytest.fixture(scope="session", autouse=True)
def cleanup_engine():
    """Dispose SQLAlchemy engine after all tests to prevent hanging."""
    yield
    import asyncio
    from app.database import engine
    asyncio.get_event_loop().run_until_complete(engine.dispose())