from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db import Base


class SkinAnalysis(Base):
    __tablename__ = "skin_analysis"

    id = Column(Integer, primary_key=True, index=True)

    # legacy field, keep for compatibility
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)

    # new field for uploader tracking
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    image_path = Column(String)
    condition = Column(String)
    confidence = Column(Float)
    severity = Column(String)
    recommendation = Column(String)

    doctor_note = Column(Text, nullable=True)

    review_status = Column(String, default="Pending Review", nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # new AI decision-support fields
    possible_conditions = Column(Text, nullable=True)
    key_findings = Column(Text, nullable=True)
    treatment_suggestions = Column(Text, nullable=True)
    prescription_suggestions = Column(Text, nullable=True)
    follow_up_suggestions = Column(Text, nullable=True)
    red_flags = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())