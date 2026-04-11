from sqlalchemy import Column, Integer, Text, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db import Base


class DiagnosisReport(Base):
    __tablename__ = "diagnosis_reports"

    id = Column(Integer, primary_key=True, index=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    skin_analysis_id = Column(Integer, ForeignKey("skin_analysis.id", ondelete="SET NULL"), nullable=True)

    doctor_final_diagnosis = Column(Text, nullable=False)
    doctor_prescription = Column(Text, nullable=True)
    after_appointment_notes = Column(Text, nullable=True)
    follow_up_plan = Column(Text, nullable=True)
    next_visit_date = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)