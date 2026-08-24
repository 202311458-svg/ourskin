from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.authorization import get_doctor_appointment_or_404
from app.core.config import settings
from app.core.image_security import normalize_image_for_analysis, read_and_validate_image
from app.core.security import get_current_user
from app.core.storage import create_signed_image_url, upload_skin_bytes_to_supabase
from app.db import SessionLocal
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_image_asset import AIImageAsset
from app.models.appointment import AppointmentModel
from app.models.dermatology_condition import DermatologyCondition
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes.ai_analysis import serialize_analysis as serialize_legacy_analysis
from app.schemas.ai_analysis import (
    AIAnalysisResult,
    DermatologyClinicalContext,
    MedicationClinicalContext,
    PregnancyStatus,
)
from app.services.ai.contracts import AIProviderError, AIResultValidationError
from app.services.ai.factory import build_dermatology_analysis_service


router = APIRouter(prefix="/ai", tags=["AI Analysis"])


class AIReviewUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doctor_note: str | None = Field(default=None, max_length=4000)
    possible_conditions: str | None = Field(default=None, max_length=4000)
    key_findings: str | None = Field(default=None, max_length=6000)
    treatment_suggestions: str | None = Field(default=None, max_length=6000)
    prescription_suggestions: str | None = Field(default=None, max_length=6000)
    follow_up_suggestions: str | None = Field(default=None, max_length=4000)
    red_flags: str | None = Field(default=None, max_length=4000)
    review_status: str | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_staff_or_doctor(user: User = Depends(get_current_user)):
    if user.role not in {"staff", "doctor", "admin"}:
        raise HTTPException(status_code=403, detail="Staff, doctor, or admin access only")
    return user


def require_doctor(user: User = Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return user


def _split_csv(value: str | None, max_items: int) -> list[str]:
    if not value:
        return []
    items = [item.strip() for item in value.split(",") if item.strip()]
    return list(dict.fromkeys(items))[:max_items]


def _legacy_support_fields(result: AIAnalysisResult) -> dict[str, str]:
    primary = result.primary_condition_display or "No supported primary condition"
    differential_names = [item.display_name for item in result.differentials]
    possible_conditions = "\n".join([primary, *differential_names])

    finding_lines = []
    for item in result.visual_findings:
        detail = item.finding
        if item.location:
            detail += f" ({item.location})"
        if item.description:
            detail += f": {item.description}"
        finding_lines.append(f"- {detail}")

    service_lines = [
        f"- {item.service_name} [{item.relationship_type}]: {item.reason or 'Doctor review required.'}"
        for item in result.service_recommendations
    ]
    medication_lines = [
        f"- {item.name_or_class} | Usage: Doctor to determine | Reason: {item.role}"
        for item in result.medication_suggestions
    ]
    red_flag_lines = [f"- {item}" for item in result.red_flags]

    severity = "Not Assessable"
    if result.severity.assessable and result.severity.level is not None:
        severity = result.severity.level.value.title()

    recommendation = (
        result.compatibility_reason
        or result.medication_guidance
        or "Doctor review is required before final diagnosis or treatment."
    )

    return {
        "condition": primary,
        "severity": severity,
        "recommendation": recommendation,
        "possible_conditions": possible_conditions,
        "key_findings": "\n".join(finding_lines) or "No structured visual findings were returned.",
        "treatment_suggestions": "\n".join(service_lines) or "No clinic service recommendation was generated.",
        "prescription_suggestions": "\n".join(medication_lines) or result.medication_guidance or "No medication options were generated.",
        "follow_up_suggestions": "Doctor to determine follow-up based on the final clinical assessment.",
        "red_flags": "\n".join(red_flag_lines) or "No AI-visible warning features were returned.",
    }


def serialize_ai_run(db: Session, run: AIAnalysisRun) -> dict:
    asset = db.query(AIImageAsset).filter(AIImageAsset.id == run.image_asset_id).first()
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
        "severity": run.severity_level or ("Not Assessable" if not run.severity_assessable else None),
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


def serialize_legacy_for_m4(analysis: SkinAnalysis) -> dict:
    data = serialize_legacy_analysis(analysis)
    data["kind"] = "legacy"
    data["image_url"] = data.get("image_path")
    return data


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image_phase4(
    appointment_id: int,
    file: UploadFile = File(...),
    body_site: str | None = Form(default=None, max_length=120),
    duration: str | None = Form(default=None, max_length=120),
    symptoms: str | None = Form(default=None, max_length=800),
    progression: str | None = Form(default=None, max_length=120),
    doctor_observation: str | None = Form(default=None, max_length=1500),
    known_allergies: str | None = Form(default=None, max_length=1200),
    current_medications: str | None = Form(default=None, max_length=1800),
    pregnancy_status: str = Form(default="UNKNOWN", max_length=40),
    medication_context_reviewed: bool = Form(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
    if user.role == "doctor":
        appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    else:
        appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.status != "Approved":
        raise HTTPException(status_code=400, detail="AI analysis can only be run for approved consultations.")
    if appointment.patient_id is None:
        raise HTTPException(status_code=400, detail="Appointment is missing a patient record.")

    file_bytes, extension, _detected_content_type = await read_and_validate_image(file)
    normalized_image = normalize_image_for_analysis(file_bytes, extension)

    try:
        pregnancy = PregnancyStatus(pregnancy_status.strip().upper())
        clinical_context = DermatologyClinicalContext(
            body_site=(body_site or "").strip() or None,
            duration=(duration or "").strip() or None,
            symptoms=_split_csv(symptoms, 12),
            progression=(progression or "").strip() or None,
            appointment_concern=(appointment.concern or "").strip() or None,
            doctor_observation=(doctor_observation or "").strip() or None,
            booked_service_id=appointment.service_id,
            booked_service_name=(appointment.services or "").strip() or None,
        )
        medication_context = MedicationClinicalContext(
            age_years=appointment.patient_age,
            known_allergies=_split_csv(known_allergies, 20),
            current_medications=_split_csv(current_medications, 30),
            pregnancy_status=pregnancy,
            reviewed_by_doctor=bool(medication_context_reviewed and user.role == "doctor"),
        )
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail="Clinical context contains an invalid value.") from exc

    try:
        analysis_service = build_dermatology_analysis_service(settings)
        execution = analysis_service.analyze(
            db=db,
            image_bytes=normalized_image.data,
            content_type=normalized_image.content_type,
            context=clinical_context,
            medication_context=medication_context,
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail="AI analysis provider is temporarily unavailable.") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="AI analysis is not configured for this environment.") from exc
    except AIResultValidationError as exc:
        raise HTTPException(status_code=502, detail="AI result could not be validated safely.") from exc

    result = execution.result
    storage_path = upload_skin_bytes_to_supabase(
        file_bytes=normalized_image.data,
        appointment_id=appointment_id,
        filename=f"sanitized{normalized_image.extension}",
        content_type=normalized_image.content_type,
        patient_id=appointment.patient_id,
    )

    try:
        asset = AIImageAsset(
            appointment_id=appointment_id,
            uploaded_by_id=user.id,
            storage_path=storage_path,
            content_type=normalized_image.content_type,
            source_format=normalized_image.source_format,
            original_extension=extension,
            width=normalized_image.width,
            height=normalized_image.height,
            sanitized=True,
            metadata_stripped=normalized_image.metadata_stripped,
        )
        db.add(asset)
        db.flush()

        primary_condition = None
        if result.primary_condition_code:
            primary_condition = (
                db.query(DermatologyCondition)
                .filter(
                    DermatologyCondition.code == result.primary_condition_code,
                    DermatologyCondition.is_active.is_(True),
                )
                .first()
            )

        result_json = result.model_dump(mode="json")
        clinical_context_json = clinical_context.model_dump(mode="json")
        clinical_context_json["medication_context"] = medication_context.model_dump(mode="json")

        now = datetime.now(timezone.utc)
        run = AIAnalysisRun(
            appointment_id=appointment_id,
            image_asset_id=asset.id,
            created_by_id=user.id,
            primary_condition_id=primary_condition.id if primary_condition else None,
            analysis_mode=result.analysis_mode.value,
            status=result.status.value,
            evidence_strength=result.evidence_strength.value if result.evidence_strength else None,
            model_provider=execution.provider_name,
            model_id=execution.model_id,
            model_version=None,
            pipeline_version=result.pipeline_version,
            taxonomy_version=result.taxonomy_version,
            latency_ms=execution.latency_ms,
            clinical_context=clinical_context_json,
            image_quality=result_json["image_quality"],
            visual_findings=result_json["visual_findings"],
            differentials=result_json["differentials"],
            severity_assessable=result.severity.assessable,
            severity_level=result.severity.level.value if result.severity.level else None,
            severity_reason=result.severity.reason,
            service_compatibility=(
                result.service_compatibility.value if result.service_compatibility else None
            ),
            compatibility_reason=result.compatibility_reason,
            service_recommendations=result_json["service_recommendations"],
            medication_suggestions=result_json["medication_suggestions"],
            medication_knowledge_version=result.medication_knowledge_version,
            medication_guidance=result.medication_guidance,
            red_flags=result.red_flags,
            limitations=result.limitations,
            review_status="PENDING_REVIEW",
            is_patient_visible=False,
            completed_at=now,
        )
        db.add(run)
        db.flush()

        legacy_fields = _legacy_support_fields(result)
        legacy = SkinAnalysis(
            user_id=user.id,
            uploaded_by_id=user.id,
            appointment_id=appointment_id,
            image_path=storage_path,
            condition=legacy_fields["condition"],
            confidence=0.0,
            severity=legacy_fields["severity"],
            recommendation=legacy_fields["recommendation"],
            doctor_note=clinical_context.doctor_observation,
            review_status="Pending Review",
            reviewed_at=None,
            reviewed_by_doctor_id=None,
            doctor_signed_off_at=None,
            is_patient_visible=False,
            possible_conditions=legacy_fields["possible_conditions"],
            key_findings=legacy_fields["key_findings"],
            treatment_suggestions=legacy_fields["treatment_suggestions"],
            prescription_suggestions=legacy_fields["prescription_suggestions"],
            follow_up_suggestions=legacy_fields["follow_up_suggestions"],
            red_flags=legacy_fields["red_flags"],
        )
        db.add(legacy)
        db.flush()
        run.legacy_skin_analysis_id = legacy.id

        db.commit()
        db.refresh(run)
        return {
            "status": "success",
            "message": "AI clinical decision-support analysis created successfully.",
            "analysis": serialize_ai_run(db, run),
        }
    except Exception:
        db.rollback()
        raise


@router.get("/appointment/{appointment_id}")
def get_analysis_by_appointment_phase4(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
    if user.role == "doctor":
        appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    else:
        appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    runs = (
        db.query(AIAnalysisRun)
        .filter(AIAnalysisRun.appointment_id == appointment_id)
        .order_by(AIAnalysisRun.created_at.desc())
        .all()
    )
    linked_legacy_ids = {run.legacy_skin_analysis_id for run in runs if run.legacy_skin_analysis_id}
    legacy_query = db.query(SkinAnalysis).filter(SkinAnalysis.appointment_id == appointment_id)
    if linked_legacy_ids:
        legacy_query = legacy_query.filter(~SkinAnalysis.id.in_(linked_legacy_ids))
    legacy_rows = legacy_query.order_by(SkinAnalysis.created_at.desc()).all()

    items = [serialize_ai_run(db, run) for run in runs]
    items.extend(serialize_legacy_for_m4(row) for row in legacy_rows)
    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return items


@router.put("/review/{analysis_id}")
def review_analysis_phase3(
    analysis_id: int,
    body: AIReviewUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    analysis = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(SkinAnalysis.id == analysis_id, AppointmentModel.doctor_id == user.id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    payload = body.model_dump(exclude_unset=True)
    review_status = payload.pop("review_status", None)
    for field, value in payload.items():
        setattr(analysis, field, value.strip() if isinstance(value, str) else value)

    if review_status is not None:
        if review_status not in {"Pending Review", "Reviewed"}:
            raise HTTPException(status_code=400, detail="Invalid review status")
        analysis.review_status = review_status
        if review_status == "Reviewed":
            analysis.reviewed_at = datetime.now(timezone.utc)
            analysis.reviewed_by_doctor_id = user.id
        else:
            analysis.reviewed_at = None
            analysis.reviewed_by_doctor_id = None
        analysis.doctor_signed_off_at = None
        analysis.is_patient_visible = False

    db.commit()
    db.refresh(analysis)
    return {"message": "Analysis updated successfully", "analysis": serialize_legacy_for_m4(analysis)}
