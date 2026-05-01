from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Text, Time
from sqlalchemy.sql import func

from app.db import Base


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)

    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    services = Column(Text, nullable=False)

    schedule_date = Column(Date, nullable=False)

    start_time = Column(Time, nullable=False)

    end_time = Column(Time, nullable=False)

    is_available = Column(Boolean, default=True, nullable=False)

    consultation_mode = Column(Text, default="In-Person", nullable=False)

    unavailable_reason = Column(Text, nullable=True)

    schedule_note = Column(Text, nullable=True)

    created_by_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())