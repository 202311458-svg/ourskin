from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.authorization import get_doctor_appointment_or_404
from app.core.clock import clinic_now, get_clinic_timezone
from app.core.config import settings
from app.core.image_security import normalize_image_for_analysis, read_and_validate_image
from app.core.security import get_current_user
from app.core.storage import create_signed_image_url, upload_skin_bytes_to_supabase
from app.db import SessionLocal
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_image_asset import AIImageAsset
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes.ai_phase3 import serialize_ai_run, serialize_legacy_for_m4
from app.schemas.ai_analysis import AIAnalysisStatus
from app.schemas.ai_progress import CaptureView, ProgressClinicalContext
from app.services.ai.contracts import AIProviderError
from app.services.ai.factory import build_progress_analysis_service
from app.services.ai.image_quality import ImageQualityService
from app.services.ai.progress_analysis import PROGRESS_PIPELINE_VERSION


router = APIRouter(prefix="/ai", tags=["AI Recovery Progress"])
PROGRESS_TAXONOMY_VERSION = "ourskin-progress-v1"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_doctor(user: User = Depends(get_current_user)) -> User:
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return user


def _ensure_started(appointment: AppointmentModel) -> None:
    if appointment.date is None or appointment.time is None:
        raise HTTPException(status_code=400, detail="Appointment must have a confirmed schedule first.")
    scheduled = datetime.combine(appointment.date, appointment.time, tzinfo=get_clinic_timezone())
    if scheduled > clinic_now():
        raise HTTPException(status_code=400, detail="Recovery progress can only be recorded after the appointment has started.")


def _appointment_datetime(appointment: AppointmentModel) -> datetime | None:
    if appointment.date is None or appointment.time is None:
        return None
    return datetime.combine(appointment.date, appointment.time, tzinfo=get_clinic_timezone())


def _capture_view(value: str | None) -> CaptureView:
    try:
        return CaptureView((value or "UNSPECIFIED").strip().upper())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid capture view.") from exc


def _run_context(run: AIAnalysisRun) -> dict:
    return run.clinical_context if isinstance(run.clinical_context, dict) else {}


def _progress_capture_type(run: AIAnalysisRun) -> str:
    return str(_run_context(run).get("progress_capture_type") or "ANALYSIS")


def _find_asset(db: Session, run: AIAnalysisRun) -> AIImageAsset:
    asset = db.query(AIImageAsset).filter(AIImageAsset.id == run.image_asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="AI image asset not found")
    return asset


def _reference_run_for_appointment(
    db: Session,
    *,
    appointment: AppointmentModel,
    reference_run_id: int,
    doctor_id: int,
) -> tuple[AIAnalysisRun, AIImageAsset, AppointmentModel]:
    reference = db.query(AIAnalysisRun).filter(AIAnalysisRun.id == reference_run_id).first()
    if not reference:
        raise HTTPException(status_code=404, detail="Reference AI capture not found")

    reference_appointment = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.id == reference.appointment_id,
            AppointmentModel.doctor_id == doctor_id,
        )
        .first()
    )
    if not reference_appointment:
        raise HTTPException(status_code=404, detail="Reference appointment not found")
    if reference_appointment.patient_id != appointment.patient_id:
        raise HTTPException(status_code=400, detail="Reference capture belongs to a different patient")
    if reference_appointment.id == appointment.id:
        raise HTTPException(status_code=400, detail="Choose a reference capture from an earlier visit")

    current_dt = _appointment_datetime(appointment)
    reference_dt = _appointment_datetime(reference_appointment)
    if current_dt and reference_dt and reference_dt >= current_dt:
        raise HTTPException(status_code=400, detail="Reference capture must come from an earlier visit")

    return reference, _find_asset(db, reference), reference_appointment


def _serialize_progress_run(db: Session, run: AIAnalysisRun) -> dict:
    asset = _find_asset(db, run)
    context = _run_context(run)
    reference = None
    reference_asset = None
    reference_appointment = None
    if run.reference_run_id:
        reference = db.query(AIAnalysisRun).filter(AIAnalysisRun.id == run.reference_run_id).first()
        if reference:
            reference_asset = db.query(AIImageAsset).filter(AIImageAsset.id == reference.image_asset_id).first()
            reference_appointment = (
                db.query(AppointmentModel).filter(AppointmentModel.id == reference.appointment_id).first()
            )

    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == run.appointment_id).first()
    return {
        "id": run.id,
        "appointment_id": run.appointment_id,
        "analysis_mode": run.analysis_mode,
        "status": run.status,
        "capture_type": _progress_capture_type(run),
        "current_image_url": create_signed_image_url(asset.storage_path),
        "current_capture_view": asset.capture_view or "UNSPECIFIED",
        "reference_run_id": run.reference_run_id,
        "reference_image_url": (
            create_signed_image_url(reference_asset.storage_path) if reference_asset else None
        ),
        "reference_capture_view": (
            reference_asset.capture_view or "UNSPECIFIED" if reference_asset else None
        ),
        "reference_appointment_id": reference.appointment_id if reference else None,
        "reference_appointment_date": (
            str(reference_appointment.date) if reference_appointment and reference_appointment.date else None
        ),
        "appointment_date": str(appointment.date) if appointment and appointment.date else None,
        "service_name": appointment.services if appointment else None,
        "clinical_context": context,
        "image_quality": run.image_quality or {},
        "comparison_reliable": run.comparison_reliable,
        "progress_trend": run.progress_trend,
        "progress_summary": run.progress_summary,
        "comparison_findings": run.comparison_findings or [],
        "red_flags": run.red_flags or [],
        "limitations": run.limitations or [],
        "review_status": run.review_status,
        "reviewed_at": run.reviewed_at.isoformat() if run.reviewed_at else None,
        "model_provider": run.model_provider,
        "model_id": run.model_id,
        "pipeline_version": run.pipeline_version,
        "latency_ms": run.latency_ms,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/appointment/{appointment_id}")
def get_dermatology_analyses_without_progress(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "doctor":
        appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    elif user.role in {"staff", "admin"}:
        appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()
    else:
        raise HTTPException(status_code=403, detail="Staff, doctor, or admin access only")
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    runs = (
        db.query(AIAnalysisRun)
        .filter(
            AIAnalysisRun.appointment_id == appointment_id,
            AIAnalysisRun.analysis_mode != "RECOVERY_PROGRESS",
        )
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


@router.post("/progress/baseline/{appointment_id}")
async def save_progress_baseline(
    appointment_id: int,
    file: UploadFile = File(...),
    capture_view: str = Form(default="UNSPECIFIED", max_length=24),
    body_site: str | None = Form(default=None, max_length=120),
    procedure_or_treatment: str = Form(..., min_length=1, max_length=200),
    doctor_observation: str | None = Form(default=None, max_length=1500),
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    if appointment.status != "Approved":
        raise HTTPException(status_code=400, detail="Baseline capture requires an approved appointment")
    _ensure_started(appointment)
    if appointment.patient_id is None:
        raise HTTPException(status_code=400, detail="Appointment is missing a patient record")

    view = _capture_view(capture_view)
    file_bytes, extension, _ = await read_and_validate_image(file)
    normalized = normalize_image_for_analysis(file_bytes, extension)
    quality = ImageQualityService().assess(normalized.data)
    if not quality.usable:
        issue_text = ", ".join(quality.issues) or "image quality"
        raise HTTPException(status_code=400, detail=f"Baseline image is not suitable for comparison: {issue_text}")

    storage_path = upload_skin_bytes_to_supabase(
        file_bytes=normalized.data,
        appointment_id=appointment_id,
        filename=f"baseline{normalized.extension}",
        content_type=normalized.content_type,
        patient_id=appointment.patient_id,
    )
    now = datetime.now(timezone.utc)
    try:
        asset = AIImageAsset(
            appointment_id=appointment_id,
            uploaded_by_id=user.id,
            storage_path=storage_path,
            content_type=normalized.content_type,
            source_format=normalized.source_format,
            original_extension=extension,
            width=normalized.width,
            height=normalized.height,
            capture_view=view.value,
            sanitized=True,
            metadata_stripped=normalized.metadata_stripped,
        )
        db.add(asset)
        db.flush()

        run = AIAnalysisRun(
            appointment_id=appointment_id,
            image_asset_id=asset.id,
            created_by_id=user.id,
            analysis_mode="RECOVERY_PROGRESS",
            status="COMPLETED",
            pipeline_version=PROGRESS_PIPELINE_VERSION,
            taxonomy_version=PROGRESS_TAXONOMY_VERSION,
            clinical_context={
                "progress_capture_type": "BASELINE",
                "procedure_or_treatment": procedure_or_treatment.strip(),
                "body_site": (body_site or "").strip() or None,
                "booked_service_name": appointment.services,
                "doctor_observation": (doctor_observation or "").strip() or None,
            },
            image_quality=quality.model_dump(mode="json"),
            visual_findings=[],
            differentials=[],
            severity_assessable=False,
            service_recommendations=[],
            medication_suggestions=[],
            comparison_findings=[],
            red_flags=[],
            limitations=["Baseline capture only; no progress comparison was performed."],
            review_status="REVIEWED",
            reviewed_at=now,
            reviewed_by_doctor_id=user.id,
            is_patient_visible=False,
            completed_at=now,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return {"message": "Baseline image saved for future progress comparison.", "progress": _serialize_progress_run(db, run)}
    except Exception:
        db.rollback()
        raise


@router.get("/progress/reference-options/{appointment_id}")
def progress_reference_options(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    if appointment.patient_id is None:
        return []

    rows = (
        db.query(AIAnalysisRun, AIImageAsset, AppointmentModel)
        .join(AIImageAsset, AIImageAsset.id == AIAnalysisRun.image_asset_id)
        .join(AppointmentModel, AppointmentModel.id == AIAnalysisRun.appointment_id)
        .filter(
            AppointmentModel.patient_id == appointment.patient_id,
            AppointmentModel.doctor_id == user.id,
            AppointmentModel.id != appointment.id,
        )
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc(), AIAnalysisRun.created_at.desc())
        .all()
    )

    current_dt = _appointment_datetime(appointment)
    options = []
    for run, asset, reference_appointment in rows:
        reference_dt = _appointment_datetime(reference_appointment)
        if current_dt and reference_dt and reference_dt >= current_dt:
            continue
        url = create_signed_image_url(asset.storage_path)
        if not url:
            continue
        context = _run_context(run)
        options.append(
            {
                "run_id": run.id,
                "appointment_id": run.appointment_id,
                "appointment_date": str(reference_appointment.date) if reference_appointment.date else None,
                "appointment_time": str(reference_appointment.time) if reference_appointment.time else None,
                "service_name": reference_appointment.services,
                "capture_view": asset.capture_view or "UNSPECIFIED",
                "body_site": context.get("body_site"),
                "procedure_or_treatment": context.get("procedure_or_treatment"),
                "image_url": url,
                "analysis_mode": run.analysis_mode,
                "capture_type": _progress_capture_type(run),
                "created_at": run.created_at.isoformat() if run.created_at else None,
            }
        )
    return options


@router.post("/progress/{appointment_id}")
async def analyze_progress(
    appointment_id: int,
    file: UploadFile = File(...),
    reference_run_id: int = Form(..., gt=0),
    capture_view: str = Form(default="UNSPECIFIED", max_length=24),
    body_site: str | None = Form(default=None, max_length=120),
    procedure_or_treatment: str = Form(..., min_length=1, max_length=200),
    days_since_procedure: int | None = Form(default=None, ge=0, le=3650),
    doctor_observation: str | None = Form(default=None, max_length=1500),
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    if appointment.status != "Approved":
        raise HTTPException(status_code=400, detail="Progress comparison requires an approved appointment")
    _ensure_started(appointment)
    if appointment.patient_id is None:
        raise HTTPException(status_code=400, detail="Appointment is missing a patient record")

    reference_run, reference_asset, _reference_appointment = _reference_run_for_appointment(
        db,
        appointment=appointment,
        reference_run_id=reference_run_id,
        doctor_id=user.id,
    )
    current_view = _capture_view(capture_view)
    reference_view = _capture_view(reference_asset.capture_view)
    reference_context = _run_context(reference_run)

    try:
        context = ProgressClinicalContext(
            procedure_or_treatment=procedure_or_treatment.strip(),
            body_site=(body_site or "").strip() or None,
            reference_body_site=reference_context.get("body_site"),
            reference_procedure_or_treatment=reference_context.get("procedure_or_treatment"),
            current_capture_view=current_view,
            reference_capture_view=reference_view,
            days_since_procedure=days_since_procedure,
            doctor_observation=(doctor_observation or "").strip() or None,
            booked_service_name=appointment.services,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Progress comparison context contains an invalid value") from exc

    file_bytes, extension, _ = await read_and_validate_image(file)
    normalized = normalize_image_for_analysis(file_bytes, extension)
    reference_url = create_signed_image_url(reference_asset.storage_path, expires_in=900)
    if not reference_url:
        raise HTTPException(status_code=503, detail="Reference image is temporarily unavailable")

    try:
        service = build_progress_analysis_service(settings)
        execution = service.analyze(
            current_image_bytes=normalized.data,
            current_content_type=normalized.content_type,
            reference_image_url=reference_url,
            reference_image_quality=reference_run.image_quality or {},
            context=context,
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail="AI progress provider is temporarily unavailable") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="AI progress analysis is not configured for this environment") from exc

    result = execution.result
    storage_path = upload_skin_bytes_to_supabase(
        file_bytes=normalized.data,
        appointment_id=appointment_id,
        filename=f"progress{normalized.extension}",
        content_type=normalized.content_type,
        patient_id=appointment.patient_id,
    )
    now = datetime.now(timezone.utc)
    try:
        asset = AIImageAsset(
            appointment_id=appointment_id,
            uploaded_by_id=user.id,
            storage_path=storage_path,
            content_type=normalized.content_type,
            source_format=normalized.source_format,
            original_extension=extension,
            width=normalized.width,
            height=normalized.height,
            capture_view=current_view.value,
            sanitized=True,
            metadata_stripped=normalized.metadata_stripped,
        )
        db.add(asset)
        db.flush()
        result_json = result.model_dump(mode="json")
        run = AIAnalysisRun(
            appointment_id=appointment_id,
            image_asset_id=asset.id,
            created_by_id=user.id,
            reference_run_id=reference_run.id,
            analysis_mode="RECOVERY_PROGRESS",
            status=result.status.value,
            model_provider=execution.provider_name,
            model_id=execution.model_id,
            pipeline_version=result.pipeline_version,
            taxonomy_version=PROGRESS_TAXONOMY_VERSION,
            latency_ms=execution.latency_ms,
            clinical_context={
                "progress_capture_type": "COMPARISON",
                "procedure_or_treatment": context.procedure_or_treatment,
                "reference_procedure_or_treatment": context.reference_procedure_or_treatment,
                "body_site": context.body_site,
                "reference_body_site": context.reference_body_site,
                "days_since_procedure": context.days_since_procedure,
                "booked_service_name": appointment.services,
                "doctor_observation": context.doctor_observation,
            },
            image_quality=result_json["image_quality"],
            visual_findings=[],
            differentials=[],
            severity_assessable=False,
            service_recommendations=[],
            medication_suggestions=[],
            progress_trend=result.trend.value,
            progress_summary=result.summary,
            comparison_reliable=result.comparison_reliable,
            comparison_findings=result_json["findings"],
            red_flags=result.red_flags,
            limitations=result.limitations,
            review_status="PENDING_REVIEW",
            is_patient_visible=False,
            completed_at=now,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return {"message": "Recovery progress comparison completed.", "progress": _serialize_progress_run(db, run)}
    except Exception:
        db.rollback()
        raise


@router.get("/progress/history/{appointment_id}")
def progress_history(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, user.id)
    if appointment.patient_id is None:
        return []
    runs = (
        db.query(AIAnalysisRun)
        .join(AppointmentModel, AppointmentModel.id == AIAnalysisRun.appointment_id)
        .filter(
            AIAnalysisRun.analysis_mode == "RECOVERY_PROGRESS",
            AppointmentModel.patient_id == appointment.patient_id,
            AppointmentModel.doctor_id == user.id,
        )
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc(), AIAnalysisRun.created_at.desc())
        .all()
    )
    return [_serialize_progress_run(db, run) for run in runs]


@router.put("/progress/{run_id}/review")
def review_progress_run(
    run_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    run = (
        db.query(AIAnalysisRun)
        .join(AppointmentModel, AppointmentModel.id == AIAnalysisRun.appointment_id)
        .filter(
            AIAnalysisRun.id == run_id,
            AIAnalysisRun.analysis_mode == "RECOVERY_PROGRESS",
            AppointmentModel.doctor_id == user.id,
        )
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Progress analysis not found")
    if _progress_capture_type(run) == "BASELINE":
        return {"message": "Baseline capture is already recorded as reviewed.", "progress": _serialize_progress_run(db, run)}

    run.review_status = "REVIEWED"
    run.reviewed_at = datetime.now(timezone.utc)
    run.reviewed_by_doctor_id = user.id
    run.is_patient_visible = False
    db.commit()
    db.refresh(run)
    return {"message": "Progress comparison marked as reviewed.", "progress": _serialize_progress_run(db, run)}
