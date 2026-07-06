import os
# main.py
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models.attendance import Base
from app.routers import attendance_routes, hr_routes
from app.routers.late_report import router as late_report_router

logging.basicConfig(level=logging.INFO)
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

app.include_router(attendance_routes.router, prefix="/attendance")
app.include_router(hr_routes.router)
app.include_router(late_report_router)

@app.get("/")
async def root():
    return {"status": "running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False, log_level="info")