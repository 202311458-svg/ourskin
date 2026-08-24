from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db import Base


class AIAnalysisRun(Base):
    __tablename__ = "ai_analysis_runs"
    __table_args__ = (
        CheckConstraint(
            "analysis_mode IN ('DERMATOLOGY_ASSESSMENT', 'SERVICE_COMPATIBILITY', 'RECOVERY_PROGRESS')",
            name="ck_ai_analysis_runs_mode",
        ),
        CheckConstraint(
            "status IN ('COMPLETED', 'UNCERTAIN', 'INSUFFICIENT_IMAGE', 'OUT_OF_SCOPE', 'REQUIRES_DIRECT_REVIEW', 'FAILED')",
            name="ck_ai_analysis_runs_status",
        ),
        CheckConstraint(
            "evidence_strength IS NULL OR evidence_strength IN ('HIGH', 'MODERATE', 'LOW')",
            name="ck_ai_analysis_runs_evidence_strength",
        ),
        CheckConstraint(
            "severity_level IS NULL OR severity_level IN ('MILD', 'MODERATE', 'SEVERE')",
            name="ck_ai_analysis_runs_severity_level",
        ),
        CheckConstraint(
            "service_compatibility IS NULL OR service_compatibility IN ('COMPATIBLE', 'REVIEW_RECOMMENDED', 'LIKELY_DIFFERENT_CONCERN', 'UNABLE_TO_ASSESS', 'DIRECT_REVIEW_REQUIRED')",
            name="ck_ai_analysis_runs_service_compatibility",
        ),
        CheckConstraint(
            "review_status IN ('PENDING_REVIEW', 'REVIEWED')",
            name="ck_ai_analysis_runs_review_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    image_asset_id = Column(Integer, ForeignKey("ai_image_assets.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reference_run_id = Column(Integer, ForeignKey("ai_analysis_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    legacy_skin_analysis_id = Column(Integer, ForeignKey("skin_analysis.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_condition_id = Column(Integer, ForeignKey("dermatology_conditions.id", ondelete="SET NULL"), nullable=True, index=True)

    analysis_mode = Column(String(40), nullable=False, index=True)
    status = Column(String(40), nullable=False, index=True)
    evidence_strength = Column(String(16), nullable=True)
    model_provider = Column(String(80), nullable=True)
    model_id = Column(String(160), nullable=True)
    model_version = Column(String(80), nullable=True)
    pipeline_version = Column(String(80), nullable=False)
    taxonomy_version = Column(String(80), nullable=False)
    latency_ms = Column(Integer, nullable=True)

    clinical_context = Column(JSON, nullable=False, default=dict)
    image_quality = Column(JSON, nullable=False, default=dict)
    visual_findings = Column(JSON, nullable=False, default=list)
    differentials = Column(JSON, nullable=False, default=list)
    severity_assessable = Column(Boolean, nullable=False, default=False)
    severity_level = Column(String(16), nullable=True)
    severity_reason = Column(Text, nullable=True)
    service_compatibility = Column(String(40), nullable=True)
    compatibility_reason = Column(Text, nullable=True)
    service_recommendations = Column(JSON, nullable=False, default=list)
    medication_suggestions = Column(JSON, nullable=False, default=list)
    red_flags = Column(JSON, nullable=False, default=list)
    limitations = Column(JSON, nullable=False, default=list)

    review_status = Column(String(24), nullable=False, default="PENDING_REVIEW", index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_doctor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_patient_visible = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
