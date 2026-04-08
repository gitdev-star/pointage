# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from contextlib import asynccontextmanager

# Import your modules
from app.devices.zk_reader import ZKReader
from app.database import AsyncSessionLocal, engine
from app.sync_attendance import device_ips
from app.models.attendance import Base

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variable for background tasks
background_tasks = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan manager"""
    # Startup
    logger.info("🔧 FastAPI app starting...")

    # Create database tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created/verified")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    # Start background sync
    logger.info("🕒 Initializing background sync...")
    try:
        task = asyncio.create_task(fetch_attendance_logs())
        background_tasks["sync_task"] = task
        logger.info("✅ Background sync started!")
    except Exception as e:
        logger.error(f"❌ Failed to start background sync: {e}")

    yield

    # Shutdown
    logger.info("🛑 FastAPI app shutting down...")
    for task_name, task in background_tasks.items():
        if not task.done():
            task.cancel()
    logger.info("✅ Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="HR Attendance Management System",
    description="Attendance management with ZK device integration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Be more specific in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and mount router
try:
    from app.routers.attendance_routes import router as attendance_router

    app.include_router(attendance_router, prefix="/api/attendance", tags=["Attendance"])
    logger.info("✅ Attendance router mounted at /api/attendance")
except Exception as e:
    logger.error(f"❌ Failed to mount attendance router: {e}")


# Background sync functions
async def fetch_attendance_from_device(device_ip: str):
    """Fetch attendance from a specific device"""
    zk_reader = ZKReader(device_ip=device_ip)

    try:
        await zk_reader.connect()
        logger.info(f"✅ Connected to device {device_ip}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to device {device_ip}: {e}")
        return

    while True:
        try:
            async with AsyncSessionLocal() as db:
                logger.info(f"🔄 Fetching logs from {device_ip}...")
                attendance_data = await zk_reader.fetch_attendance_logs()

                if attendance_data:
                    logger.info(f"📥 {len(attendance_data)} logs found on {device_ip}")
                    await zk_reader.process_logs(db)
                else:
                    logger.info(f"📭 No new logs from {device_ip}")

        except Exception as e:
            logger.error(f"⚠️ Error processing {device_ip}: {e}")
            try:
                await db.rollback()
            except:
                pass

        await asyncio.sleep(10)


async def fetch_attendance_logs():
    """Main sync coordinator"""
    logger.info(f"🚀 Starting sync for {len(device_ips)} devices: {device_ips}")

    tasks = [fetch_attendance_from_device(ip) for ip in device_ips]

    try:
        await asyncio.gather(*tasks)
    except Exception as e:
        logger.error(f"🔥 Sync error: {e}")


# Main app routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "HR Attendance Management System",
        "status": "running",
        "version": "1.0.0",
        "devices_configured": len(device_ips),
        "device_ips": device_ips,
        "api_endpoints": {
            "docs": "/docs",
            "health": "/health",
            "attendance_api": "/api/attendance",
            "attendance_records": "/api/attendance/records",
            "attendance_stats": "/api/attendance/stats"
        }
    }


@app.get("/health")
async def health_check():
    """Main health check"""
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.now(),
        "database": db_status,
        "devices_configured": len(device_ips),
        "device_ips": device_ips
    }


@app.get("/devices")
async def get_devices():
    """Get configured devices"""
    return {
        "total_devices": len(device_ips),
        "device_ips": device_ips,
        "status": "configured"
    }


# Debug route to show all routes
@app.get("/debug/routes")
async def debug_routes():
    """Debug endpoint to show all available routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'unnamed')
            })

    return {
        "total_routes": len(routes),
        "routes": routes
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)