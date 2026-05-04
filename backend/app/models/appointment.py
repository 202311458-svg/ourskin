from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from app.db import Base


class AppointmentModel(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    schedule_id = Column(Integer, ForeignKey("doctor_schedules.id"), nullable=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True, index=True)

    patient_name = Column(String, nullable=False)
    patient_email = Column(String, nullable=False)
    patient_contact = Column(Text, nullable=True)
    patient_address = Column(Text, nullable=True)
    patient_age = Column(Integer, nullable=True)
    patient_age_label = Column(Text, nullable=True)

    doctor_name = Column(String, nullable=True)

    date = Column(Date, nullable=True)
    time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    services = Column(String, nullable=False)

    appointment_type = Column(Text, default="Regular", nullable=False)
    consultation_mode = Column(Text, default="In-Person", nullable=False)
    concern = Column(Text, nullable=True)
    is_initial_evaluation_request = Column(Boolean, default=False, nullable=False)

    status = Column(String, default="Pending", nullable=False)
    cancel_reason = Column(String, nullable=True)

    patient_instruction = Column(Text, nullable=True)
    approval_email_sent = Column(Boolean, default=False, nullable=False)
    approval_email_sent_at = Column(DateTime(timezone=True), nullable=True)
