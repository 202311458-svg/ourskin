from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.authorization import get_doctor_appointment_or_404
from app.core.security import get_current_user
from app.db import get_db
from app.models.user import User
from app.routes import doctor as doctor_routes
from app.schemas.appointment import AppointmentStatusUpdate
from app.schemas.diagnosis_report import DiagnosisReportCreate


router = APIRouter(prefix="/doctor", tags=["Doctor Portal"])


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return current_user


def ensure_appointment_has_started(appointment) -> None:
    if appointment.date is None or appointment.time is None:
        raise HTTPException(
            status_code=400,
            detail="Appointment must have a confirmed schedule before it can be completed.",
        )

    scheduled_start = datetime.combine(appointment.date, appointment.time)
    if scheduled_start > datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Appointment cannot be completed before its scheduled start time.",
        )


@router.put("/appointments/{appointment_id}/status")
def block_legacy_doctor_status_mutation(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    # Resolve the record first so callers cannot use this endpoint to probe
    # appointments belonging to another doctor.
    get_doctor_appointment_or_404(db, appointment_id, current_user.id)

    raise HTTPException(
        status_code=400,
        detail=(
            "This legacy doctor status endpoint is disabled. "
            "Use the main appointment workflow for cancellation and the "
            "complete-with-report workflow for completion."
        ),
    )


@router.post("/appointments/{appointment_id}/complete-with-report")
def complete_appointment_with_report_guarded(
    appointment_id: int,
    payload: DiagnosisReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, current_user.id)
    ensure_appointment_has_started(appointment)

    return doctor_routes.complete_appointment_with_report(
        appointment_id=appointment_id,
        payload=payload,
        db=db,
        current_user=current_user,
    )
