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

    if "doctor_note" in body:
        analysis.doctor_note = body["doctor_note"]

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