from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.appointment import AppointmentModel

router = APIRouter()

@router.get("/list/")
def list_appointments(email: str, db: Session = Depends(get_db)):
    appointments = db.query(AppointmentModel).filter(AppointmentModel.patient_email == email).all()
    return [ 
        {
            "id": a.id,
            "doctor": a.doctor_name,
            "date": a.date.isoformat(),
            "time": a.time,
            "services": a.services,
            "status": a.status,
            "cancel_reason": a.cancel_reason,
        }
        for a in appointments
    ]