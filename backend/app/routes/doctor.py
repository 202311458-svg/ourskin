from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import User
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.models.follow_up import FollowUp
from app.core.security import get_current_user
from app.schemas.user import DoctorProfileUpdate
from app.schemas.follow_up import FollowUpCreate, FollowUpUpdate
from app.schemas.appointment import AppointmentStatusUpdate

router = APIRouter(prefix="/doctor", tags=["Doctor Portal"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_doctor(current_user: User = Depends(get_current_user)):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return current_user


def serialize_appointment(appt: AppointmentModel):
    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "doctor_id": appt.doctor_id,
        "patient_name": appt.patient_name,
        "patient_email": appt.patient_email,
        "doctor_name": appt.doctor_name,
        "date": str(appt.date),
        "time": str(appt.time),
        "services": appt.services,
        "status": appt.status,
        "cancel_reason": appt.cancel_reason,
    }


def serialize_analysis(analysis: SkinAnalysis):
    return {
        "id": analysis.id,
        "appointment_id": analysis.appointment_id,
        "uploaded_by_id": analysis.uploaded_by_id,
        "image_path": analysis.image_path,
        "condition": analysis.condition,
        "confidence": analysis.confidence,
        "severity": analysis.severity,
        "recommendation": analysis.recommendation,
        "doctor_note": analysis.doctor_note,
        "review_status": analysis.review_status,
        "reviewed_at": analysis.reviewed_at.isoformat() if analysis.reviewed_at else None,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


def serialize_follow_up(item: FollowUp, doctor_name: str | None = None):
    return {
        "id": item.id,
        "appointment_id": item.appointment_id,
        "patient_id": item.patient_id,
        "doctor_id": item.doctor_id,
        "doctor_name": doctor_name,
        "follow_up_date": str(item.follow_up_date),
        "reason": item.reason,
        "notes": item.notes,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.get("/dashboard")
def doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    today = date.today()

    todays_appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .order_by(AppointmentModel.time.asc())
        .all()
    )

    pending_ai = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(SkinAnalysis.review_status == "Pending Review")
        .order_by(SkinAnalysis.created_at.desc())
        .all()
    )

    follow_ups_due = (
        db.query(FollowUp)
        .filter(FollowUp.follow_up_date <= today)
        .filter(FollowUp.status == "Scheduled")
        .count()
    )

    completed_today = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Completed")
        .count()
    )

    urgent_cases = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.severity.in_(["High", "Severe"]))
        .order_by(SkinAnalysis.created_at.desc())
        .limit(5)
        .all()
    )

    recent_records = (
        db.query(AppointmentModel)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "todays_appointments": len(todays_appointments),
            "pending_ai_reviews": len(pending_ai),
            "follow_ups_due": follow_ups_due,
            "completed_today": completed_today,
        },
        "todays_schedule": [serialize_appointment(a) for a in todays_appointments],
        "ai_queue": [serialize_analysis(a) for a in pending_ai[:5]],
        "recent_records": [serialize_appointment(a) for a in recent_records],
        "urgent_cases": [serialize_analysis(a) for a in urgent_cases],
    }


@router.get("/appointments")
def get_doctor_appointments(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = db.query(AppointmentModel)

    if status:
        query = query.filter(AppointmentModel.status == status)

    appointments = query.order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc()).all()
    return [serialize_appointment(a) for a in appointments]


@router.put("/appointments/{appointment_id}/status")
def update_doctor_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    allowed_statuses = ["Pending", "Approved", "Declined", "Completed"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    if payload.status == "Declined" and not payload.cancel_reason:
        raise HTTPException(status_code=400, detail="Cancel reason is required")

    appointment.status = payload.status
    appointment.cancel_reason = payload.cancel_reason if payload.status == "Declined" else None

    db.commit()
    db.refresh(appointment)

    return {"message": "Appointment updated successfully", "appointment": serialize_appointment(appointment)}


@router.get("/ai-cases")
def get_doctor_ai_cases(
    review_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = db.query(SkinAnalysis)

    if review_status:
        query = query.filter(SkinAnalysis.review_status == review_status)

    cases = query.order_by(SkinAnalysis.created_at.desc()).all()
    return [serialize_analysis(item) for item in cases]


@router.get("/patient-records")
def get_doctor_patient_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointments = (
        db.query(AppointmentModel)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
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
            "appointment": serialize_appointment(appt),
            "analyses": [serialize_analysis(a) for a in analyses],
        })

    return results


@router.get("/follow-ups")
def get_doctor_follow_ups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    items = (
        db.query(FollowUp)
        .order_by(FollowUp.follow_up_date.asc())
        .all()
    )

    doctor_ids = list({item.doctor_id for item in items if item.doctor_id})
    doctors = db.query(User).filter(User.id.in_(doctor_ids)).all()
    doctor_map = {doctor.id: doctor.name for doctor in doctors}

    return [
        serialize_follow_up(item, doctor_map.get(item.doctor_id))
        for item in items
    ]


@router.post("/follow-ups")
def create_follow_up(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == payload.appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    follow_up = FollowUp(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id if appointment.doctor_id else current_user.id,
        follow_up_date=payload.follow_up_date,
        reason=payload.reason,
        notes=payload.notes,
        status="Scheduled",
    )

    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)

    doctor_name = None
    if follow_up.doctor_id:
        doctor = db.query(User).filter(User.id == follow_up.doctor_id).first()
        doctor_name = doctor.name if doctor else None

    return {
        "message": "Follow-up created successfully",
        "follow_up": serialize_follow_up(follow_up, doctor_name),
    }


@router.put("/follow-ups/{follow_up_id}")
def update_follow_up(
    follow_up_id: int,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    follow_up = db.query(FollowUp).filter(FollowUp.id == follow_up_id).first()

    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(follow_up, key, value)

    db.commit()
    db.refresh(follow_up)

    doctor_name = None
    if follow_up.doctor_id:
        doctor = db.query(User).filter(User.id == follow_up.doctor_id).first()
        doctor_name = doctor.name if doctor else None

    return {
        "message": "Follow-up updated successfully",
        "follow_up": serialize_follow_up(follow_up, doctor_name),
    }


@router.get("/settings")
def get_doctor_settings(current_user: User = Depends(require_doctor)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "contact": current_user.contact,
        "profile_image": current_user.profile_image,
        "specialty": current_user.specialty,
        "availability": current_user.availability,
        "bio": current_user.bio,
    }


@router.put("/settings")
def update_doctor_settings(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Doctor settings updated successfully",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "contact": current_user.contact,
            "profile_image": current_user.profile_image,
            "specialty": current_user.specialty,
            "availability": current_user.availability,
            "bio": current_user.bio,
        },
    }