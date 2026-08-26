#sync_device_time.py
"""
Synchronize the onboard clock of every active ZKTeco device to match
the correct time on the database server.

Time source: SELECT NOW() from Postgres directly — same source
sync_service.py uses, so manual runs always match the automated service.

Device list: fetched live from the Django API via fetch_active_devices()
(sync_service.py) — no hardcoded devices, always reflects current state.

Write strategy: plain set_time() is tried first, on a fresh connection.
If that doesn't stick, a SECOND fresh connection is opened and the write
is retried wrapped in disable_device()/enable_device(). Different ZK
platforms need different approaches, and retrying on the SAME connection
after a failed write was found to make even a normally-working strategy
silently fail — so each attempt always starts from a clean session.

Contention warning: this script runs as a SEPARATE OS PROCESS from the
`sync` service (sync_service.py / attendance_sync container), which is
continuously connecting to the same devices. ZK devices only support one
active session at a time, so running both concurrently can make writes
silently fail on whichever process loses the race for a given device --
confirmed empirically (same device flips between success/failure across
runs purely based on whether `sync` was running at the time).
Before touching any devices, this script checks whether any device has
pushed data recently (DeviceSyncState.last_push_at) as a proxy for
"the sync service looks active right now" and warns loudly if so.
Use --force to proceed anyway, or stop the service first:
    docker compose stop sync
    docker exec -it fastapi python sync_device_time.py
    docker compose start sync

Usage (inside the fastapi container, or wherever pyzk + device network
access is available):
    docker cp sync_device_time.py fastapi:/app/sync_device_time.py
    docker exec -it fastapi python sync_device_time.py [--force]
"""

import argparse
import asyncio
import json
from datetime import datetime, timezone
import time

from zk import ZK  # same SDK used in zk_reader.py

TIMEOUT = 10
# How recently a device must have pushed for us to consider the sync
# service "active right now" -- mirrors PUSH_ACTIVE_WINDOW in
# sync_service.py, but here it's used purely as a liveness signal for
# the service itself, not per-device push-health.
SERVICE_ACTIVITY_WINDOW_SECONDS = 180

LOG_PATH = f"/app/time_sync_result_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"


async def get_reference_time() -> datetime:
    """Authoritative time sourced from the database server via SQL NOW() —
    same source sync_service.py uses, so both stay consistent."""
    from app.database import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT NOW()"))
        ref_time = result.scalar().replace(tzinfo=None)
        print(f"Got reference time from DB: {ref_time}")
        return ref_time


async def get_device_list():
    """Dynamic active-device list, sourced from the same Django API
    that sync_service.py uses (via fetch_active_devices). No hardcoded fallback —
    if this fails, the run fails loudly instead of silently syncing stale devices."""
    from sync_service import fetch_active_devices
    devices = await fetch_active_devices()
    if not devices:
        raise RuntimeError("No active devices returned from Django API — aborting sync.")
    return devices


async def check_service_activity() -> bool:
    """
    Best-effort check for whether the `sync` service looks like it's
    actively running right now, using recent push activity as a proxy.
    Returns True if activity looks recent (contention likely), False
    if it looks quiet or the check itself fails (fail-open — a failed
    check shouldn't block a manual run, it's just advisory).
    """
    try:
        from app.database import AsyncSessionLocal
        from app.models.device_sync import DeviceSyncState
        from sqlalchemy import select, func

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(func.max(DeviceSyncState.last_push_at)))
            most_recent = result.scalar()
            if most_recent is None:
                return False
            now = datetime.now(timezone.utc)
            age = (now - most_recent.astimezone(timezone.utc)).total_seconds()
            return age < SERVICE_ACTIVITY_WINDOW_SECONDS
    except Exception as e:
        print(f"(Could not check service activity: {e!r} — proceeding without this check.)")
        return False


def _attempt(ip: str, port: int, target: datetime, use_disable_enable: bool):
    """One isolated attempt on a FRESH connection: connect, write target
    time, read back, disconnect. A fresh connection per attempt is
    required — reusing the same session for a retry after a failed write
    was found to make even a normally-working strategy silently fail."""
    zk = ZK(ip, port=port, timeout=TIMEOUT, force_udp=False, ommit_ping=False)
    conn = None
    try:
        conn = zk.connect()
        before = conn.get_time()

        if use_disable_enable:
            conn.disable_device()
        try:
            conn.set_time(target)
        finally:
            if use_disable_enable:
                conn.enable_device()

        time.sleep(1)
        after = conn.get_time()
        residual = abs((after - target).total_seconds())
        return before, after, residual
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def sync_one_device(ip: str, port: int, reference_time: datetime):
    """
    Try plain set_time() first on a fresh connection. If that doesn't
    stick, open a NEW fresh connection and retry wrapped in
    disable_device()/enable_device(). Reports which strategy (if any)
    actually worked.
    """
    try:
        before, after, residual = _attempt(ip, port, reference_time, use_disable_enable=False)
        drift_seconds = abs((before - reference_time).total_seconds())
        strategy_used = "plain"

        if residual >= 2:
            before2, after, residual = _attempt(ip, port, reference_time, use_disable_enable=True)
            strategy_used = "disable_enable"

        applied = residual < 2

        return {
            "status": "synced" if applied else "no_effect",
            "strategy": strategy_used,
            "before": str(before),
            "after": str(after),
            "drift_before_seconds": round(drift_seconds, 1),
            "residual_drift_seconds": round(residual, 1),
        }
    except Exception as e:
        return {"status": "error", "error": repr(e)}


async def main():
    parser = argparse.ArgumentParser(description="Manually sync ZK device clocks.")
    parser.add_argument(
        "--force", action="store_true",
        help="Proceed even if the `sync` service looks currently active (risk of contention).",
    )
    args = parser.parse_args()

    service_looks_active = await check_service_activity()
    if service_looks_active and not args.force:
        print(
            "\n⚠️  WARNING: the `sync` service (attendance_sync) looks ACTIVE right now "
            f"(a device pushed within the last {SERVICE_ACTIVITY_WINDOW_SECONDS}s).\n"
            "Running this script while `sync` is active can cause writes to silently\n"
            "fail on some devices due to socket contention (confirmed empirically).\n\n"
            "Recommended: stop the service first, then run this script, then restart it:\n"
            "    docker compose stop sync\n"
            "    docker exec -it fastapi python sync_device_time.py\n"
            "    docker compose start sync\n\n"
            "Or re-run with --force to proceed anyway (not recommended for a fleet-wide sync).\n"
        )
        return
    elif service_looks_active and args.force:
        print("⚠️  Service looks active, but --force was passed — proceeding anyway.\n")

    reference_time = await get_reference_time()
    devices = await get_device_list()

    print(f"\nSyncing {len(devices)} device(s) to {reference_time}...\n")

    report = {}
    for i, (ip, port) in enumerate(devices, start=1):
        print(f"[{i}/{len(devices)}] {ip} ...")
        result = sync_one_device(ip, port, reference_time)
        report[ip] = result

        if result["status"] == "synced":
            print(f"    before={result['before']} (drift {result['drift_before_seconds']}s) -> after={result['after']} (residual {result['residual_drift_seconds']}s) [{result['strategy']}]")
        elif result["status"] == "no_effect":
            print(f"    NO EFFECT: before={result['before']} (drift {result['drift_before_seconds']}s) -> after={result['after']} (residual {result['residual_drift_seconds']}s) -- write did not apply with either strategy")
        else:
            print(f"    ERROR: {result['error']}")

    with open(LOG_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)

    synced = [ip for ip, r in report.items() if r["status"] == "synced"]
    no_effect = [ip for ip, r in report.items() if r["status"] == "no_effect"]
    failed = [ip for ip, r in report.items() if r["status"] == "error"]
    big_drift = [ip for ip, r in report.items() if r["status"] in ("synced", "no_effect") and r["drift_before_seconds"] > 60]

    print("\n--- Summary ---")
    print(f"Synced: {len(synced)}/{len(devices)}")
    if no_effect:
        print(f"Write had NO EFFECT ({len(no_effect)}): {no_effect}")
        print("(If `sync` was running during this pass, re-run after stopping it —")
        print(" NO EFFECT devices are often contention, not a real device issue.)")
    if big_drift:
        print(f"Devices that had >60s drift before sync: {big_drift}")
    if failed:
        print(f"Failed to sync ({len(failed)}): {failed}")
    print(f"\nFull report written to {LOG_PATH}")


if __name__ == "__main__":
    asyncio.run(main())