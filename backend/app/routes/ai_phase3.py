from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.authorization import get_doctor_appointment_or_404
from app.core.image_security import normalize_image_for_analysis, read_and_validate_image
from app.core.security import get_current_user
from app.core.storage import delete_temp_file, save_temp_image, upload_skin_bytes_to_supabase
from app.db import SessionLocal
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes.ai_analysis import build_ai_support_fields, serialize_analysis


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


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image_phase3(
    appointment_id: int,
    file: UploadFile = File(...),
    doctor_note: str | None = Form(default=None, max_length=4000),
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

    existing_analysis = db.query(SkinAnalysis).filter(SkinAnalysis.appointment_id == appointment_id).first()
    if existing_analysis:
        raise HTTPException(status_code=400, detail="AI analysis already exists for this consultation.")

    file_bytes, extension, _detected_content_type = await read_and_validate_image(file)
    normalized_image = normalize_image_for_analysis(file_bytes, extension)
    temp_file_path = save_temp_image(normalized_image.data, normalized_image.extension)

    try:
        from app.ml.predict_skin import predict_skin_condition

        raw_result = predict_skin_condition(temp_file_path)
        patient_id = getattr(appointment, "patient_id", None)
        if patient_id is None:
            raise HTTPException(status_code=400, detail="Appointment is missing a patient record.")

        storage_path = upload_skin_bytes_to_supabase(
            file_bytes=normalized_image.data,
            appointment_id=appointment_id,
            filename=f"sanitized{normalized_image.extension}",
            content_type=normalized_image.content_type,
            patient_id=patient_id,
        )

        ai_support = build_ai_support_fields(raw_result)
        record = SkinAnalysis(
            user_id=user.id,
            uploaded_by_id=user.id,
            appointment_id=appointment_id,
            image_path=storage_path,
            condition=ai_support["condition"],
            confidence=raw_result.get("confidence", 0),
            severity=ai_support["severity"],
            recommendation=ai_support["recommendation"],
            doctor_note=(doctor_note or "").strip() or None,
            review_status="Pending Review",
            reviewed_at=None,
            reviewed_by_doctor_id=None,
            doctor_signed_off_at=None,
            is_patient_visible=False,
            possible_conditions=ai_support["possible_conditions"],
            key_findings=ai_support["key_findings"],
            treatment_suggestions=ai_support["treatment_suggestions"],
            prescription_suggestions=ai_support["prescription_suggestions"],
            follow_up_suggestions=ai_support["follow_up_suggestions"],
            red_flags=ai_support["red_flags"],
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        return {"status": "success", "message": "AI analysis created successfully.", "analysis": serialize_analysis(record)}
    finally:
        delete_temp_file(temp_file_path)


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
    return {"message": "Analysis updated successfully", "analysis": serialize_analysis(analysis)}
