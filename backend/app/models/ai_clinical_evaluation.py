from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.db import Base


class AIClinicalEvaluation(Base):
    __tablename__ = "ai_clinical_evaluations"
    __table_args__ = (
        CheckConstraint(
            "diagnosis_agreement IN ('AGREE', 'PARTIAL', 'DISAGREE', 'NOT_ASSESSABLE')",
            name="ck_ai_clinical_evaluations_agreement",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    ai_analysis_run_id = Column(
        Integer,
        ForeignKey("ai_analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    diagnosis_report_id = Column(
        Integer,
        ForeignKey("diagnosis_reports.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    doctor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    evaluation_basis = Column(String(80), nullable=False, default="DERIVED_TEXT_MATCH_V1")
    diagnosis_agreement = Column(String(24), nullable=False, index=True)
    ai_status = Column(String(40), nullable=False)
    ai_evidence_strength = Column(String(16), nullable=True)
    ai_primary_condition_code = Column(String(64), nullable=True)
    ai_primary_condition_display = Column(String(160), nullable=True)
    doctor_final_diagnosis = Column(Text, nullable=False)
    matched_differential_code = Column(String(64), nullable=True)
    matched_differential_display = Column(String(160), nullable=True)

    medication_suggestions_present = Column(Boolean, nullable=False, default=False)
    medication_suggestion_used = Column(Boolean, nullable=True)
    medication_matches = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
