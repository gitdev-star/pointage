import os
# main.py
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models.attendance import Base
from app.routers import attendance_routes, hr_routes
from app.routers.late_report import router as late_report_router
from app.routers.devices import router as devices_router
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from app.routers import adms_routes



logging.basicConfig(level=logging.DEBUG)

# Silence noisy third-party library internals while keeping our own code at DEBUG
for noisy_logger in ("httpx", "httpcore", "asyncio", "urllib3"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)

GLITCHTIP_DSN = os.environ.get("GLITCHTIP_DSN")
if GLITCHTIP_DSN:
    sentry_sdk.init(
        dsn=GLITCHTIP_DSN,
        integrations=[FastApiIntegration()],
        environment="fastapi",
        traces_sample_rate=0.1,
        send_default_pii=False,
        ca_certs="/etc/ssl/glitchtip/fullchain.pem",
        enable_logs=True,
    )

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 FastAPI starting...")
    if os.getenv("ENVIRONMENT") != "test":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database ready")
    logger.info("🎯 API is LIVE on :8080 — sync handled by sync_service.py")
    yield
    logger.info("🛑 API shutting down")

# ── CORS origins from environment ─────────────────────────────────────────────
_raw = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
CORS_ORIGINS = [o.strip() for o in _raw.split(",")]

app = FastAPI(
    title="HR Attendance Management System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

request_logger = logging.getLogger("request")


@app.middleware("http")
async def log_requests(request, call_next):
    import time
    if request.url.path == "/health":
        return await call_next(request)
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    request_logger.info(
        "%s %s -> %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

app.include_router(attendance_routes.router, prefix="/attendance")
app.include_router(hr_routes.router)
app.include_router(late_report_router)
app.include_router(devices_router)
app.include_router(adms_routes.router)

@app.get("/")
async def root():
    return {"status": "running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False, log_level="info")  # nosec B104 - binding to all interfaces is required inside Docker container