# app/devices/zk_reader.py
import asyncio
import logging
import zlib
from typing import List, Optional
from datetime import datetime
from functools import partial

from zoneinfo import ZoneInfo

from zk import ZK
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

logger = logging.getLogger(__name__)
YEAR_CUTOFF = 2026
LOCAL_TZ = ZoneInfo("Indian/Antananarivo")  # UTC+3, matches ZK devices


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
        loop = asyncio.get_running_loop()
        try:
            self.connection = await loop.run_in_executor(None, self.zk.connect)
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
        from sqlalchemy import select, func

        logs = await self.fetch_attendance_logs()
        if not logs:
            return 0

        # Watermark: never re-attempt a log older than or equal to the
        # max device_timestamp already recorded for this device. Prevents
        # manually-deleted rows from being silently re-inserted on the
        # next pull cycle.
        watermark_result = await db.execute(
            select(func.max(Attendance.device_timestamp)).where(
                Attendance.device_ip == self.device_ip
            )
        )
        watermark = watermark_result.scalar()

        values = []
        skipped_old = 0
        for log in logs:
            try:
                device_timestamp = log.timestamp
                if watermark is not None and device_timestamp <= watermark:
                    skipped_old += 1
                    continue

                user_id = int(log.user_id)
                uid = getattr(log, "uid", None)
                if uid is None:
                    uid = zlib.crc32(f"{user_id}-{device_timestamp.isoformat()}".encode()) % 2147483647
                else:
                    uid = int(uid)
                # Attach local tz so timestamptz stores the SAME wall-clock
                # numbers as device_timestamp, instead of asyncpg silently
                # assuming naive == UTC and shifting the display.
                localized_timestamp = device_timestamp.replace(tzinfo=LOCAL_TZ)
                values.append({
                    "uid": uid,
                    "user_id": user_id,
                    "device_timestamp": device_timestamp,
                    "date": device_timestamp.date(),
                    "device_ip": self.device_ip,
                    "timestamp": localized_timestamp,
                    # created_at intentionally omitted — DB sets it automatically
                })
            except Exception as e:
                logger.warning(f"[ZK] {self.device_ip} bad log skipped: {e}")

        logger.debug(f"[ZK] {self.device_ip} skipped {skipped_old} logs <= watermark {watermark}")

        if not values:
            return 0

        BATCH_SIZE = 500
        total_inserted = 0
        try:
            for i in range(0, len(values), BATCH_SIZE):
                chunk = values[i:i + BATCH_SIZE]
                stmt = insert(Attendance.__table__).values(chunk)
                stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "device_timestamp", "date"])
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

    # ----------------------------
    # Time sync device clockers and the server's reference time
    # ----------------------------
    async def _sync_time_attempt(self, target: datetime, use_disable_enable: bool):
        """
        One isolated attempt on a FRESH connection: connect, write target
        time, read back, disconnect. A fresh connection per attempt is
        required — reusing the same session for a retry after a failed
        write was found to make even a normally-working strategy silently
        fail (confirmed via diagnose_device_time.py).
        """
        await self.disconnect()
        await self.connect()
        conn = self.connection

        before = conn.get_time()
        if use_disable_enable:
            conn.disable_device()
        try:
            conn.set_time(target)
        finally:
            if use_disable_enable:
                conn.enable_device()

        await asyncio.sleep(1)
        after = conn.get_time()
        residual = abs((after - target).total_seconds())
        return before, after, residual

    async def sync_time(self, reference_time: Optional[datetime] = None) -> None:
        """
        Push reference_time onto this device's onboard clock.

        Different ZK platforms need different write strategies -- some
        only accept the write while active, others only while explicitly
        disabled -- so a plain set_time() is tried first, and
        disable_device()/enable_device() is used as a fallback only if
        the plain write didn't stick. Each attempt uses a fresh
        connection; retrying on the same session was found to make the
        fallback unreliable even on devices where it should otherwise work.

        If reference_time is not given, falls back to local system time
        (only safe if this server's clock is itself correctly synced).
        """
        try:
            target = reference_time or datetime.now()

            before, after, residual = await self._sync_time_attempt(target, use_disable_enable=False)
            drift = abs((before - target).total_seconds())
            strategy = "plain"

            if residual >= 2:
                before2, after, residual = await self._sync_time_attempt(target, use_disable_enable=True)
                strategy = "disable_enable"

            if residual >= 2:
                logger.warning(
                    f"[ZK] {self.device_ip} time sync had NO EFFECT with either strategy: "
                    f"before={before} target={target} after={after} (still off by {residual:.1f}s)"
                )
            else:
                logger.info(
                    f"[ZK] {self.device_ip} time synced via {strategy}: before={before} "
                    f"target={target} after={after} drift_corrected={drift:.1f}s residual={residual:.1f}s"
                )
        except Exception as e:
            logger.error(f"[ZK] {self.device_ip} time sync failed: {e}")
            raise
        
    # ----------------------------
    # Device info (serial, firmware, capacity)
    # ----------------------------
    async def get_device_info(self) -> dict:
        """
        Fetch static/near-static device metadata: serial, firmware,
        platform, MAC, plus current usage vs capacity (users, fingers,
        records, faces). Requires a live connection -- much heavier than
        a ping, so callers should cache this, not poll it every request.
        """
        if not self.connection:
            await self.connect()
        conn = self.connection
        loop = asyncio.get_running_loop()

        try:
            def _read():
                conn.read_sizes()
                return {
                    "serial_number": conn.get_serialnumber(),
                    "firmware_version": conn.get_firmware_version(),
                    "platform": conn.get_platform(),
                    "device_name": conn.get_device_name(),
                    "mac_address": conn.get_mac(),
                    "user_count": conn.users,
                    "user_capacity": conn.users_cap,
                    "fingerprint_count": conn.fingers,
                    "fingerprint_capacity": conn.fingers_cap,
                    "record_count": conn.records,
                    "record_capacity": conn.rec_cap,
                    "face_count": conn.faces,
                    "face_capacity": conn.faces_cap,
                }

            info = await loop.run_in_executor(None, _read)
            self.consecutive_errors = 0
            logger.debug(f"[ZK] {self.device_ip} device info: {info}")
            return info
        except Exception as e:
            self.consecutive_errors += 1
            logger.error(f"[ZK] {self.device_ip} get_device_info failed: {e}")
            if self.consecutive_errors >= 3:
                await self._force_cleanup()
            raise

    async def delete_user(self, device_user_id: int) -> bool:
        if not self.connection:
            await self.connect()
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, self.connection.disable_device)
            try:
                await loop.run_in_executor(
                    None, partial(self.connection.delete_user, user_id=str(device_user_id))
                )
            finally:
                await loop.run_in_executor(None, self.connection.enable_device)
            logger.info(f"[ZK] {self.device_ip} deleted device_user_id={device_user_id}")
            return True
        except Exception as e:
            logger.error(f"[ZK] {self.device_ip} delete_user failed for {device_user_id}: {e}")
            raise
        
