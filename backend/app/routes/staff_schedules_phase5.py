from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.clock import clinic_now, get_clinic_timezone
from app.core.security import get_current_user
from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.clinic_unavailable_date import ClinicUnavailableDate
from app.models.doctor_schedule import DoctorSchedule
from app.models.user import User
from app.routes import staff_schedules as legacy

router = APIRouter(prefix="/staff", tags=["Staff Schedules"])


def _is_past_schedule(schedule: DoctorSchedule) -> bool:
    selected_start = datetime.combine(
        schedule.schedule_date,
        schedule.start_time,
        tzinfo=get_clinic_timezone(),
    )
    return selected_start <= clinic_now()


def _linked_appointment_count(db: Session, schedule_id: int) -> int:
    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.schedule_id == schedule_id)
        .count()
    )


def _normalized_services(value: str) -> tuple[str, ...]:
    return tuple(
        sorted(legacy.normalize_text(item) for item in legacy.parse_services(value))
    )


def _changes_booking_fields(
    schedule: DoctorSchedule,
    payload: legacy.DoctorScheduleUpdate,
) -> bool:
    if payload.doctor_id is not None and payload.doctor_id != schedule.doctor_id:
        return True
    if payload.schedule_date is not None and payload.schedule_date != schedule.schedule_date:
        return True
    if payload.start_time is not None and payload.start_time != schedule.start_time:
        return True
    if payload.end_time is not None and payload.end_time != schedule.end_time:
        return True
    if payload.consultation_mode is not None:
        if payload.consultation_mode.strip() != (schedule.consultation_mode or "In-Person"):
            return True
    if payload.services is not None:
        if _normalized_services(payload.services) != _normalized_services(schedule.services):
            return True
    return False


@router.put("/doctor-schedules/{schedule_id}")
def update_doctor_schedule(
    schedule_id: int,
    payload: legacy.DoctorScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    legacy.require_staff_or_admin(current_user)
    schedule = db.query(DoctorSchedule).filter(DoctorSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    if _is_past_schedule(schedule):
        raise HTTPException(
            status_code=409,
            detail="Past schedules are retained for appointment history and cannot be edited.",
        )

    linked_appointments = _linked_appointment_count(db, schedule.id)
    if linked_appointments and _changes_booking_fields(schedule, payload):
        raise HTTPException(
            status_code=409,
            detail=(
                "This schedule is linked to appointment records. Doctor, date, time, "
                "services, and consultation mode are locked; availability and notes can still be updated."
            ),
        )

    return legacy.update_doctor_schedule(schedule_id, payload, db, current_user)


@router.delete("/doctor-schedules/{schedule_id}")
def delete_doctor_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    legacy.require_staff_or_admin(current_user)
    schedule = db.query(DoctorSchedule).filter(DoctorSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    if _is_past_schedule(schedule):
        raise HTTPException(
            status_code=409,
            detail="Past schedules are retained for appointment history and cannot be deleted.",
        )

    linked_appointments = _linked_appointment_count(db, schedule.id)
    if linked_appointments:
        raise HTTPException(
            status_code=409,
            detail=(
                "This schedule is linked to appointment records and cannot be deleted. "
                "Mark it unavailable instead if it should no longer accept bookings."
            ),
        )

    return legacy.delete_doctor_schedule(schedule_id, db, current_user)


@router.delete("/clinic-unavailable-dates/{closure_id}")
def delete_clinic_unavailable_date(
    closure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    legacy.require_staff_or_admin(current_user)
    unavailable_date = (
        db.query(ClinicUnavailableDate)
        .filter(ClinicUnavailableDate.id == closure_id)
        .first()
    )
    if not unavailable_date:
        raise HTTPException(status_code=404, detail="Unavailable date not found.")

    if unavailable_date.closure_date < clinic_now().date():
        raise HTTPException(
            status_code=409,
            detail="Past clinic closure dates are retained for history and cannot be deleted.",
        )

    return legacy.delete_clinic_unavailable_date(closure_id, db, current_user)
