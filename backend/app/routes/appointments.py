from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.db import SessionLocal
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentStatusUpdate
from app.core.security import get_current_user

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = (
        db.query(User)
        .filter(User.id == data.doctor_id, User.role == "doctor", User.status == "Active")
        .first()
    )

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # patient books for themselves by default
    patient = current_user

    # allow staff/admin to book on behalf of a patient
    if current_user.role in ["staff", "admin"] and data.patient_id:
        patient = (
            db.query(User)
            .filter(User.id == data.patient_id, User.role == "patient")
            .first()
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

    if patient.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can own appointments")

    appointment = AppointmentModel(
        patient_id=patient.id,
        doctor_id=doctor.id,
        patient_name=patient.name,
        patient_email=patient.email,
        doctor_name=doctor.name,
        date=data.date,
        time=data.time,
        services=data.services,
        status="Pending",
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return {
        "message": "Appointment created",
        "appointment": appointment,
    }


@router.get("/my")
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only")

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_id == current_user.id)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .all()
    )

    return [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "doctor_id": a.doctor_id,
            "patient_name": a.patient_name,
            "patient_email": a.patient_email,
            "doctor_name": a.doctor_name,
            "date": str(a.date),
            "time": str(a.time),
            "services": a.services,
            "status": a.status,
            "cancel_reason": a.cancel_reason,
        }
        for a in appointments
    ]


@router.put("/{id}/status")
def update_appointment_status(
    id: int,
    body: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    allowed_statuses = ["Pending", "Approved", "Declined", "Cancelled", "Completed"]
    if body.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    # PATIENT RULES
    if current_user.role == "patient":
        if appointment.patient_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only modify your own appointment")

        if body.status != "Cancelled":
            raise HTTPException(status_code=403, detail="Patients can only cancel appointments")

        if appointment.status != "Pending":
            raise HTTPException(status_code=400, detail="Only pending appointments can be cancelled")

        if not body.cancel_reason or not body.cancel_reason.strip():
            raise HTTPException(status_code=400, detail="Cancellation reason is required")

    # STAFF / ADMIN / DOCTOR RULES
    elif current_user.role in ["staff", "admin", "doctor"]:
        if body.status in ["Declined", "Cancelled"] and (
            not body.cancel_reason or not body.cancel_reason.strip()
        ):
            raise HTTPException(status_code=400, detail="Reason is required")

    else:
        raise HTTPException(status_code=403, detail="Not allowed")

    appointment.status = body.status

    if body.status in ["Declined", "Cancelled"]:
        appointment.cancel_reason = body.cancel_reason.strip()
    else:
        appointment.cancel_reason = None

    db.commit()
    db.refresh(appointment)

    return {"message": "Appointment updated successfully"}

@router.get("/today")
def get_today_appointments(db: Session = Depends(get_db)):
    today = date.today()

    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Approved")
        .all()
    )


@router.get("/requests")
def get_pending_requests(db: Session = Depends(get_db)):
    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Pending")
        .all()
    )


@router.get("/confirmed")
def get_confirmed_appointments(db: Session = Depends(get_db)):
    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
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
            .order_by(SkinAnalysis.created_at.desc())
            .all()
        )

        results.append({
            "appointment": appt,
            "analyses": analyses
        })

    return results