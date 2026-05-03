from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from app.db import Base


class DoctorService(Base):
    __tablename__ = "doctor_services"

    id = Column(Integer, primary_key=True, index=True)

    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("doctor_id", "service_id", name="doctor_services_unique"),
    )