from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.clinic_unavailable_date import ClinicUnavailableDate
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_service import DoctorService
from app.models.service import Service
from app.models.user import User
from app.core.security import get_current_user


router = APIRouter(
    prefix="/booking",
    tags=["Patient Booking"]
)


SLOT_MINUTES = 60


def format_time(value):
    if value is None:
        return None

    return value.strftime("%H:%M")


def is_sunday(value: date):
    return value.weekday() == 6


def clean_time_string(value: Optional[str]):
    if not value:
        return None

    return value.strip()[:5]


def get_week_window(value: date):
    monday = value - timedelta(days=value.weekday())
    saturday = monday + timedelta(days=5)

    return monday, saturday


def service_matches_schedule(schedule_services: str, service_name: str):
    if not schedule_services or not service_name:
        return False

    schedule_service_list = [
        item.strip().lower()
        for item in schedule_services.split(",")
        if item.strip()
    ]

    return service_name.strip().lower() in schedule_service_list


def generate_hourly_slots(schedule: DoctorSchedule):
    if not schedule.start_time or not schedule.end_time:
        return []

    slot_start = datetime.combine(schedule.schedule_date, schedule.start_time)
    schedule_end = datetime.combine(schedule.schedule_date, schedule.end_time)

    slots = []

    while slot_start + timedelta(minutes=SLOT_MINUTES) <= schedule_end:
        slot_end = slot_start + timedelta(minutes=SLOT_MINUTES)

        slots.append({
            "start_time": slot_start.time(),
            "end_time": slot_end.time(),
        })

        slot_start = slot_end

    return slots


def has_approved_slot(
    db: Session,
    schedule_id: int,
    slot_start: time,
    slot_end: time,
):
    return (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.schedule_id == schedule_id,
            AppointmentModel.time == slot_start,
            AppointmentModel.end_time == slot_end,
            AppointmentModel.status == "Approved",
        )
        .first()
        is not None
    )


def serialize_service(service: Service):
    return {
        "id": service.id,
        "name": service.name,
        "description": service.description,
        "requires_initial_evaluation": service.requires_initial_evaluation,
        "is_active": service.is_active,
    }


def serialize_doctor(doctor: User):
    return {
        "id": doctor.id,
        "name": doctor.name,
        "first_name": doctor.first_name,
        "last_name": doctor.last_name,
        "email": doctor.email,
        "specialty": doctor.specialty,
        "availability": doctor.availability,
        "profile_image": doctor.profile_image,
        "bio": doctor.bio,
    }


def serialize_slot(
    schedule: DoctorSchedule,
    service: Service,
    doctor: User,
    slot_start: time,
    slot_end: time,
    is_available: bool,
    unavailable_reason: Optional[str],
):
    slot_id = f"{schedule.id}-{schedule.schedule_date.isoformat()}-{format_time(slot_start)}"

    return {
        "id": slot_id,
        "slot_id": slot_id,
        "schedule_id": schedule.id,
        "doctor_id": schedule.doctor_id,
        "doctor_name": doctor.name,
        "doctor_specialty": doctor.specialty,
        "service_id": service.id,
        "service_name": service.name,
        "schedule_date": schedule.schedule_date.isoformat(),
        "start_time": format_time(slot_start),
        "end_time": format_time(slot_end),
        "consultation_mode": schedule.consultation_mode or "In-Person",
        "appointment_type": "Regular",
        "is_available": is_available,
        "unavailable_reason": unavailable_reason,
    }


@router.get("/services")
def get_booking_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only.")

    services = (
        db.query(Service)
        .filter(Service.is_active == True)
        .order_by(Service.id.asc())
        .all()
    )

    return [serialize_service(service) for service in services]


@router.get("/services/{service_id}/doctors")
def get_doctors_by_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only.")

    service = (
        db.query(Service)
        .filter(Service.id == service_id, Service.is_active == True)
        .first()
    )

    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    if service.requires_initial_evaluation:
        return []

    doctor_links = (
        db.query(DoctorService)
        .filter(DoctorService.service_id == service.id)
        .all()
    )

    doctor_ids = [link.doctor_id for link in doctor_links]

    if not doctor_ids:
        return []

    doctors = (
        db.query(User)
        .filter(
            User.id.in_(doctor_ids),
            User.role == "doctor",
            User.status == "Active",
        )
        .order_by(User.name.asc())
        .all()
    )

    return [serialize_doctor(doctor) for doctor in doctors]


@router.get("/services/{service_id}/schedules")
def get_schedules_by_service(
    service_id: int,
    doctor_id: Optional[int] = None,
    preferred_date: Optional[date] = None,
    week_start: Optional[date] = None,
    preferred_time: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only.")

    service = (
        db.query(Service)
        .filter(Service.id == service_id, Service.is_active == True)
        .first()
    )

    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    if service.requires_initial_evaluation:
        return []

    doctor_links = (
        db.query(DoctorService)
        .filter(DoctorService.service_id == service.id)
        .all()
    )

    allowed_doctor_ids = [link.doctor_id for link in doctor_links]

    if not allowed_doctor_ids:
        return []

    today = date.today()
    now = datetime.now()

    query = (
        db.query(DoctorSchedule, User)
        .join(User, User.id == DoctorSchedule.doctor_id)
        .filter(
            DoctorSchedule.doctor_id.in_(allowed_doctor_ids),
            DoctorSchedule.is_available == True,
            DoctorSchedule.schedule_date >= today,
            User.role == "doctor",
            User.status == "Active",
        )
    )

    if doctor_id is not None:
        if doctor_id not in allowed_doctor_ids:
            raise HTTPException(
                status_code=400,
                detail="Selected doctor does not perform this service."
            )

        query = query.filter(DoctorSchedule.doctor_id == doctor_id)

    if preferred_date is not None:
        query = query.filter(DoctorSchedule.schedule_date == preferred_date)

    if week_start is not None:
        week_monday, week_saturday = get_week_window(week_start)
        query = query.filter(
            DoctorSchedule.schedule_date >= week_monday,
            DoctorSchedule.schedule_date <= week_saturday,
        )

    query = query.order_by(
        DoctorSchedule.schedule_date.asc(),
        DoctorSchedule.start_time.asc()
    )

    requested_time = clean_time_string(preferred_time)
    rows = query.all()
    results = []

    for schedule, doctor in rows:
        if is_sunday(schedule.schedule_date):
            continue

        clinic_closed = (
            db.query(ClinicUnavailableDate)
            .filter(ClinicUnavailableDate.closure_date == schedule.schedule_date)
            .first()
        )

        if clinic_closed:
            continue

        if not service_matches_schedule(schedule.services, service.name):
            continue

        for slot in generate_hourly_slots(schedule):
            slot_start = slot["start_time"]
            slot_end = slot["end_time"]

            if requested_time and format_time(slot_start) != requested_time:
                continue

            slot_start_datetime = datetime.combine(schedule.schedule_date, slot_start)

            if slot_start_datetime <= now:
                continue

            approved = has_approved_slot(
                db=db,
                schedule_id=schedule.id,
                slot_start=slot_start,
                slot_end=slot_end,
            )

            results.append(
                serialize_slot(
                    schedule=schedule,
                    service=service,
                    doctor=doctor,
                    slot_start=slot_start,
                    slot_end=slot_end,
                    is_available=not approved,
                    unavailable_reason="Already booked" if approved else None,
                )
            )

    return results
