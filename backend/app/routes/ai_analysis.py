from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session
import shutil
import uuid

from app.db import SessionLocal
from app.models.skin_analysis import SkinAnalysis
from app.models.appointment import AppointmentModel
from app.models.user import User
from app.core.security import get_current_user
from app.ai.predictor import analyze_skin

router = APIRouter(prefix="/ai", tags=["AI Analysis"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_staff_or_doctor(user: User = Depends(get_current_user)):
    if user.role not in ["staff", "doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Staff, doctor, or admin access only")
    return user


def require_doctor(user: User = Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return user


def build_ai_support_fields(result: dict) -> dict:
    condition = result.get("condition", "Unknown")
    severity = result.get("severity", "Unknown")
    recommendation = result.get("recommendation", "")

    possible_conditions = condition

    key_findings = f"AI detected skin features suggestive of {condition} with {severity} severity."

    treatment_suggestions = recommendation if recommendation else "Further clinical review is recommended."

    prescription_suggestions = (
        f"Consider appropriate medication options for suspected {condition}, subject to doctor evaluation."
    )

    follow_up_suggestions = (
        "Monitor skin response and schedule follow-up if symptoms persist, worsen, or fail to improve."
    )

    red_flags = (
        "Immediate review may be needed if there is rapid spreading, severe inflammation, bleeding, infection, or pain."
    )

    return {
        "possible_conditions": possible_conditions,
        "key_findings": key_findings,
        "treatment_suggestions": treatment_suggestions,
        "prescription_suggestions": prescription_suggestions,
        "follow_up_suggestions": follow_up_suggestions,
        "red_flags": red_flags,
    }


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image(
    appointment_id: int,
    file: UploadFile = File(...),
    doctor_note: str = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    file_id = str(uuid.uuid4())
    file_path = f"app/uploads/{file_id}.jpg"
    public_path = f"/uploads/{file_id}.jpg"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_skin(file_path)
    ai_support = build_ai_support_fields(result)

    record = SkinAnalysis(
        user_id=user.id,
        uploaded_by_id=user.id,
        appointment_id=appointment_id,
        image_path=public_path,
        condition=result["condition"],
        confidence=result["confidence"],
        severity=result["severity"],
        recommendation=result["recommendation"],
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
        "analysis": {
            "id": record.id,
            "appointment_id": record.appointment_id,
            "image_path": record.image_path,
            "condition": record.condition,
            "confidence": record.confidence,
            "severity": record.severity,
            "recommendation": record.recommendation,
            "doctor_note": record.doctor_note,
            "review_status": record.review_status,
            "reviewed_at": record.reviewed_at,
            "possible_conditions": record.possible_conditions,
            "key_findings": record.key_findings,
            "treatment_suggestions": record.treatment_suggestions,
            "prescription_suggestions": record.prescription_suggestions,
            "follow_up_suggestions": record.follow_up_suggestions,
            "red_flags": record.red_flags,
            "created_at": record.created_at,
        },
    }


@router.get("/appointment/{appointment_id}")
def get_analysis_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    analyses = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.appointment_id == appointment_id)
        .order_by(SkinAnalysis.created_at.desc())
        .all()
    )

    return analyses


@router.put("/review/{analysis_id}")
def review_analysis(
    analysis_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    analysis = db.query(SkinAnalysis).filter(SkinAnalysis.id == analysis_id).first()

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
        analysis.reviewed_at = datetime.utcnow() if body["review_status"] == "Reviewed" else None

    db.commit()
    db.refresh(analysis)

    return {
        "message": "Analysis updated successfully",
        "analysis": analysis,
    }