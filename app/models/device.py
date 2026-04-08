from sqlalchemy import Column, Integer, String
from app.database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, nullable=False)  # Device identifier
    device_name = Column(String, nullable=False)  # Device name
    location = Column(String)  # Optional: location of the device

    def __repr__(self):
        return f"<Device(id={self.id}, device_name={self.device_name}, location={self.location})>"
