from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.follow_up import FollowUp
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/staff/follow-ups",
    tags=["Staff Follow-Ups"]
)


VALID_FOLLOW_UP_STATUSES = {
    "Scheduled",
    "Completed",
    "Cancelled",
}


class StaffFollowUpUpdate(BaseModel):
    follow_up_date: Optional[date] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def require_staff_or_admin(current_user: User):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only staff or admin can access this resource."
        )


def clean_optional_text(value: Optional[str]):
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned if cleaned else None


def serialize_follow_up(follow_up: FollowUp, db: Session):
    patient = (
        db.query(User)
        .filter(User.id == follow_up.patient_id)
        .first()
    )

    doctor = (
        db.query(User)
        .filter(User.id == follow_up.doctor_id)
        .first()
    )

    appointment = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.id == follow_up.appointment_id)
        .first()
    )

    return {
        "id": follow_up.id,

        "appointment_id": follow_up.appointment_id,
        "appointment_services": appointment.services if appointment else None,
        "appointment_date": appointment.date.isoformat() if appointment and appointment.date else None,
        "appointment_time": appointment.time.strftime("%H:%M") if appointment and appointment.time else None,
        "appointment_end_time": appointment.end_time.strftime("%H:%M") if appointment and appointment.end_time else None,
        "appointment_status": appointment.status if appointment else None,

        "patient_id": follow_up.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_email": patient.email if patient else None,
        "patient_contact": patient.contact if patient else None,
        "patient_address": patient.address if patient else None,

        "doctor_id": follow_up.doctor_id,
        "doctor_name": doctor.name if doctor else None,

        "follow_up_date": follow_up.follow_up_date.isoformat(),
        "reason": follow_up.reason,
        "notes": follow_up.notes,
        "status": follow_up.status,
        "created_at": follow_up.created_at.isoformat() if follow_up.created_at else None,
    }


@router.get("")
def get_staff_follow_ups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff_or_admin(current_user)

    follow_ups = (
        db.query(FollowUp)
        .order_by(
            FollowUp.follow_up_date.asc(),
            FollowUp.id.desc()
        )
        .all()
    )

    return [serialize_follow_up(item, db) for item in follow_ups]


@router.get("/{follow_up_id}")
def get_staff_follow_up_by_id(
    follow_up_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff_or_admin(current_user)

    follow_up = (
        db.query(FollowUp)
        .filter(FollowUp.id == follow_up_id)
        .first()
    )

    if not follow_up:
        raise HTTPException(
            status_code=404,
            detail="Follow-up schedule not found."
        )

    return serialize_follow_up(follow_up, db)


@router.put("/{follow_up_id}")
def update_staff_follow_up(
    follow_up_id: int,
    payload: StaffFollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff_or_admin(current_user)

    follow_up = (
        db.query(FollowUp)
        .filter(FollowUp.id == follow_up_id)
        .first()
    )

    if not follow_up:
        raise HTTPException(
            status_code=404,
            detail="Follow-up schedule not found."
        )

    if payload.follow_up_date is not None:
        follow_up.follow_up_date = payload.follow_up_date

    if payload.reason is not None:
        reason = payload.reason.strip()

        if not reason:
            raise HTTPException(
                status_code=400,
                detail="Follow-up reason is required."
            )

        follow_up.reason = reason

    if payload.notes is not None:
        follow_up.notes = clean_optional_text(payload.notes)

    if payload.status is not None:
        status = payload.status.strip()

        if status not in VALID_FOLLOW_UP_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid follow-up status."
            )

        if status == "Completed" and follow_up.follow_up_date > date.today():
            raise HTTPException(
                status_code=400,
                detail="Follow-up can only be completed on or after its scheduled date."
            )

        follow_up.status = status

    db.commit()
    db.refresh(follow_up)

    return {
        "message": "Follow-up schedule updated successfully.",
        "follow_up": serialize_follow_up(follow_up, db),
    }
