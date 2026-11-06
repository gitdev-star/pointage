"""Assistant service: natural-language questions on attendance/HR data (reminders to come)."""
import logging

from fastapi import FastAPI

from app.routers.ai_assistant import router as assistant_router

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Assistant")
app.include_router(assistant_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
