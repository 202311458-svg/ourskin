from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.db import SessionLocal
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis


router = APIRouter(prefix="/appointments", tags=["Appointments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# GET /appointments/today
@router.get("/today")
def get_today_appointments(db: Session = Depends(get_db)):

    today = date.today()

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Approved")
        .all()
    )

    return appointments


# GET /appointments/requests
@router.get("/requests")
def get_pending_requests(db: Session = Depends(get_db)):

    requests = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Pending")
        .all()
    )

    return requests


# GET /appointments/confirmed
@router.get("/confirmed")
def get_confirmed_appointments(db: Session = Depends(get_db)):

    confirmed = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
        .all()
    )

    return confirmed


# PUT /appointments/{id}/status
@router.put("/{id}/status")
def update_appointment_status(id: int, body: dict, db: Session = Depends(get_db)):

    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = body["status"]

    db.commit()
    db.refresh(appointment)

    return {"message": "Appointment updated successfully"}


@router.post("/")
def create_appointment(data: dict = Body(...), db: Session = Depends(get_db)):

    appointment = AppointmentModel(
        patient_name=data["patient_name"],
        patient_email=data["patient_email"],
        doctor_name=data["doctor_name"],
        date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
        time=datetime.strptime(data["time"], "%H:%M:%S").time(),
        services=data["services"],
        status="Pending"
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return {"message": "Appointment created", "appointment": appointment}


@router.get("/list")
def get_patient_appointments(email: str, db: Session = Depends(get_db)):

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_email == email)
        .order_by(AppointmentModel.date.desc())
        .all()
    )

    return appointments


@router.get("/upcoming")
def get_upcoming_appointments(db: Session = Depends(get_db)):

    today = date.today()

    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
        .filter(AppointmentModel.date >= today)
        .order_by(AppointmentModel.date.asc())
        .all()
    )
    
    
    
@router.get("/history-with-analysis")
def get_patient_history(email: str, db: Session = Depends(get_db)):

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_email == email)
        .order_by(AppointmentModel.date.asc())
        .all()
    )

    results = []

    for appt in appointments:
        analyses = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.appointment_id == appt.id)
            .all()
        )

        results.append({
            "appointment": appt,
            "analyses": analyses
        })

    return results