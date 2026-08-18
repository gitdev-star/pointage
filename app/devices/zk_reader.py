# app/devices/zk_reader.py
import logging
import zlib
from typing import List

from zk import ZK
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

logger = logging.getLogger(__name__)
YEAR_CUTOFF = 2026


class ZKReader:
    """
    Thin, safe ZK device wrapper.
    - Fetch logs latest-first
    - Only fetch logs from YEAR_CUTOFF onward
    - DB owned by caller
    - Lifecycle controlled by main.py
    """

    def __init__(self, device_ip: str, device_port: int = 4370, timeout: int = 10):
        self.device_ip = device_ip
        self.device_port = device_port
        self.timeout = timeout
        self.zk = ZK(self.device_ip, port=self.device_port, timeout=self.timeout, password=0)
        self.connection = None
        self.consecutive_errors = 0

    # ----------------------------
    # Connection management
    # ----------------------------
    async def connect(self) -> None:
        if self.connection:
            return
        try:
            self.connection = self.zk.connect()
            logger.debug(f"[ZK] Connected to {self.device_ip}")
        except Exception as e:
            self.connection = None
            raise RuntimeError(f"Connection failed to {self.device_ip}: {e}")

    async def disconnect(self) -> None:
        if self.connection:
            try:
                self.connection.disconnect()
            except Exception:
                pass
            finally:
                self.connection = None
                logger.debug(f"[ZK] Disconnected from {self.device_ip}")

    async def _force_cleanup(self) -> None:
        """Hard reset device connection"""
        await self.disconnect()
        self.consecutive_errors = 0

    async def force_reset(self) -> None:
        """Called by daily reset task"""
        logger.warning(f"[ZK] Force reset for {self.device_ip}")
        await self._force_cleanup()

    # ----------------------------
    # Attendance fetching
    # ----------------------------
    async def fetch_attendance_logs(self, since_year: int = YEAR_CUTOFF) -> List:
        if not self.connection:
            await self.connect()
        try:
            logs = self.zk.get_attendance() or []
            logs = list(reversed(logs))  # latest logs first
            logs = [log for log in logs if log.timestamp.year >= since_year]
            self.consecutive_errors = 0
            logger.debug(f"[ZK] {self.device_ip} fetched {len(logs)} logs since {since_year}")
            return logs
        except Exception as e:
            self.consecutive_errors += 1
            logger.error(f"[ZK] {self.device_ip} fetch error ({self.consecutive_errors}): {e}")
            if self.consecutive_errors >= 3:
                await self._force_cleanup()
            raise

    # ----------------------------
    # Processing logs (bulk insert)
    # ----------------------------
    async def process_logs(self, db: AsyncSession) -> int:
        """
        Fetch + persist logs in bulk.
        Returns number of saved records.
        """
        from app.models.attendance import Attendance

        logs = await self.fetch_attendance_logs()
        if not logs:
            return 0

        values = []
        for log in logs:
            try:
                user_id = int(log.user_id)
                timestamp = log.timestamp
                uid = getattr(log, "uid", None)
                if uid is None:
                    # Same overflow-safe synthesis as adms_routes.py —
                    # uid column is int32, naive concatenation overflows it.
                    uid = zlib.crc32(f"{user_id}-{timestamp.isoformat()}".encode()) % 2147483647
                else:
                    uid = int(uid)
                values.append({
                    "uid": uid,
                    "user_id": user_id,
                    "timestamp": timestamp,
                    "date": timestamp.date(),
                    "device_ip": self.device_ip,
                })
            except Exception as e:
                logger.warning(f"[ZK] {self.device_ip} bad log skipped: {e}")

        if not values:
            return 0

        BATCH_SIZE = 500
        total_inserted = 0
        try:
            for i in range(0, len(values), BATCH_SIZE):
                chunk = values[i:i + BATCH_SIZE]
                stmt = insert(Attendance.__table__).values(chunk)
                stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "timestamp", "date"])
                await db.execute(stmt)
                await db.commit()
                total_inserted += len(chunk)
                logger.debug(f"[ZK] {self.device_ip} inserted {total_inserted}/{len(values)} logs")
            logger.debug(f"[ZK] {self.device_ip} inserted {total_inserted}/{len(values)} logs total")
            return total_inserted
        except Exception as e:
            logger.error(f"[ZK] {self.device_ip} bulk insert failed: {e!r}", exc_info=True)
            await db.rollback()
            return 0
