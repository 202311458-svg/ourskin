"""Reusable role and object-level authorization helpers."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Query, Session

from app.core.security import get_current_user
from app.models.appointment import AppointmentModel
from app.models.user import User


def require_roles(*allowed_roles: str) -> Callable:
    allowed = frozenset(allowed_roles)

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


require_staff_or_admin = require_roles("staff", "admin")


def doctor_appointments_query(db: Session, doctor_id: int) -> Query:
    """Return a query that can only resolve appointments owned by one doctor."""
    return db.query(AppointmentModel).filter(AppointmentModel.doctor_id == doctor_id)


def get_doctor_appointment_or_404(
    db: Session,
    appointment_id: int,
    doctor_id: int,
) -> AppointmentModel:
    appointment = (
        doctor_appointments_query(db, doctor_id)
        .filter(AppointmentModel.id == appointment_id)
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


def appointment_query_for_user(db: Session, current_user: User) -> Query:
    query = db.query(AppointmentModel)
    if current_user.role == "doctor":
        return query.filter(AppointmentModel.doctor_id == current_user.id)
    if current_user.role == "patient":
        return query.filter(AppointmentModel.patient_id == current_user.id)
    if current_user.role in {"staff", "admin"}:
        return query
    return query.filter(AppointmentModel.id.is_(None))


def get_authorized_appointment_or_404(
    db: Session,
    appointment_id: int,
    current_user: User,
) -> AppointmentModel:
    appointment = (
        appointment_query_for_user(db, current_user)
        .filter(AppointmentModel.id == appointment_id)
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment