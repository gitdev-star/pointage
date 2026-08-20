# app/models/device_sync.py
from sqlalchemy import Column, String, DateTime
from app.models.attendance import Base


class DeviceSyncState(Base):
    """
    Tracks per-device ADMS push state (stamp) and last-seen timestamps
    for both push and pull, so:
      - the handshake can echo back the device's real confirmed stamp
        (persisted, survives service restarts)
      - sync_service.py can tell whether push is currently healthy for
        a given device before deciding to fall back to SDK pull
    """
    __tablename__ = "device_sync_state"

    sn = Column(String, primary_key=True)          # device serial — stable identity
    device_ip = Column(String, nullable=True, index=True)  # mutable, but what sync_service keys on
    last_stamp    = Column(String, nullable=True)
    last_push_at  = Column(DateTime(timezone=True), nullable=True)
    last_pull_at  = Column(DateTime(timezone=True), nullable=True)