from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, aliased

from app.core.clock import clinic_now
from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.clinic_unavailable_date import ClinicUnavailableDate
from app.models.doctor_schedule import DoctorSchedule
from app.models.user import User
from app.routes.admin import require_admin, validate_pagination
from app.routes.staff_schedules_phase9 import serialize_schedule_with_users
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin Schedules"])

VALID_SCOPES = {"all", "upcoming", "unavailable", "past"}


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _schedule_time_conditions():
    now = clinic_now()
    today = now.date()
    current_time = now.time().replace(tzinfo=None)
    past = or_(
        DoctorSchedule.schedule_date < today,
        and_(
            DoctorSchedule.schedule_date == today,
            DoctorSchedule.start_time <= current_time,
        ),
    )
    upcoming = or_(
        DoctorSchedule.schedule_date > today,
        and_(
            DoctorSchedule.schedule_date == today,
            DoctorSchedule.start_time > current_time,
        ),
    )
    return past, upcoming


def _schedule_summary(db: Session) -> dict[str, int]:
    past, upcoming = _schedule_time_conditions()
    return {
        "total": db.query(DoctorSchedule).count(),
        "upcoming_available": (
            db.query(DoctorSchedule)
            .filter(DoctorSchedule.is_available.is_(True), upcoming)
            .count()
        ),
        "unavailable": (
            db.query(DoctorSchedule)
            .filter(DoctorSchedule.is_available.is_(False))
            .count()
        ),
        "past": db.query(DoctorSchedule).filter(past).count(),
        "closures": db.query(ClinicUnavailableDate).count(),
    }


@router.get("/schedules/query")
def query_admin_schedules(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    doctor_id: Optional[int] = Query(default=None, ge=1),
    schedule_date: Optional[date] = Query(default=None),
    scope: str = Query("upcoming", max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)

    scope_value = _clean(scope).lower() or "upcoming"
    if scope_value not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail="Invalid schedule scope.")

    doctor = aliased(User)
    query = db.query(DoctorSchedule).outerjoin(
        doctor,
        doctor.id == DoctorSchedule.doctor_id,
    )

    keyword = _clean(search)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(
            or_(
                doctor.name.ilike(pattern),
                DoctorSchedule.services.ilike(pattern),
                DoctorSchedule.consultation_mode.ilike(pattern),
                DoctorSchedule.schedule_note.ilike(pattern),
                DoctorSchedule.unavailable_reason.ilike(pattern),
            )
        )

    if doctor_id is not None:
        query = query.filter(DoctorSchedule.doctor_id == doctor_id)

    if schedule_date is not None:
        query = query.filter(DoctorSchedule.schedule_date == schedule_date)

    past, upcoming = _schedule_time_conditions()
    if scope_value == "upcoming":
        query = query.filter(DoctorSchedule.is_available.is_(True), upcoming)
    elif scope_value == "unavailable":
        query = query.filter(DoctorSchedule.is_available.is_(False))
    elif scope_value == "past":
        query = query.filter(past)

    total = query.count()

    if scope_value == "upcoming":
        query = query.order_by(
            DoctorSchedule.schedule_date.asc(),
            DoctorSchedule.start_time.asc(),
            DoctorSchedule.id.asc(),
        )
    else:
        query = query.order_by(
            DoctorSchedule.schedule_date.desc(),
            DoctorSchedule.start_time.desc(),
            DoctorSchedule.id.desc(),
        )

    schedules = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    schedule_ids = [item.id for item in schedules]
    appointment_counts = {
        schedule_id: count
        for schedule_id, count in (
            db.query(
                AppointmentModel.schedule_id,
                func.count(AppointmentModel.id),
            )
            .filter(AppointmentModel.schedule_id.in_(schedule_ids))
            .group_by(AppointmentModel.schedule_id)
            .all()
            if schedule_ids
            else []
        )
    }

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

    items = []
    for schedule in schedules:
        item = serialize_schedule_with_users(schedule, users)
        item["linked_appointments"] = int(appointment_counts.get(schedule.id, 0))
        items.append(item)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _schedule_summary(db),
        "items": items,
    }
