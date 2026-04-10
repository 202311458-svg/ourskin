from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db import Base


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(Integer, primary_key=True, index=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    follow_up_date = Column(Date, nullable=False)
    reason = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    status = Column(String, default="Scheduled", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())