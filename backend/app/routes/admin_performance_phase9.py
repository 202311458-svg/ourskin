from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, case, cast, func, or_
from sqlalchemy.orm import Session, aliased

from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.appointment import AppointmentModel
from app.models.user import User
from app.routes.admin import (
    format_date,
    format_time,
    require_admin,
    validate_pagination,
)
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin Performance Phase 9"])

STATUS_CANONICAL = {
    "pending": "Pending",
    "approved": "Approved",
    "declined": "Declined",
    "cancelled": "Cancelled",
    "canceled": "Cancelled",
    "completed": "Completed",
    "no-show": "No-Show",
    "no_show": "No-Show",
}


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _contains(column, term: str):
    return column.ilike(f"%{term}%")


def _conditional_count(condition):
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def _dashboard_user_counts(db: Session) -> dict[str, int]:
    row = db.query(
        func.count(User.id).label("total"),
        _conditional_count(User.role == "patient").label("patients"),
        _conditional_count(User.role == "staff").label("staff"),
        _conditional_count(User.role == "doctor").label("doctors"),
    ).one()
    return {
        "total_users": int(row.total or 0),
        "total_patients": int(row.patients or 0),
        "total_staff": int(row.staff or 0),
        "total_doctors": int(row.doctors or 0),
    }


def _dashboard_appointment_counts(db: Session) -> dict[str, int]:
    row = db.query(
        func.count(AppointmentModel.id).label("total"),
        _conditional_count(AppointmentModel.status == "Pending").label("pending"),
        _conditional_count(AppointmentModel.status == "Approved").label("approved"),
    ).one()
    return {
        "total_appointments": int(row.total or 0),
        "pending_appointments": int(row.pending or 0),
        "approved_appointments": int(row.approved or 0),
    }


@router.get("/dashboard")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return {
        **_dashboard_user_counts(db),
        **_dashboard_appointment_counts(db),
        "total_ai_logs": db.query(func.count(AIAnalysisRun.id)).scalar() or 0,
    }


def _appointment_summary(db: Session) -> dict[str, int]:
    row = db.query(
        func.count(AppointmentModel.id).label("total"),
        _conditional_count(AppointmentModel.status == "Pending").label("pending"),
        _conditional_count(
            (AppointmentModel.status == "Pending")
            & AppointmentModel.is_initial_evaluation_request.is_(True)
        ).label("initial_evaluation"),
        _conditional_count(AppointmentModel.status == "Approved").label("approved"),
    ).one()
    return {
        "total": int(row.total or 0),
        "pending": int(row.pending or 0),
        "initial_evaluation": int(row.initial_evaluation or 0),
        "approved": int(row.approved or 0),
    }


def _serialize_appointment(
    appointment: AppointmentModel,
    patient: User | None,
) -> dict:
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "doctor_id": appointment.doctor_id,
        "schedule_id": appointment.schedule_id,
        "service_id": appointment.service_id,
        "patient_name": appointment.patient_name,
        "patient_email": appointment.patient_email,
        "patient_contact": appointment.patient_contact,
        "patient_address": appointment.patient_address,
        "patient_age": appointment.patient_age,
        "patient_age_label": appointment.patient_age_label,
        "is_minor": patient.is_minor if patient else False,
        "guardian_first_name": patient.guardian_first_name if patient else None,
        "guardian_last_name": patient.guardian_last_name if patient else None,
        "guardian_relationship": patient.guardian_relationship if patient else None,
        "guardian_contact": patient.guardian_contact if patient else None,
        "guardian_email": patient.guardian_email if patient else None,
        "guardian_consent": patient.guardian_consent if patient else False,
        "doctor_name": appointment.doctor_name or "To be assigned by staff",
        "date": format_date(appointment.date),
        "time": format_time(appointment.time),
        "end_time": format_time(appointment.end_time),
        "services": appointment.services,
        "appointment_type": appointment.appointment_type,
        "consultation_mode": appointment.consultation_mode,
        "concern": appointment.concern,
        "is_initial_evaluation_request": appointment.is_initial_evaluation_request,
        "status": appointment.status,
        "cancel_reason": appointment.cancel_reason,
        "patient_instruction": appointment.patient_instruction,
        "approval_email_sent": appointment.approval_email_sent,
        "approval_email_sent_at": (
            appointment.approval_email_sent_at.isoformat()
            if appointment.approval_email_sent_at
            else None
        ),
    }


@router.get("/appointments/query")
def query_admin_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    status: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)

    patient = aliased(User)
    filters = []

    keyword = _clean(search)
    if keyword:
        filters.append(
            or_(
                _contains(AppointmentModel.patient_name, keyword),
                _contains(AppointmentModel.patient_email, keyword),
                _contains(AppointmentModel.patient_contact, keyword),
                _contains(AppointmentModel.doctor_name, keyword),
                _contains(AppointmentModel.services, keyword),
                _contains(AppointmentModel.status, keyword),
                _contains(AppointmentModel.concern, keyword),
                _contains(patient.guardian_first_name, keyword),
                _contains(patient.guardian_last_name, keyword),
                _contains(patient.guardian_email, keyword),
                _contains(patient.guardian_contact, keyword),
                cast(AppointmentModel.id, String).ilike(f"%{keyword}%"),
            )
        )

    status_value = _clean(status).lower()
    if status_value and status_value != "all":
        canonical = STATUS_CANONICAL.get(status_value)
        if canonical:
            filters.append(AppointmentModel.status == canonical)
        else:
            filters.append(func.lower(AppointmentModel.status) == status_value)

    count_query = (
        db.query(AppointmentModel.id)
        .outerjoin(patient, patient.id == AppointmentModel.patient_id)
    )
    if filters:
        count_query = count_query.filter(*filters)
    total = count_query.count()

    row_query = (
        db.query(AppointmentModel, patient)
        .outerjoin(patient, patient.id == AppointmentModel.patient_id)
    )
    if filters:
        row_query = row_query.filter(*filters)

    rows = (
        row_query.order_by(AppointmentModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _appointment_summary(db),
        "items": [
            _serialize_appointment(appointment, patient_user)
            for appointment, patient_user in rows
        ],
    }
