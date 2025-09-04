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
from app.routers import attendance_routes
from app.models.attendance import Base

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variable to store background task references
background_tasks = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("FastAPI app starting...")

    # Create database tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    # Start background sync
    logger.info("Initializing background sync...")
    try:
        task = asyncio.create_task(fetch_attendance_logs())
        background_tasks["sync_task"] = task
        logger.info("Background sync started!")
    except Exception as e:
        logger.error(f"Failed to start background sync: {e}")

    yield

    # Shutdown
    logger.info("FastAPI app shutting down...")

    # Cancel background tasks
    for task_name, task in background_tasks.items():
        if not task.done():
            logger.info(f"Cancelling {task_name}...")
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                logger.info(f"{task_name} cancelled")

    logger.info("Shutdown complete")


# Create FastAPI app with lifespan manager
app = FastAPI(
    title="HR Attendance Management System",
    description="Advanced attendance management system with ZK device integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS setup for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
   #     "http://localhost:3000",
  #      "http://localhost:3001",
        "http://127.0.0.1:3000",
   #     "http://127.0.0.1:3001",
    #    "http://127.0.0.1:8001",
        "http://192.168.8.247:8000",
        "*"  # Allow all origins for development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount attendance router with prefix
app.include_router(attendance_routes.router, prefix="/attendance", tags=["Attendance"])
logger.info("Attendance router mounted at /attendance")


# Background task functions
async def fetch_attendance_from_device(device_ip: str) -> None:
    """Fetch attendance logs from a specific device"""
    zk_reader = ZKReader(device_ip=device_ip)
    connection_retries = 0
    max_retries = 5

    while connection_retries < max_retries:
        try:
            await zk_reader.connect()
            logger.info(f"Connected to device {device_ip}")
            break
        except Exception as e:
            connection_retries += 1
            logger.error(f"Failed to connect to device {device_ip} (attempt {connection_retries}): {e}")
            if connection_retries >= max_retries:
                logger.error(f"Max retries reached for device {device_ip}, skipping...")
                return
            await asyncio.sleep(30)  # Wait before retry

    # Main sync loop
    consecutive_errors = 0
    max_consecutive_errors = 10

    while consecutive_errors < max_consecutive_errors:
        try:
            async with AsyncSessionLocal() as db:
                logger.info(f"Fetching logs from {device_ip}...")

                attendance_data = await zk_reader.fetch_attendance_logs()

                if attendance_data:
                    logger.info(f"{len(attendance_data)} logs found on {device_ip}")
                    await zk_reader.process_logs(db)
                    consecutive_errors = 0  # Reset error counter on success
                else:
                    logger.info(f"No new logs from {device_ip}")

        except Exception as e:
            consecutive_errors += 1
            logger.error(f"Error processing {device_ip} (error {consecutive_errors}): {e}")

            # Try to rollback the session if it exists
            try:
                if 'db' in locals():
                    await db.rollback()
            except:
                pass

        # Wait before next sync
        await asyncio.sleep(10)

    logger.error(f"Too many consecutive errors for device {device_ip}, stopping sync")


async def fetch_attendance_logs() -> None:
    """Main function to coordinate attendance log fetching from all devices"""
    if not device_ips:
        logger.warning("No device IPs configured!")
        return

    logger.info(f"Starting sync for {len(device_ips)} devices: {device_ips}")

    # Create tasks for each device
    tasks = []
    for ip in device_ips:
        task = asyncio.create_task(
            fetch_attendance_from_device(ip),
            name=f"sync_{ip.replace('.', '_')}"
        )
        tasks.append(task)

    # Store tasks for cleanup during shutdown
    for i, task in enumerate(tasks):
        background_tasks[f"device_sync_{i}"] = task

    try:
        # Run all device sync tasks concurrently
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"Critical sync error: {e}")


# API Routes
@app.get("/")
async def root():
    """Root endpoint with system information"""
    return {
        "message": "HR Attendance Management System",
        "status": "running",
        "version": "1.0.0",
        "devices_configured": len(device_ips),
        "device_ips": device_ips,
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "attendance": "/attendance",
            "attendance_records": "/attendance/",
            "attendance_minimal": "/attendance/minimal",
            "attendance_stats": "/attendance/stats"
        }
    }


@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    try:
        # Check database connection
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))

        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # Check background tasks
    active_tasks = sum(1 for task in background_tasks.values() if not task.done())

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": asyncio.get_event_loop().time(),
        "services": {
            "database": db_status,
            "background_sync": f"{active_tasks} active tasks",
            "devices_configured": len(device_ips)
        },
        "device_ips": device_ips,
        "background_tasks": {
            name: "running" if not task.done() else "completed"
            for name, task in background_tasks.items()
        }
    }


@app.get("/devices/status")
async def get_device_status():
    """Get status of all configured devices"""
    device_status = []

    for ip in device_ips:
        try:
            # You can implement actual status checking here
            device_status.append({
                "ip": ip,
                "status": "configured",
                "last_check": asyncio.get_event_loop().time()
            })
        except Exception as e:
            device_status.append({
                "ip": ip,
                "status": "error",
                "error": str(e),
                "last_check": asyncio.get_event_loop().time()
            })

    return {
        "total_devices": len(device_ips),
        "devices": device_status
    }


@app.get("/sync/restart")
async def restart_sync():
    """Manually restart the background sync (admin endpoint)"""
    try:
        # Cancel existing sync tasks
        for task_name, task in background_tasks.items():
            if task_name.startswith("sync") and not task.done():
                task.cancel()

        # Start new sync task
        task = asyncio.create_task(fetch_attendance_logs())
        background_tasks["manual_sync_task"] = task

        return {
            "message": "Background sync restarted",
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to restart sync: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting HR Attendance Management System...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )