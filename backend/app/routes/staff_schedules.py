from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.models.doctor_schedule import DoctorSchedule
from app.routes.auth import get_current_user
from app.models.clinic_unavailable_date import ClinicUnavailableDate

router = APIRouter(
    prefix="/staff",
    tags=["Staff Schedules"]
)


CONSULTATION_MODES = ["In-Person", "Online Consultation"]

UNAVAILABLE_REASONS = [
    "Holiday",
    "Doctor Leave",
    "Clinic Event",
    "Emergency Closure",
    "Other",
]


class DoctorScheduleCreate(BaseModel):
    doctor_id: int
    services: str
    schedule_date: date
    start_time: time
    end_time: time
    is_available: bool = True
    consultation_mode: str = "In-Person"
    unavailable_reason: Optional[str] = None
    schedule_note: Optional[str] = None


class DoctorScheduleUpdate(BaseModel):
    doctor_id: Optional[int] = None
    services: Optional[str] = None
    schedule_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None
    consultation_mode: Optional[str] = None
    unavailable_reason: Optional[str] = None
    schedule_note: Optional[str] = None
    
    
class ClinicUnavailableDateCreate(BaseModel):
    closure_date: date
    reason: str
    note: Optional[str] = None


class ClinicUnavailableDateUpdate(BaseModel):
    closure_date: Optional[date] = None
    reason: Optional[str] = None
    note: Optional[str] = None


def require_staff_or_admin(current_user: User):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only staff or admin can access this resource."
        )


def format_time(value):
    if value is None:
        return None

    return value.strftime("%H:%M")


def clean_optional_text(value: Optional[str]):
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned if cleaned else None


def is_sunday(schedule_date: date):
    return schedule_date.weekday() == 6


def validate_consultation_mode(consultation_mode: str):
    cleaned_mode = consultation_mode.strip()

    if cleaned_mode not in CONSULTATION_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid consultation mode."
        )

    return cleaned_mode


def validate_unavailable_reason(is_available: bool, unavailable_reason: Optional[str]):
    cleaned_reason = clean_optional_text(unavailable_reason)

    if is_available:
        return None

    if not cleaned_reason:
        raise HTTPException(
            status_code=400,
            detail="Please provide a reason for marking this schedule unavailable."
        )

    if cleaned_reason not in UNAVAILABLE_REASONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid unavailable reason."
        )

    return cleaned_reason


def has_overlapping_schedule(
    db: Session,
    doctor_id: int,
    schedule_date: date,
    start_time: time,
    end_time: time,
    exclude_schedule_id: Optional[int] = None
):
    query = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.schedule_date == schedule_date,
        DoctorSchedule.start_time < end_time,
        DoctorSchedule.end_time > start_time,
    )

    if exclude_schedule_id is not None:
        query = query.filter(DoctorSchedule.id != exclude_schedule_id)

    return query.first() is not None


def serialize_schedule(schedule: DoctorSchedule, db: Session):
    doctor = db.query(User).filter(User.id == schedule.doctor_id).first()

    staff = None
    if schedule.created_by_staff_id:
        staff = db.query(User).filter(User.id == schedule.created_by_staff_id).first()

    return {
        "id": schedule.id,
        "doctor_id": schedule.doctor_id,
        "doctor_name": doctor.name if doctor else "Unknown Doctor",
        "services": schedule.services,
        "schedule_date": schedule.schedule_date.isoformat(),
        "start_time": format_time(schedule.start_time),
        "end_time": format_time(schedule.end_time),
        "is_available": schedule.is_available,
        "consultation_mode": schedule.consultation_mode or "In-Person",
        "unavailable_reason": schedule.unavailable_reason,
        "schedule_note": schedule.schedule_note,
        "created_by_staff_id": schedule.created_by_staff_id,
        "created_by_staff_name": staff.name if staff else None,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


def serialize_clinic_unavailable_date(item: ClinicUnavailableDate, db: Session):
    staff = None

    if item.created_by_staff_id:
        staff = db.query(User).filter(User.id == item.created_by_staff_id).first()

    return {
        "id": item.id,
        "closure_date": item.closure_date.isoformat(),
        "reason": item.reason,
        "note": item.note,
        "created_by_staff_id": item.created_by_staff_id,
        "created_by_staff_name": staff.name if staff else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/doctors")
def get_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    doctors = (
        db.query(User)
        .filter(User.role == "doctor")
        .order_by(User.name.asc())
        .all()
    )

    return [
        {
            "id": doctor.id,
            "name": doctor.name,
            "email": doctor.email,
            "specialty": doctor.specialty,
            "availability": doctor.availability,
            "status": doctor.status,
        }
        for doctor in doctors
    ]


@router.get("/doctor-schedules")
def get_doctor_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    schedules = (
        db.query(DoctorSchedule)
        .order_by(
            DoctorSchedule.schedule_date.asc(),
            DoctorSchedule.start_time.asc()
        )
        .all()
    )

    return [serialize_schedule(schedule, db) for schedule in schedules]


@router.post("/doctor-schedules")
def create_doctor_schedule(
    payload: DoctorScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    doctor = (
        db.query(User)
        .filter(User.id == payload.doctor_id, User.role == "doctor")
        .first()
    )

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    services = payload.services.strip()

    if not services:
        raise HTTPException(
            status_code=400,
            detail="Services field is required."
        )

    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be later than start time."
        )

    if is_sunday(payload.schedule_date):
        raise HTTPException(
            status_code=400,
            detail="Sundays are unavailable for scheduling."
        )

    consultation_mode = validate_consultation_mode(payload.consultation_mode)

    unavailable_reason = validate_unavailable_reason(
        is_available=payload.is_available,
        unavailable_reason=payload.unavailable_reason
    )

    if has_overlapping_schedule(
        db=db,
        doctor_id=payload.doctor_id,
        schedule_date=payload.schedule_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
    ):
        raise HTTPException(
            status_code=409,
            detail="This schedule overlaps with an existing doctor schedule."
        )

    schedule = DoctorSchedule(
        doctor_id=payload.doctor_id,
        services=services,
        schedule_date=payload.schedule_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_available=payload.is_available,
        consultation_mode=consultation_mode,
        unavailable_reason=unavailable_reason,
        schedule_note=clean_optional_text(payload.schedule_note),
        created_by_staff_id=current_user.id,
    )

    try:
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This doctor already has the same schedule slot."
        )

    return serialize_schedule(schedule, db)


@router.put("/doctor-schedules/{schedule_id}")
def update_doctor_schedule(
    schedule_id: int,
    payload: DoctorScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    if payload.doctor_id is not None:
        doctor = (
            db.query(User)
            .filter(User.id == payload.doctor_id, User.role == "doctor")
            .first()
        )

        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found.")

        schedule.doctor_id = payload.doctor_id

    if payload.services is not None:
        services = payload.services.strip()

        if not services:
            raise HTTPException(
                status_code=400,
                detail="Services field is required."
            )

        schedule.services = services

    if payload.schedule_date is not None:
        schedule.schedule_date = payload.schedule_date

    if payload.start_time is not None:
        schedule.start_time = payload.start_time

    if payload.end_time is not None:
        schedule.end_time = payload.end_time

    if payload.is_available is not None:
        schedule.is_available = payload.is_available

    if payload.consultation_mode is not None:
        schedule.consultation_mode = validate_consultation_mode(
            payload.consultation_mode
        )

    if payload.unavailable_reason is not None:
        schedule.unavailable_reason = clean_optional_text(
            payload.unavailable_reason
        )

    if payload.schedule_note is not None:
        schedule.schedule_note = clean_optional_text(payload.schedule_note)

    if schedule.end_time <= schedule.start_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be later than start time."
        )

    if is_sunday(schedule.schedule_date):
        raise HTTPException(
            status_code=400,
            detail="Sundays are unavailable for scheduling."
        )

    if not schedule.is_available:
        schedule.unavailable_reason = validate_unavailable_reason(
            is_available=False,
            unavailable_reason=schedule.unavailable_reason
        )
    else:
        schedule.unavailable_reason = None

    if has_overlapping_schedule(
        db=db,
        doctor_id=schedule.doctor_id,
        schedule_date=schedule.schedule_date,
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        exclude_schedule_id=schedule.id,
    ):
        raise HTTPException(
            status_code=409,
            detail="This schedule overlaps with an existing doctor schedule."
        )

    try:
        db.commit()
        db.refresh(schedule)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This doctor already has the same schedule slot."
        )

    return serialize_schedule(schedule, db)


@router.delete("/doctor-schedules/{schedule_id}")
def delete_doctor_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    db.delete(schedule)
    db.commit()

    return {"message": "Schedule deleted successfully."}


@router.get("/clinic-unavailable-dates")
def get_clinic_unavailable_dates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    unavailable_dates = (
        db.query(ClinicUnavailableDate)
        .order_by(ClinicUnavailableDate.closure_date.asc())
        .all()
    )

    return [
        serialize_clinic_unavailable_date(item, db)
        for item in unavailable_dates
    ]


@router.post("/clinic-unavailable-dates")
def create_clinic_unavailable_date(
    payload: ClinicUnavailableDateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    reason = payload.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Unavailable reason is required."
        )

    if is_sunday(payload.closure_date):
        raise HTTPException(
            status_code=400,
            detail="Sundays are already unavailable by default."
        )

    unavailable_date = ClinicUnavailableDate(
        closure_date=payload.closure_date,
        reason=reason,
        note=clean_optional_text(payload.note),
        created_by_staff_id=current_user.id,
    )

    try:
        db.add(unavailable_date)
        db.commit()
        db.refresh(unavailable_date)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This date is already marked unavailable."
        )

    return serialize_clinic_unavailable_date(unavailable_date, db)


@router.put("/clinic-unavailable-dates/{closure_id}")
def update_clinic_unavailable_date(
    closure_id: int,
    payload: ClinicUnavailableDateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    unavailable_date = (
        db.query(ClinicUnavailableDate)
        .filter(ClinicUnavailableDate.id == closure_id)
        .first()
    )

    if not unavailable_date:
        raise HTTPException(status_code=404, detail="Unavailable date not found.")

    if payload.closure_date is not None:
        if is_sunday(payload.closure_date):
            raise HTTPException(
                status_code=400,
                detail="Sundays are already unavailable by default."
            )

        unavailable_date.closure_date = payload.closure_date

    if payload.reason is not None:
        reason = payload.reason.strip()

        if not reason:
            raise HTTPException(
                status_code=400,
                detail="Unavailable reason is required."
            )

        unavailable_date.reason = reason

    if payload.note is not None:
        unavailable_date.note = clean_optional_text(payload.note)

    try:
        db.commit()
        db.refresh(unavailable_date)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This date is already marked unavailable."
        )

    return serialize_clinic_unavailable_date(unavailable_date, db)


@router.delete("/clinic-unavailable-dates/{closure_id}")
def delete_clinic_unavailable_date(
    closure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_staff_or_admin(current_user)

    unavailable_date = (
        db.query(ClinicUnavailableDate)
        .filter(ClinicUnavailableDate.id == closure_id)
        .first()
    )

    if not unavailable_date:
        raise HTTPException(status_code=404, detail="Unavailable date not found.")

    db.delete(unavailable_date)
    db.commit()

    return {"message": "Unavailable date deleted successfully."}