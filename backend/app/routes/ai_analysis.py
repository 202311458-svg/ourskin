from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.orm import Session
import shutil
import uuid

from app.db import get_db
from app.models.skin_analysis import SkinAnalysis
from app.core.security import get_current_user
from app.ai.predictor import analyze_skin
from fastapi import HTTPException
from app.models.appointment import AppointmentModel

router = APIRouter(
    prefix="/ai",
    tags=["AI Analysis"]
)


@router.post("/analyze/{appointment_id}")
async def analyze_skin_image(
    appointment_id: int,
    file: UploadFile = File(...),
    doctor_note: str = Form(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id
    ).first()

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
        appointment_id=appointment_id,
        image_path=public_path,
        condition=result["condition"],
        confidence=result["confidence"],
        severity=result["severity"],
        recommendation=result["recommendation"],
        doctor_note=doctor_note
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "analysis": result
    }
    
    
@router.post("/save-note/{appointment_id}")
def save_doctor_note(
    appointment_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    analysis = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.appointment_id == appointment_id)
        .order_by(SkinAnalysis.id.desc())
        .first()
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found")

    analysis.doctor_note = body.get("doctor_note")

    db.commit()
    db.refresh(analysis)

    return {"message": "Note saved"}