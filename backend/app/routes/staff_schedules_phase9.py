from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.clock import clinic_now, get_clinic_timezone
from app.core.security import get_current_user
from app.db import get_db
from app.models.doctor_schedule import DoctorSchedule
from app.models.user import User
from app.routes import staff_schedules as legacy

router = APIRouter(prefix="/staff", tags=["Staff Schedules"])

DEFAULT_LIST_LIMIT = 100
MAX_LIST_LIMIT = 200


def is_past_schedule(schedule_date: date, start_time: time) -> bool:
    selected_start = datetime.combine(
        schedule_date,
        start_time,
        tzinfo=get_clinic_timezone(),
    )
    return selected_start <= clinic_now()


# Create/update schedule validation in the legacy router resolves this helper at
# request time, so patching it here gives those transactional endpoints the same
# clinic clock used by patient/doctor booking paths.
legacy.is_past_schedule = is_past_schedule


def serialize_schedule_with_users(
    schedule: DoctorSchedule,
    users: dict[int, User],
) -> dict:
    doctor = users.get(schedule.doctor_id)
    staff = users.get(schedule.created_by_staff_id) if schedule.created_by_staff_id else None

    return {
        "id": schedule.id,
        "doctor_id": schedule.doctor_id,
        "doctor_name": doctor.name if doctor else "Unknown Doctor",
        "services": schedule.services,
        "schedule_date": schedule.schedule_date.isoformat(),
        "start_time": legacy.format_time(schedule.start_time),
        "end_time": legacy.format_time(schedule.end_time),
        "is_available": schedule.is_available,
        "consultation_mode": schedule.consultation_mode or "In-Person",
        "unavailable_reason": schedule.unavailable_reason,
        "schedule_note": schedule.schedule_note,
        "created_by_staff_id": schedule.created_by_staff_id,
        "created_by_staff_name": staff.name if staff else None,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


@router.get("/doctor-schedules")
def get_doctor_schedules(
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    legacy.require_staff_or_admin(current_user)

    schedules = (
        db.query(DoctorSchedule)
        .order_by(
            DoctorSchedule.schedule_date.asc(),
            DoctorSchedule.start_time.asc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    user_ids = {
        user_id
        for schedule in schedules
        for user_id in (schedule.doctor_id, schedule.created_by_staff_id)
        if user_id
    }
    users = {
        user.id: user
        for user in (
            db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        )
    }

    return [serialize_schedule_with_users(schedule, users) for schedule in schedules]
