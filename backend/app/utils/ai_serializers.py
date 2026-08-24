from sqlalchemy.orm import Session

from app.core.storage import create_signed_image_url
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_image_asset import AIImageAsset
from app.models.dermatology_condition import DermatologyCondition
from app.models.skin_analysis import SkinAnalysis


def serialize_ai_run(db: Session, run: AIAnalysisRun) -> dict:
    asset = (
        db.query(AIImageAsset)
        .filter(AIImageAsset.id == run.image_asset_id)
        .first()
    )
    condition = None
    if run.primary_condition_id:
        condition = (
            db.query(DermatologyCondition)
            .filter(DermatologyCondition.id == run.primary_condition_id)
            .first()
        )

    context = run.clinical_context or {}
    image_path = asset.storage_path if asset else None
    severity = {
        "assessable": bool(run.severity_assessable),
        "level": run.severity_level,
        "reason": run.severity_reason,
    }

    return {
        "kind": "clinical_run",
        "id": run.id,
        "appointment_id": run.appointment_id,
        "legacy_skin_analysis_id": run.legacy_skin_analysis_id,
        "image_asset_id": run.image_asset_id,
        "image_path": image_path,
        "image_url": create_signed_image_url(image_path) if image_path else None,
        "analysis_mode": run.analysis_mode,
        "status": run.status,
        "condition": condition.display_name if condition else None,
        "primary_condition_code": condition.code if condition else None,
        "primary_condition_display": condition.display_name if condition else None,
        "evidence_strength": run.evidence_strength,
        "image_quality": run.image_quality or {},
        "visual_findings": run.visual_findings or [],
        "differentials": run.differentials or [],
        "severity": run.severity_level
        or ("Not Assessable" if not run.severity_assessable else None),
        "severity_assessment": severity,
        "booked_service_id": context.get("booked_service_id"),
        "booked_service_name": context.get("booked_service_name"),
        "clinical_context": context,
        "service_compatibility": run.service_compatibility,
        "compatibility_reason": run.compatibility_reason,
        "service_recommendations": run.service_recommendations or [],
        "medication_suggestions": run.medication_suggestions or [],
        "medication_knowledge_version": run.medication_knowledge_version,
        "medication_guidance": run.medication_guidance,
        "progress_trend": run.progress_trend,
        "progress_summary": run.progress_summary,
        "comparison_reliable": run.comparison_reliable,
        "comparison_findings": run.comparison_findings or [],
        "red_flags": run.red_flags or [],
        "limitations": run.limitations or [],
        "review_status": run.review_status,
        "reviewed_at": run.reviewed_at.isoformat() if run.reviewed_at else None,
        "model_provider": run.model_provider,
        "model_id": run.model_id,
        "model_version": run.model_version,
        "pipeline_version": run.pipeline_version,
        "taxonomy_version": run.taxonomy_version,
        "latency_ms": run.latency_ms,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


def serialize_legacy_analysis(analysis: SkinAnalysis) -> dict:
    signed_url = create_signed_image_url(analysis.image_path)
    return {
        "kind": "legacy",
        "id": analysis.id,
        "appointment_id": analysis.appointment_id,
        "uploaded_by_id": analysis.uploaded_by_id,
        "image_path": signed_url,
        "image_url": signed_url,
        "condition": analysis.condition,
        "confidence": analysis.confidence,
        "severity": analysis.severity,
        "recommendation": analysis.recommendation,
        "doctor_note": analysis.doctor_note,
        "review_status": analysis.review_status,
        "reviewed_at": (
            analysis.reviewed_at.isoformat()
            if analysis.reviewed_at
            else None
        ),
        "reviewed_by_doctor_id": getattr(
            analysis,
            "reviewed_by_doctor_id",
            None,
        ),
        "doctor_signed_off_at": (
            analysis.doctor_signed_off_at.isoformat()
            if getattr(analysis, "doctor_signed_off_at", None)
            else None
        ),
        "is_patient_visible": getattr(
            analysis,
            "is_patient_visible",
            False,
        ),
        "possible_conditions": analysis.possible_conditions,
        "key_findings": analysis.key_findings,
        "treatment_suggestions": analysis.treatment_suggestions,
        "prescription_suggestions": analysis.prescription_suggestions,
        "follow_up_suggestions": analysis.follow_up_suggestions,
        "red_flags": analysis.red_flags,
        "created_at": (
            analysis.created_at.isoformat()
            if analysis.created_at
            else None
        ),
    }
