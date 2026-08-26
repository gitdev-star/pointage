#diagnose_device_time.py
"""
Focused diagnostic for a SINGLE ZKTeco device that silently ignores
set_time() (no exception, but the clock never actually changes).

Compares several write/read strategies against ONE device so we can see
which variable actually matters, instead of guessing across the whole
fleet. Run this against one device that failed (e.g. shows "NO EFFECT"
in sync_device_time.py) and, ideally, once against a device that
succeeded, for comparison.

Usage:
    docker cp diagnose_device_time.py fastapi:/app/diagnose_device_time.py
    docker exec -it fastapi python diagnose_device_time.py <ip> [port]

Example:
    docker exec -it fastapi python diagnose_device_time.py 192.168.1.227
"""

import sys
import time
from datetime import datetime, timedelta

from zk import ZK

PORT = 4370
TIMEOUT = 10


def fresh_connect(ip: str, port: int):
    zk = ZK(ip, port=port, timeout=TIMEOUT, force_udp=False, ommit_ping=False)
    conn = zk.connect()
    return zk, conn


def safe_disconnect(conn):
    try:
        if conn:
            conn.disconnect()
    except Exception:
        pass


def print_device_info(conn):
    print("  --- Device info ---")
    for attr, label in [
        ("get_firmware_version", "Firmware version"),
        ("get_device_name", "Device name"),
        ("get_platform", "Platform"),
        ("get_serialnumber", "Serial number"),
        ("get_mac", "MAC address"),
    ]:
        try:
            fn = getattr(conn, attr, None)
            if fn:
                print(f"  {label}: {fn()}")
        except Exception as e:
            print(f"  {label}: <failed: {e!r}>")
    print("  -------------------")


def attempt(label: str, ip: str, port: int, target: datetime, use_disable_enable: bool,
            reconnect_before_read: bool, delay: float):
    """One isolated attempt: connect, write target time, read back, report."""
    print(f"\n[{label}]")
    print(f"  disable/enable={use_disable_enable}  reconnect_before_read={reconnect_before_read}  delay={delay}s")

    zk = conn = None
    try:
        zk, conn = fresh_connect(ip, port)

        before = conn.get_time()

        if use_disable_enable:
            conn.disable_device()
        try:
            conn.set_time(target)
        finally:
            if use_disable_enable:
                conn.enable_device()

        time.sleep(delay)

        if reconnect_before_read:
            safe_disconnect(conn)
            zk2, conn2 = fresh_connect(ip, port)
            zk, conn = zk2, conn2

        after = conn.get_time()

        residual = abs((after - target).total_seconds())
        moved = abs((after - before).total_seconds())

        print(f"  before  = {before}")
        print(f"  target  = {target}")
        print(f"  after   = {after}")
        print(f"  residual_from_target = {residual:.1f}s")
        print(f"  moved_from_before    = {moved:.1f}s")

        if residual < 2:
            print("  RESULT: ✅ applied (after matches target)")
        else:
            print("  RESULT: ❌ NO EFFECT (after does not match target)")

        return {"label": label, "before": str(before), "after": str(after),
                "residual": round(residual, 1), "applied": residual < 2}

    except Exception as e:
        print(f"  RESULT: ⚠️  ERROR: {e!r}")
        return {"label": label, "error": repr(e), "applied": False}
    finally:
        safe_disconnect(conn)


def main():
    if len(sys.argv) < 2:
        print("Usage: python diagnose_device_time.py <ip> [port]")
        sys.exit(1)

    ip = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else PORT

    print(f"=== Diagnosing {ip}:{port} ===")

    # Baseline connection + device identity, so we can compare a
    # failing device against a working one.
    zk = conn = None
    try:
        zk, conn = fresh_connect(ip, port)
        print_device_info(conn)
    except Exception as e:
        print(f"Could not connect at all: {e!r}")
        sys.exit(1)
    finally:
        safe_disconnect(conn)

    results = []

    # Use a target time clearly offset from "now" so a real change is
    # unambiguous (not just normal clock ticking).
    target = datetime.now() + timedelta(minutes=5)

    # Strategy A: exactly what sync_device_time.py currently does
    # (disable/enable, 1s delay, same connection for read-back).
    results.append(attempt(
        "A: disable/enable + 1s delay + same connection",
        ip, port, target,
        use_disable_enable=True, reconnect_before_read=False, delay=1.0,
    ))

    time.sleep(2)

    # Strategy B: no disable/enable at all -- raw set_time, same
    # connection, 1s delay. Tests whether disable/enable is actually
    # helping or possibly interfering.
    results.append(attempt(
        "B: no disable/enable + 1s delay + same connection",
        ip, port, target,
        use_disable_enable=False, reconnect_before_read=False, delay=1.0,
    ))

    time.sleep(2)

    # Strategy C: disable/enable + longer delay (5s) + same connection.
    # Tests whether the device just needs more time to commit.
    results.append(attempt(
        "C: disable/enable + 5s delay + same connection",
        ip, port, target,
        use_disable_enable=True, reconnect_before_read=False, delay=5.0,
    ))

    time.sleep(2)

    # Strategy D: disable/enable + short delay + FRESH reconnect before
    # reading back. Tests whether the read is the problem (stale
    # in-session cache) rather than the write.
    results.append(attempt(
        "D: disable/enable + 1s delay + reconnect before read",
        ip, port, target,
        use_disable_enable=True, reconnect_before_read=True, delay=1.0,
    ))

    print("\n=== Summary ===")
    for r in results:
        status = "✅ applied" if r.get("applied") else ("⚠️ error" if "error" in r else "❌ no effect")
        print(f"  {r['label']}: {status}")

    if not any(r.get("applied") for r in results):
        print("\nNone of the strategies worked on this device.")
        print("This points to a firmware/model-specific quirk beyond simple")
        print("disable/enable/delay/reconnect tuning -- worth checking the")
        print("device's own menu for a 'lock time' / 'NTP managed' setting,")
        print("or comparing get_platform()/get_firmware_version() output")
        print("against a device that DID sync successfully.")


if __name__ == "__main__":
    main()