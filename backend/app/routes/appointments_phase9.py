from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.clock import clinic_now, clinic_today, get_clinic_timezone
from app.core.security import get_current_user
from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.appointment_log import AppointmentLog
from app.models.clinic_unavailable_date import ClinicUnavailableDate
from app.models.diagnosis_report import DiagnosisReport
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_service import DoctorService
from app.models.service import Service
from app.models.user import User
from app.routes import appointments as legacy
from app.schemas.appointment import (
    AppointmentStatusUpdate,
    PaginatedStaffAppointmentHistory,
    StaffAppointmentListItem,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])

DEFAULT_LIST_LIMIT = 100
MAX_LIST_LIMIT = 200
LEGACY_ARRAY_LIMIT = 200


def clinic_local_datetime(value_date: date, value_time: time) -> datetime:
    return datetime.combine(value_date, value_time, tzinfo=get_clinic_timezone())


def calculate_age(date_of_birth):
    if not date_of_birth:
        return None

    today = clinic_today()
    age = today.year - date_of_birth.year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        age -= 1
    return age


def calculate_age_label(date_of_birth):
    if not date_of_birth:
        return None

    today = clinic_today()
    if date_of_birth > today:
        return None

    years = today.year - date_of_birth.year
    months = today.month - date_of_birth.month
    if today.day < date_of_birth.day:
        months -= 1

    total_months = years * 12 + months
    if total_months < 1:
        return "Less than 1 month old"
    if total_months < 12:
        unit = "month" if total_months == 1 else "months"
        return f"{total_months} {unit} old"

    age = calculate_age(date_of_birth)
    unit = "year" if age == 1 else "years"
    return f"{age} {unit} old"


def validate_slot_inside_schedule(
    schedule: DoctorSchedule,
    slot_start: time,
    slot_end: time,
):
    if not schedule.start_time or not schedule.end_time:
        raise HTTPException(status_code=400, detail="Selected schedule has invalid time settings")

    schedule_start = clinic_local_datetime(schedule.schedule_date, schedule.start_time)
    schedule_end = clinic_local_datetime(schedule.schedule_date, schedule.end_time)
    selected_start = clinic_local_datetime(schedule.schedule_date, slot_start)
    selected_end = clinic_local_datetime(schedule.schedule_date, slot_end)

    if selected_start < schedule_start or selected_end > schedule_end:
        raise HTTPException(status_code=400, detail="Selected time is outside the doctor's schedule")
    if selected_end <= selected_start:
        raise HTTPException(status_code=400, detail="Selected end time must be after the start time")
    if selected_end - selected_start != timedelta(minutes=legacy.SLOT_MINUTES):
        raise HTTPException(status_code=400, detail="Appointments must be booked in one-hour slots")
    if selected_start <= clinic_now():
        raise HTTPException(status_code=400, detail="Past time slots cannot be booked")


def validate_manual_initial_evaluation_schedule(
    schedule_date: date,
    slot_start: time,
    slot_end: time,
):
    if slot_end <= slot_start:
        raise HTTPException(status_code=400, detail="End time must be later than the start time")
    if clinic_local_datetime(schedule_date, slot_start) <= clinic_now():
        raise HTTPException(status_code=400, detail="Past schedules cannot be assigned")


# The legacy router resolves these names at request time. Replacing the shared
# helpers keeps POST /appointments and assignment flows timezone-correct without
# duplicating their large transactional implementations.
legacy.calculate_age = calculate_age
legacy.calculate_age_label = calculate_age_label
legacy.validate_slot_inside_schedule = validate_slot_inside_schedule
legacy.validate_manual_initial_evaluation_schedule = validate_manual_initial_evaluation_schedule


def _serialize_with_patient(appointment: AppointmentModel, patient: User | None):
    data = legacy.serialize_appointment(appointment)
    data.update(
        {
            "is_minor": patient.is_minor if patient else False,
            "guardian_first_name": patient.guardian_first_name if patient else None,
            "guardian_last_name": patient.guardian_last_name if patient else None,
            "guardian_relationship": patient.guardian_relationship if patient else None,
            "guardian_contact": patient.guardian_contact if patient else None,
            "guardian_email": patient.guardian_email if patient else None,
            "guardian_consent": patient.guardian_consent if patient else False,
        }
    )
    return data


def _latest_reports_by_appointment(
    db: Session, appointment_ids: list[int]
) -> dict[int, DiagnosisReport]:
    if not appointment_ids:
        return {}

    rows = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.appointment_id.in_(appointment_ids))
        .order_by(DiagnosisReport.appointment_id.asc(), DiagnosisReport.created_at.desc())
        .all()
    )
    latest: dict[int, DiagnosisReport] = {}
    for report in rows:
        latest.setdefault(report.appointment_id, report)
    return latest


def _add_report_fields(item: dict, report: DiagnosisReport | None) -> None:
    item.update(
        {
            "diagnosis_report_id": report.id if report else None,
            "final_diagnosis": report.doctor_final_diagnosis if report else None,
            "doctor_final_diagnosis": report.doctor_final_diagnosis if report else None,
            "prescription": report.doctor_prescription if report else None,
            "doctor_prescription": report.doctor_prescription if report else None,
            "doctor_notes": report.after_appointment_notes if report else None,
            "after_appointment_notes": report.after_appointment_notes if report else None,
            "follow_up_plan": report.follow_up_plan if report else None,
            "next_visit_date": (
                str(report.next_visit_date) if report and report.next_visit_date else None
            ),
        }
    )


@router.get("/my")
def get_my_appointments(
    page: int | None = Query(None, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only")

    query = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_id == current_user.id)
        .order_by(AppointmentModel.id.desc())
    )
    total = query.count()
    if page is None:
        appointments = query.limit(LEGACY_ARRAY_LIMIT).all()
    else:
        appointments = query.offset((page - 1) * page_size).limit(page_size).all()

    reports = _latest_reports_by_appointment(db, [item.id for item in appointments])
    results = []
    for appointment in appointments:
        item = _serialize_with_patient(appointment, current_user)
        _add_report_fields(item, reports.get(appointment.id))
        results.append(item)

    if page is None:
        return results
    return {
        "items": results,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": legacy.get_total_pages(total, page_size),
    }


@router.get("/today", response_model=list[StaffAppointmentListItem])
def get_today_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(legacy.require_staff_or_admin),
):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == clinic_today())
        .filter(AppointmentModel.status == "Approved")
        .order_by(AppointmentModel.time.asc())
        .all()
    )
    return [legacy.serialize_staff_appointment_list_item(item) for item in appointments]


@router.get("/requests", response_model=list[StaffAppointmentListItem])
def get_pending_requests(
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(legacy.require_staff_or_admin),
):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Pending")
        .order_by(AppointmentModel.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [legacy.serialize_staff_appointment_list_item(item) for item in appointments]


@router.get("/confirmed", response_model=list[StaffAppointmentListItem])
def get_confirmed_appointments(
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(legacy.require_staff_or_admin),
):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
        .order_by(AppointmentModel.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [legacy.serialize_staff_appointment_list_item(item) for item in appointments]


@router.get("/history", response_model=PaginatedStaffAppointmentHistory)
def get_staff_appointment_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(legacy.require_staff_or_admin),
):
    query = db.query(AppointmentModel)
    if status and status != "All":
        if status not in legacy.VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(AppointmentModel.status == status)

    total = query.count()
    appointments = (
        query.order_by(AppointmentModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    appointment_ids = [item.id for item in appointments]
    patient_ids = {item.patient_id for item in appointments if item.patient_id}
    patients = {
        patient.id: patient
        for patient in (
            db.query(User).filter(User.id.in_(patient_ids)).all() if patient_ids else []
        )
    }

    latest_logs: dict[int, AppointmentLog] = {}
    if appointment_ids:
        logs = (
            db.query(AppointmentLog)
            .filter(AppointmentLog.appointment_id.in_(appointment_ids))
            .order_by(AppointmentLog.created_at.desc(), AppointmentLog.id.desc())
            .all()
        )
        for log in logs:
            latest_logs.setdefault(log.appointment_id, log)

    items = []
    for appointment in appointments:
        item = _serialize_with_patient(appointment, patients.get(appointment.patient_id))
        latest_log = latest_logs.get(appointment.id)
        item.update(
            {
                "last_action_by_name": latest_log.performed_by_name if latest_log else None,
                "last_action_by_role": latest_log.performed_by_role if latest_log else None,
            }
        )
        items.append(item)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": legacy.get_total_pages(total, page_size),
        "items": items,
    }


@router.get("/history-with-analysis")
def get_patient_history_with_reports(
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only")

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_id == current_user.id)
        .order_by(AppointmentModel.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    reports = _latest_reports_by_appointment(db, [item.id for item in appointments])

    results = []
    for appointment in appointments:
        report = reports.get(appointment.id)
        report_data = None
        if report:
            report_data = {
                "id": report.id,
                "appointment_id": report.appointment_id,
                "doctor_final_diagnosis": report.doctor_final_diagnosis,
                "doctor_prescription": report.doctor_prescription,
                "after_appointment_notes": report.after_appointment_notes,
                "follow_up_plan": report.follow_up_plan,
                "next_visit_date": str(report.next_visit_date) if report.next_visit_date else None,
                "created_at": report.created_at.isoformat() if report.created_at else None,
            }
        results.append(
            {
                "appointment": _serialize_with_patient(appointment, current_user),
                "diagnosis_report": report_data,
            }
        )
    return results


@router.get("/{id}/assignable-slots")
def get_assignable_initial_evaluation_slots(
    id: int,
    doctor_id: Optional[int] = None,
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Staff or admin access only")

    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appointment.is_initial_evaluation_request:
        raise HTTPException(status_code=400, detail="This appointment is not an initial evaluation request")
    if appointment.status != "Pending":
        raise HTTPException(status_code=400, detail="Only pending initial evaluation requests can be assigned")

    service = (
        db.query(Service)
        .filter(Service.id == appointment.service_id, Service.is_active == True)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    doctor_links = db.query(DoctorService).filter(DoctorService.service_id == service.id).all()
    linked_doctor_ids = [link.doctor_id for link in doctor_links]
    if not linked_doctor_ids:
        return []

    allowed_doctors = (
        db.query(User)
        .filter(
            User.id.in_(linked_doctor_ids),
            User.role == "doctor",
            User.status == "Active",
        )
        .order_by(User.name.asc())
        .all()
    )
    allowed_doctors = [
        doctor
        for doctor in allowed_doctors
        if legacy.is_doctor_allowed_for_initial_evaluation_service(service.name, doctor)
    ]
    allowed_doctor_ids = [doctor.id for doctor in allowed_doctors]
    if not allowed_doctor_ids:
        return []
    if doctor_id is not None and doctor_id not in allowed_doctor_ids:
        raise HTTPException(status_code=400, detail="Selected doctor is not allowed for this initial evaluation service")

    now = clinic_now()
    today = now.date()
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
        query = query.filter(DoctorSchedule.doctor_id == doctor_id)
    if week_start is not None:
        week_monday, week_saturday = legacy.get_week_window(week_start)
        query = query.filter(
            DoctorSchedule.schedule_date >= week_monday,
            DoctorSchedule.schedule_date <= week_saturday,
        )

    rows = query.order_by(
        DoctorSchedule.schedule_date.asc(), DoctorSchedule.start_time.asc()
    ).all()
    schedule_dates = {schedule.schedule_date for schedule, _ in rows}
    row_doctor_ids = {doctor.id for _, doctor in rows}

    closed_dates = {
        row[0]
        for row in (
            db.query(ClinicUnavailableDate.closure_date)
            .filter(ClinicUnavailableDate.closure_date.in_(schedule_dates))
            .all()
            if schedule_dates
            else []
        )
    }

    blocking: dict[tuple[int, date], list[tuple[time, time]]] = {}
    if schedule_dates and row_doctor_ids:
        blocked_rows = (
            db.query(
                AppointmentModel.doctor_id,
                AppointmentModel.date,
                AppointmentModel.time,
                AppointmentModel.end_time,
            )
            .filter(
                AppointmentModel.id != appointment.id,
                AppointmentModel.doctor_id.in_(row_doctor_ids),
                AppointmentModel.date.in_(schedule_dates),
                AppointmentModel.time.isnot(None),
                AppointmentModel.end_time.isnot(None),
                or_(
                    AppointmentModel.status == "Approved",
                    and_(
                        AppointmentModel.status == "Pending",
                        AppointmentModel.is_initial_evaluation_request == True,
                    ),
                ),
            )
            .all()
        )
        for blocked_doctor_id, blocked_date, start_time, end_time in blocked_rows:
            blocking.setdefault((blocked_doctor_id, blocked_date), []).append(
                (start_time, end_time)
            )

    results = []
    for schedule, doctor in rows:
        if legacy.is_sunday(schedule.schedule_date):
            continue
        if schedule.schedule_date in closed_dates:
            continue
        if not legacy.service_matches_schedule(schedule.services, service.name):
            continue

        for slot in legacy.generate_hourly_slots(schedule):
            slot_start = slot["start_time"]
            slot_end = slot["end_time"]
            if clinic_local_datetime(schedule.schedule_date, slot_start) <= now:
                continue

            blocked = any(
                existing_start < slot_end and existing_end > slot_start
                for existing_start, existing_end in blocking.get(
                    (doctor.id, schedule.schedule_date), []
                )
            )
            results.append(
                legacy.serialize_assignable_slot(
                    schedule=schedule,
                    service=service,
                    doctor=doctor,
                    slot_start=slot_start,
                    slot_end=slot_end,
                    is_available=not blocked,
                    unavailable_reason="Already booked" if blocked else None,
                )
            )

    return results


@router.put("/{id}/status")
def update_appointment_status(
    id: int,
    body: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role
    if role not in ["patient", "staff", "admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    appointment = legacy.get_authorized_appointment_or_404(db, id, current_user)
    current_status = appointment.status
    new_status = body.status
    legacy.validate_status_transition(role, current_status, new_status)

    if new_status == "Approved" and appointment.is_initial_evaluation_request:
        if not all(
            [appointment.doctor_id, appointment.date, appointment.time, appointment.end_time]
        ):
            raise HTTPException(
                status_code=400,
                detail="Assign a doctor, date, and time before approving this initial evaluation request",
            )
        service = (
            db.query(Service)
            .filter(Service.id == appointment.service_id, Service.is_active == True)
            .first()
        )
        doctor = (
            db.query(User)
            .filter(
                User.id == appointment.doctor_id,
                User.role == "doctor",
                User.status == "Active",
            )
            .first()
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        if not legacy.is_doctor_allowed_for_initial_evaluation_service(service.name, doctor):
            raise HTTPException(status_code=400, detail="Selected doctor is not allowed for this initial evaluation service")

    if (
        new_status == "Approved"
        and appointment.doctor_id
        and appointment.date
        and appointment.time
        and appointment.end_time
    ):
        doctor_conflict = legacy.find_doctor_time_conflict(
            db=db,
            doctor_id=appointment.doctor_id,
            appointment_date=appointment.date,
            slot_start=appointment.time,
            slot_end=appointment.end_time,
            exclude_appointment_id=appointment.id,
        )
        if doctor_conflict:
            raise HTTPException(
                status_code=409,
                detail="This doctor already has an appointment during this time slot",
            )
        if clinic_local_datetime(appointment.date, appointment.time) <= clinic_now():
            raise HTTPException(status_code=400, detail="Past time slots cannot be approved")

    if new_status == "Completed" and appointment.date and appointment.time:
        completion_time = appointment.end_time or appointment.time
        if clinic_local_datetime(appointment.date, completion_time) > clinic_now():
            raise HTTPException(
                status_code=400,
                detail="Appointment can only be completed after the scheduled time has passed",
            )

    if new_status == "No-Show" and appointment.date and appointment.time:
        no_show_time = appointment.end_time or appointment.time
        if clinic_local_datetime(appointment.date, no_show_time) > clinic_now():
            raise HTTPException(
                status_code=400,
                detail="Appointment can only be marked as no-show after the scheduled time has passed",
            )

    approval_instruction = None
    email_warning = None
    if new_status == "Approved":
        approval_instruction = legacy.clean_optional_text(body.patient_instruction)
        if not approval_instruction:
            approval_instruction = legacy.build_default_approval_instruction(appointment)
        appointment.patient_instruction = approval_instruction
        appointment.cancel_reason = None
    elif new_status in ["Declined", "Cancelled", "No-Show"]:
        if not body.cancel_reason or not body.cancel_reason.strip():
            raise HTTPException(status_code=400, detail="Reason is required")
        appointment.cancel_reason = body.cancel_reason.strip()
    else:
        appointment.cancel_reason = None

    appointment.status = new_status
    legacy.create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action=new_status,
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason=approval_instruction if new_status == "Approved" else appointment.cancel_reason,
    )
    legacy.notify_appointment_status_change(db, appointment, current_status)
    legacy.commit_or_raise_booking_conflict(db)
    db.refresh(appointment)

    if new_status == "Approved" and body.send_email:
        try:
            legacy.send_appointment_approval_email(
                email=appointment.patient_email,
                patient_name=appointment.patient_name,
                service=appointment.services,
                doctor_name=appointment.doctor_name or "To be assigned by staff",
                schedule_date=legacy.format_display_date(appointment.date),
                schedule_time=(
                    f"{legacy.format_display_time(appointment.time)} to "
                    f"{legacy.format_display_time(appointment.end_time)}"
                ),
                consultation_mode=appointment.consultation_mode,
                instruction=approval_instruction or legacy.build_default_approval_instruction(appointment),
            )
            appointment.approval_email_sent = True
            appointment.approval_email_sent_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(appointment)
        except Exception:
            legacy.logger.exception(
                "Appointment approval email failed for appointment_id=%s",
                appointment.id,
            )
            email_warning = "The appointment was updated, but notification delivery failed."

    return {
        "message": (
            "Appointment updated successfully"
            if not email_warning
            else "Appointment approved, but the email notification could not be sent."
        ),
        "email_warning": email_warning,
        "appointment": legacy.serialize_appointment(appointment, db),
    }
