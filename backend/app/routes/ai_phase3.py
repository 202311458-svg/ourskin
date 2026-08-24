from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.authorization import get_doctor_appointment_or_404
from app.core.config import settings
from app.core.image_security import normalize_image_for_analysis, read_and_validate_image
from app.core.security import get_current_user
from app.core.storage import delete_storage_object, upload_skin_bytes_to_supabase
from app.db import SessionLocal
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_image_asset import AIImageAsset
from app.models.appointment import AppointmentModel
from app.models.dermatology_condition import DermatologyCondition
from app.models.user import User
from app.schemas.ai_analysis import (
    DermatologyClinicalContext,
    MedicationClinicalContext,
    PregnancyStatus,
)
from app.services.ai.contracts import AIProviderError, AIResultValidationError
from app.services.ai.factory import build_dermatology_analysis_service
from app.utils.ai_serializers import serialize_ai_run, serialize_legacy_analysis


# Historical serializer alias retained for internal route imports.
serialize_legacy_for_m4 = serialize_legacy_analysis

router = APIRouter(prefix="/ai", tags=["AI Analysis"])


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


def _split_csv(value: str | None, max_items: int) -> list[str]:
    if not value:
        return []
    items = [item.strip() for item in value.split(",") if item.strip()]
    return list(dict.fromkeys(items))[:max_items]


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image(
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
        appointment = (
            db.query(AppointmentModel)
            .filter(AppointmentModel.id == appointment_id)
            .first()
        )

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail="AI analysis can only be run for approved consultations.",
        )
    if appointment.patient_id is None:
        raise HTTPException(
            status_code=400,
            detail="Appointment is missing a patient record.",
        )

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
            reviewed_by_doctor=bool(
                medication_context_reviewed and user.role == "doctor"
            ),
        )
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Clinical context contains an invalid value.",
        ) from exc

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
        raise HTTPException(
            status_code=503,
            detail="AI analysis provider is temporarily unavailable.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI analysis is not configured for this environment.",
        ) from exc
    except AIResultValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="AI result could not be validated safely.",
        ) from exc

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
        clinical_context_json["medication_context"] = medication_context.model_dump(
            mode="json"
        )

        now = datetime.now(timezone.utc)
        run = AIAnalysisRun(
            appointment_id=appointment_id,
            image_asset_id=asset.id,
            created_by_id=user.id,
            primary_condition_id=primary_condition.id if primary_condition else None,
            analysis_mode=result.analysis_mode.value,
            status=result.status.value,
            evidence_strength=(
                result.evidence_strength.value if result.evidence_strength else None
            ),
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
            severity_level=(
                result.severity.level.value if result.severity.level else None
            ),
            severity_reason=result.severity.reason,
            service_compatibility=(
                result.service_compatibility.value
                if result.service_compatibility
                else None
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
        db.commit()
    except Exception:
        db.rollback()
        delete_storage_object(storage_path)
        raise

    db.refresh(run)
    return {
        "status": "success",
        "message": "AI clinical decision-support analysis created successfully.",
        "analysis": serialize_ai_run(db, run),
    }
