from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.skin_analysis import SkinAnalysis
from app.models.appointment import AppointmentModel
from app.models.user import User
from app.core.security import get_current_user
from app.ml.predict_skin import predict_skin_condition
from app.core.storage import (
    get_safe_extension,
    save_temp_image,
    delete_temp_file,
    upload_skin_bytes_to_supabase,
    create_signed_image_url,
)

router = APIRouter(prefix="/ai", tags=["AI Analysis"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_staff_or_doctor(user: User = Depends(get_current_user)):
    if user.role not in ["staff", "doctor", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Staff, doctor, or admin access only",
        )

    return user


def require_doctor(user: User = Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")

    return user


def build_ai_support_fields(result: dict) -> dict:
    condition = result.get("predicted_condition", "Unknown")
    confidence = result.get("confidence", 0)
    treatment_list = result.get("treatment_suggestions", [])
    follow_up = result.get("follow_up_suggestions", "")
    red_flags = result.get("red_flags", [])

    severity = "Needs Doctor Review"
    possible_conditions = condition

    key_findings = (
        f"AI prediction suggests {condition} with "
        f"{round(confidence * 100, 2)}% confidence. "
        f"Final assessment must be confirmed by the doctor."
    )

    if treatment_list:
        treatment_suggestions = "\n".join(
            [
                f"- {item.get('medication', 'Unknown medication')}: "
                f"{item.get('usage', 'No usage provided')} "
                f"({item.get('reason', 'No reason provided')})"
                for item in treatment_list
            ]
        )

        prescription_suggestions = "\n".join(
            [
                f"- {item.get('medication', 'Unknown medication')} | "
                f"Usage: {item.get('usage', 'No usage provided')} | "
                f"Reason: {item.get('reason', 'No reason provided')}"
                for item in treatment_list
            ]
        )

        recommendation = "; ".join(
            [
                item.get("medication", "Unknown medication")
                for item in treatment_list
            ]
        )
    else:
        treatment_suggestions = "Further clinical review is recommended."
        prescription_suggestions = (
            f"Consider appropriate medication options for suspected {condition}, "
            f"subject to doctor evaluation."
        )
        recommendation = "Further clinical review is recommended."

    follow_up_suggestions = (
        follow_up
        if follow_up
        else "Monitor skin response and schedule follow-up if symptoms persist, worsen, or fail to improve."
    )

    red_flags_text = (
        "\n".join([f"- {flag}" for flag in red_flags])
        if red_flags
        else "Immediate review may be needed if there is rapid spreading, severe inflammation, bleeding, infection, or pain."
    )

    return {
        "condition": condition,
        "severity": severity,
        "recommendation": recommendation,
        "possible_conditions": possible_conditions,
        "key_findings": key_findings,
        "treatment_suggestions": treatment_suggestions,
        "prescription_suggestions": prescription_suggestions,
        "follow_up_suggestions": follow_up_suggestions,
        "red_flags": red_flags_text,
    }


def serialize_analysis(analysis: SkinAnalysis) -> dict:
    return {
        "id": analysis.id,
        "appointment_id": analysis.appointment_id,
        "uploaded_by_id": analysis.uploaded_by_id,
        "image_path": create_signed_image_url(analysis.image_path),
        "condition": analysis.condition,
        "confidence": analysis.confidence,
        "severity": analysis.severity,
        "recommendation": analysis.recommendation,
        "doctor_note": analysis.doctor_note,
        "review_status": analysis.review_status,
        "reviewed_at": analysis.reviewed_at.isoformat()
        if analysis.reviewed_at
        else None,
        "possible_conditions": analysis.possible_conditions,
        "key_findings": analysis.key_findings,
        "treatment_suggestions": analysis.treatment_suggestions,
        "prescription_suggestions": analysis.prescription_suggestions,
        "follow_up_suggestions": analysis.follow_up_suggestions,
        "red_flags": analysis.red_flags,
        "created_at": analysis.created_at.isoformat()
        if analysis.created_at
        else None,
    }


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image(
    appointment_id: int,
    file: UploadFile = File(...),
    doctor_note: str = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
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

    existing_analysis = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.appointment_id == appointment_id)
        .first()
    )

    if existing_analysis:
        raise HTTPException(
            status_code=400,
            detail="AI analysis already exists for this consultation.",
        )

    allowed_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    extension = get_safe_extension(file.filename, file.content_type)

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Please upload JPG, PNG, or WEBP.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    temp_file_path = save_temp_image(file_bytes, extension)

    try:
        raw_result = predict_skin_condition(temp_file_path)

        patient_id = getattr(appointment, "patient_id", None)

        storage_path = upload_skin_bytes_to_supabase(
            file_bytes=file_bytes,
            appointment_id=appointment_id,
            filename=file.filename,
            content_type=file.content_type,
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
            doctor_note=doctor_note,
            review_status="Pending Review",
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

        return {
            "status": "success",
            "message": "AI analysis created successfully.",
            "analysis": serialize_analysis(record),
        }

    finally:
        delete_temp_file(temp_file_path)


@router.get("/appointment/{appointment_id}")
def get_analysis_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
    appointment = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    analyses = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.appointment_id == appointment_id)
        .order_by(SkinAnalysis.created_at.desc())
        .all()
    )

    return [serialize_analysis(analysis) for analysis in analyses]


@router.put("/review/{analysis_id}")
def review_analysis(
    analysis_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    analysis = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.id == analysis_id)
        .first()
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    editable_fields = [
        "doctor_note",
        "possible_conditions",
        "key_findings",
        "treatment_suggestions",
        "prescription_suggestions",
        "follow_up_suggestions",
        "red_flags",
    ]

    for field in editable_fields:
        if field in body:
            setattr(analysis, field, body[field])

    if "review_status" in body:
        allowed_statuses = ["Pending Review", "Reviewed"]

        if body["review_status"] not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid review status")

        analysis.review_status = body["review_status"]
        analysis.reviewed_at = (
            datetime.utcnow()
            if body["review_status"] == "Reviewed"
            else None
        )

    db.commit()
    db.refresh(analysis)

    return {
        "message": "Analysis updated successfully",
        "analysis": serialize_analysis(analysis),
    }