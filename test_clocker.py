"""
clocker_time_daemon.py

Dynamic ZKTeco clock time synchronization.

Devices are NOT hardcoded.

The device list is retrieved dynamically from Django:

    https://192.168.8.217/api/clockers/

Only active devices are synchronized.

For every device:

    BEFORE
       ↓
    disable_device()
       ↓
    set_time()
       ↓
    enable_device()
       ↓
    AFTER

The IP address and port come from Django.

This daemon runs directly on the Linux host through systemd,
NOT inside Docker.

Because the current Nginx HTTPS certificate is self-signed,
the Django API request currently uses:

    verify=False

For production, replace this with proper certificate
verification once the internal CA/certificate is configured.

Run:

    python3 clocker_time_daemon.py
"""

import logging
import os
import socket
import threading
import time
from datetime import datetime
from typing import Dict, List, Tuple

import httpx
from zk import ZK


# ============================================================
# CONFIG
# ============================================================

# IMPORTANT:
# This is the Django/Nginx SERVER address.
#
# It is NOT a ZKTeco device IP.
#
# ZKTeco device IPs are obtained dynamically from:
#
#     /api/clockers/
#
CLOCKERS_API_URL = os.getenv(
    "CLOCKERS_API_URL",
    "https://192.168.8.217/api/clockers/"
)


# Default ZKTeco port.
# Django can override this if a device has another port.
DEVICE_PORT_DEFAULT = 4370


# How often each connected device gets its time synchronized.
SYNC_INTERVAL_SECONDS = 30


# How long to wait before trying an unreachable device again.
RECONNECT_INTERVAL_SECONDS = 5


# How often to ask Django for the current device list.
#
# This means newly added/activated devices are discovered
# within approximately 5 minutes.
DEVICE_REFRESH_INTERVAL_SECONDS = 300


# Maximum accepted difference between server time and
# device time after set_time().
TIME_TOLERANCE_SECONDS = 3


# ============================================================
# DEVICE BEHAVIOR
# ============================================================

# Your MB360 test showed that the device required:
#
#     disable_device()
#     set_time()
#     enable_device()
#
# Therefore this is currently enabled for all discovered
# devices.
#
# IMPORTANT:
# This is NOT related to any IP address.
#
# If later you have different ZKTeco models with different
# requirements, this should ideally come from Django.
REQUIRES_DISABLE_DEFAULT = True


# ============================================================
# HTTPS
# ============================================================

# Your current Nginx certificate is self-signed.
#
# Therefore httpx would normally fail with:
#
#     CERTIFICATE_VERIFY_FAILED
#
# Keep this True for the current TEST environment.
#
# For production, use the proper CA/certificate instead.
VERIFY_DJANGO_SSL = False


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(threadName)s] %(message)s",
)

log = logging.getLogger("clocker_daemon")


# ============================================================
# DEVICE TASK STORAGE
# ============================================================

# One synchronization thread per device.
#
# Example:
#
#     {
#         "192.168.8.13:4370": Thread(...),
#         "192.168.8.14:4370": Thread(...),
#     }
#
device_threads: Dict[str, threading.Thread] = {}


# Stop events for each device thread.
device_stop_events: Dict[str, threading.Event] = {}


# Lock protecting the dictionaries above.
device_threads_lock = threading.Lock()


# ============================================================
# FETCH DEVICES FROM DJANGO
# ============================================================

def fetch_active_devices() -> List[Tuple[str, int]]:
    """
    Fetch active ZKTeco devices from Django.

    The daemon does NOT contain ZKTeco IP addresses.

    Django should return something similar to:

        [
            {
                "ip_address": "192.168.8.13",
                "port": 4370,
                "is_active": true
            },
            {
                "ip_address": "192.168.8.14",
                "port": 4370,
                "is_active": true
            }
        ]

    Returns:

        [
            ("192.168.8.13", 4370),
            ("192.168.8.14", 4370)
        ]
    """

    try:

        log.info(
            f"📡 Fetching devices from Django: "
            f"{CLOCKERS_API_URL}"
        )

        response = httpx.get(
            CLOCKERS_API_URL,
            timeout=10,
            verify=VERIFY_DJANGO_SSL,
        )

        response.raise_for_status()

        devices = response.json()

        if not isinstance(devices, list):

            log.error(
                "❌ Django API did not return a list"
            )

            return []

        active_devices: List[Tuple[str, int]] = []

        for device in devices:

            if not isinstance(device, dict):

                log.warning(
                    f"⚠️ Invalid device entry ignored: "
                    f"{device}"
                )

                continue

            # -----------------------------------------------
            # ACTIVE CHECK
            # -----------------------------------------------

            if not device.get("is_active", True):

                continue

            # -----------------------------------------------
            # IP ADDRESS
            # -----------------------------------------------

            ip = device.get("ip_address")

            if not ip:

                log.warning(
                    f"⚠️ Device without ip_address "
                    f"ignored: {device}"
                )

                continue

            # -----------------------------------------------
            # PORT
            # -----------------------------------------------

            port = device.get(
                "port",
                DEVICE_PORT_DEFAULT,
            )

            try:

                port = int(port)

            except (TypeError, ValueError):

                log.warning(
                    f"[{ip}] Invalid port "
                    f"{port!r}; using "
                    f"{DEVICE_PORT_DEFAULT}"
                )

                port = DEVICE_PORT_DEFAULT

            active_devices.append(
                (ip, port)
            )

        log.info(
            f"📡 Django returned "
            f"{len(active_devices)} active device(s)"
        )

        # Log discovered devices.
        for ip, port in active_devices:

            log.info(
                f"   └── {ip}:{port}"
            )

        return active_devices

    except httpx.ConnectError as e:

        log.error(
            f"❌ Cannot connect to Django/Nginx: {e}"
        )

        return []

    except httpx.HTTPStatusError as e:

        log.error(
            f"❌ Django API returned HTTP "
            f"{e.response.status_code}: {e}"
        )

        return []

    except httpx.RequestError as e:

        log.error(
            f"❌ Django API request failed: {e}"
        )

        return []

    except Exception as e:

        log.error(
            f"❌ Failed to fetch devices from Django: "
            f"{e}"
        )

        return []


# ============================================================
# GET SERVER TIME
# ============================================================

def get_server_time() -> datetime:
    """
    Get the time used to synchronize ZKTeco devices.

    Currently this uses the Linux server's local clock.

    The returned value is naive because the ZKTeco library
    expects a naive datetime.
    """

    return datetime.now().replace(
        microsecond=0
    )


# ============================================================
# DEVICE REACHABILITY
# ============================================================

def is_reachable(
    ip: str,
    port: int,
    timeout: int = 3,
) -> bool:
    """
    Check whether a ZKTeco device is reachable
    on its configured IP and port.
    """

    try:

        with socket.create_connection(
            (ip, port),
            timeout,
        ):

            return True

    except Exception:

        return False


# ============================================================
# SYNCHRONIZE ONE DEVICE
# ============================================================

def sync_device_loop(
    ip: str,
    port: int,
    stop_event: threading.Event,
):
    """
    Continuously synchronize one dynamically discovered
    ZKTeco device.
    """

    device_name = f"{ip}:{port}"

    log.info(
        f"[{device_name}] "
        f"🔄 Starting synchronization loop"
    )

    while not stop_event.is_set():

        # ====================================================
        # REACHABILITY
        # ====================================================

        if not is_reachable(ip, port):

            log.warning(
                f"[{device_name}] "
                f"⚠️ Device unreachable"
            )

            stop_event.wait(
                RECONNECT_INTERVAL_SECONDS
            )

            continue

        # ====================================================
        # CREATE ZK OBJECT
        # ====================================================

        zk = ZK(
            ip,
            port=port,
            timeout=5,
            password=0,
            force_udp=False,
            ommit_ping=False,
        )

        conn = None

        try:

            # =================================================
            # CONNECT
            # =================================================

            log.info(
                f"[{device_name}] "
                f"Connecting..."
            )

            conn = zk.connect()

            log.info(
                f"[{device_name}] "
                f"✅ Connected"
            )

            # =================================================
            # CONTINUOUS TIME SYNC
            # =================================================

            while not stop_event.is_set():

                # ---------------------------------------------
                # SERVER TIME
                # ---------------------------------------------

                server_time = get_server_time()

                # ---------------------------------------------
                # BEFORE
                # ---------------------------------------------

                try:

                    before = conn.get_time()

                    log.info(
                        f"[{device_name}] "
                        f"BEFORE set_time = {before} | "
                        f"SERVER = {server_time}"
                    )

                except Exception as e:

                    log.error(
                        f"[{device_name}] "
                        f"❌ Could not read device time "
                        f"BEFORE set_time: {e}"
                    )

                    raise

                # ---------------------------------------------
                # DISABLE
                # ---------------------------------------------

                if REQUIRES_DISABLE_DEFAULT:

                    try:

                        log.info(
                            f"[{device_name}] "
                            f"Disabling device..."
                        )

                        conn.disable_device()

                        log.info(
                            f"[{device_name}] "
                            f"Device disabled"
                        )

                    except Exception as e:

                        log.error(
                            f"[{device_name}] "
                            f"❌ disable_device() failed: "
                            f"{e}"
                        )

                        raise

                # ---------------------------------------------
                # SET TIME
                # ---------------------------------------------

                try:

                    log.info(
                        f"[{device_name}] "
                        f"Setting time to "
                        f"{server_time}"
                    )

                    conn.set_time(
                        server_time
                    )

                    log.info(
                        f"[{device_name}] "
                        f"✅ set_time() completed"
                    )

                except Exception as e:

                    log.error(
                        f"[{device_name}] "
                        f"❌ set_time() failed: "
                        f"{e}"
                    )

                    raise

                # ---------------------------------------------
                # ENABLE
                # ---------------------------------------------

                if REQUIRES_DISABLE_DEFAULT:

                    try:

                        log.info(
                            f"[{device_name}] "
                            f"Enabling device..."
                        )

                        conn.enable_device()

                        log.info(
                            f"[{device_name}] "
                            f"Device enabled"
                        )

                    except Exception as e:

                        log.error(
                            f"[{device_name}] "
                            f"❌ enable_device() failed: "
                            f"{e}"
                        )

                        raise

                # ---------------------------------------------
                # AFTER
                # ---------------------------------------------

                try:

                    after = conn.get_time()

                    log.info(
                        f"[{device_name}] "
                        f"AFTER set_time = {after}"
                    )

                except Exception as e:

                    log.error(
                        f"[{device_name}] "
                        f"❌ Could not read device time "
                        f"AFTER set_time: {e}"
                    )

                    raise

                # ---------------------------------------------
                # COMPARE
                # ---------------------------------------------

                difference = (
                    after - server_time
                ).total_seconds()

                log.info(
                    f"[{device_name}] "
                    f"Difference between SERVER and "
                    f"DEVICE after write = "
                    f"{difference:.0f}s"
                )

                if abs(difference) <= TIME_TOLERANCE_SECONDS:

                    log.info(
                        f"[{device_name}] "
                        f"✅ TIME WRITE ACCEPTED "
                        f"(difference="
                        f"{difference:.0f}s)"
                    )

                else:

                    log.warning(
                        f"[{device_name}] "
                        f"⚠️ TIME MISMATCH "
                        f"(difference="
                        f"{difference:.0f}s)"
                    )

                # ---------------------------------------------
                # WAIT
                # ---------------------------------------------

                log.info(
                    f"[{device_name}] "
                    f"💤 Next synchronization in "
                    f"{SYNC_INTERVAL_SECONDS}s"
                )

                stop_event.wait(
                    SYNC_INTERVAL_SECONDS
                )

        # ====================================================
        # DEVICE ERROR
        # ====================================================

        except Exception as e:

            log.error(
                f"[{device_name}] "
                f"❌ Sync error: {e}"
            )

        finally:

            # =================================================
            # CLEANUP
            # =================================================

            try:

                if conn:

                    conn.disconnect()

                    log.info(
                        f"[{device_name}] "
                        f"Disconnected"
                    )

            except Exception as e:

                log.debug(
                    f"[{device_name}] "
                    f"Disconnect failed: {e}"
                )

        # ====================================================
        # RECONNECT
        # ====================================================

        if not stop_event.is_set():

            log.info(
                f"[{device_name}] "
                f"🔄 Retrying in "
                f"{RECONNECT_INTERVAL_SECONDS}s..."
            )

            stop_event.wait(
                RECONNECT_INTERVAL_SECONDS
            )

    log.info(
        f"[{device_name}] "
        f"🛑 Synchronization loop stopped"
    )


# ============================================================
# START DEVICE
# ============================================================

def start_device(
    ip: str,
    port: int,
):
    """
    Start synchronization for a device if it isn't already
    running.
    """

    device_key = f"{ip}:{port}"

    with device_threads_lock:

        existing = device_threads.get(
            device_key
        )

        if existing and existing.is_alive():

            return

        # ---------------------------------------------
        # CREATE STOP EVENT
        # ---------------------------------------------

        stop_event = threading.Event()

        # ---------------------------------------------
        # CREATE THREAD
        # ---------------------------------------------

        thread = threading.Thread(
            target=sync_device_loop,
            args=(
                ip,
                port,
                stop_event,
            ),
            name=f"zk-{device_key}",
            daemon=True,
        )

        device_stop_events[
            device_key
        ] = stop_event

        device_threads[
            device_key
        ] = thread

        thread.start()

    log.info(
        f"▶️ [{device_key}] "
        f"Synchronization thread started"
    )


# ============================================================
# STOP DEVICE
# ============================================================

def stop_device(
    device_key: str,
):
    """
    Stop a device synchronization thread.

    This is used when a device is removed or deactivated
    in Django.
    """

    with device_threads_lock:

        stop_event = device_stop_events.get(
            device_key
        )

        if stop_event:

            stop_event.set()

            log.info(
                f"🛑 [{device_key}] "
                f"Stopping synchronization thread"
            )


# ============================================================
# DEVICE DISCOVERY LOOP
# ============================================================

def device_discovery_loop():
    """
    Continuously refresh the device list from Django.

    New active devices:
        → start automatically

    Existing active devices:
        → continue running

    Deactivated/removed devices:
        → synchronization thread is stopped
    """

    log.info(
        "🔍 Starting dynamic device discovery"
    )

    while True:

        # ====================================================
        # FETCH CURRENT DEVICE LIST
        # ====================================================

        devices = fetch_active_devices()

        active_keys = set()

        # ====================================================
        # START NEW DEVICES
        # ====================================================

        for ip, port in devices:

            device_key = f"{ip}:{port}"

            active_keys.add(
                device_key
            )

            start_device(
                ip,
                port,
            )

        # ====================================================
        # STOP DEVICES NO LONGER ACTIVE
        # ====================================================

        with device_threads_lock:

            known_devices = list(
                device_threads.items()
            )

        for device_key, thread in known_devices:

            if device_key not in active_keys:

                if thread.is_alive():

                    stop_device(
                        device_key
                    )

        # ====================================================
        # WAIT BEFORE REFRESH
        # ====================================================

        log.info(
            f"🔄 Next Django device refresh in "
            f"{DEVICE_REFRESH_INTERVAL_SECONDS}s"
        )

        time.sleep(
            DEVICE_REFRESH_INTERVAL_SECONDS
        )


# ============================================================
# STOP ALL DEVICES
# ============================================================

def stop_all_devices():
    """
    Stop every device synchronization thread.
    """

    log.info(
        "🛑 Stopping all device synchronization threads..."
    )

    with device_threads_lock:

        events = list(
            device_stop_events.values()
        )

    for stop_event in events:

        stop_event.set()


# ============================================================
# MAIN
# ============================================================

def main():

    log.info("=" * 70)

    log.info(
        "ZKTeco DYNAMIC CLOCK TIME DAEMON"
    )

    log.info("=" * 70)

    log.info(
        f"Django devices API: "
        f"{CLOCKERS_API_URL}"
    )

    log.info(
        f"Django SSL verification: "
        f"{VERIFY_DJANGO_SSL}"
    )

    log.info(
        f"Synchronization interval: "
        f"{SYNC_INTERVAL_SECONDS}s"
    )

    log.info(
        f"Device list refresh: "
        f"{DEVICE_REFRESH_INTERVAL_SECONDS}s"
    )

    log.info(
        f"Default ZKTeco port: "
        f"{DEVICE_PORT_DEFAULT}"
    )

    log.info(
        f"Disable/Enable before set_time: "
        f"{REQUIRES_DISABLE_DEFAULT}"
    )

    log.info("=" * 70)

    try:

        device_discovery_loop()

    except KeyboardInterrupt:

        log.info(
            "🛑 Clock daemon stopped by user."
        )

        stop_all_devices()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()