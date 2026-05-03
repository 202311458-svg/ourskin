from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.appointment import AppointmentModel
from app.models.appointment_log import AppointmentLog
from app.models.clinic_unavailable_date import ClinicUnavailableDate
from app.models.diagnosis_report import DiagnosisReport
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_service import DoctorService
from app.models.service import Service
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentScheduleAssign, AppointmentStatusUpdate
from app.core.security import get_current_user


router = APIRouter(prefix="/appointments", tags=["Appointments"])


VALID_STATUSES = {"Pending", "Approved", "Declined", "Cancelled", "Completed"}
ACTIVE_BOOKING_STATUSES = ["Pending", "Approved"]
SLOT_MINUTES = 60

ROLE_STATUS_TRANSITIONS = {
    "patient": {
        "Pending": {"Cancelled"},
    },
    "staff": {
        "Pending": {"Approved", "Declined", "Cancelled"},
        "Approved": {"Completed", "Cancelled"},
    },
    "admin": {
        "Pending": {"Approved", "Declined", "Cancelled"},
        "Approved": {"Completed", "Cancelled"},
    },
    "doctor": {
        "Approved": {"Completed", "Cancelled"},
    },
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def clean_optional_text(value: Optional[str]):
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned if cleaned else None


def format_time(value):
    if value is None:
        return None

    return value.strftime("%H:%M")


def format_date(value):
    if value is None:
        return None

    return value.isoformat()


def is_sunday(value: date):
    return value.weekday() == 6


def calculate_age(date_of_birth):
    if not date_of_birth:
        return None

    today = date.today()
    age = today.year - date_of_birth.year

    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        age -= 1

    return age


def calculate_age_label(date_of_birth):
    if not date_of_birth:
        return None

    today = date.today()

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


def service_matches_schedule(schedule_services: str, service_name: str):
    if not schedule_services or not service_name:
        return False

    schedule_service_list = [
        item.strip().lower()
        for item in schedule_services.split(",")
        if item.strip()
    ]

    return service_name.strip().lower() in schedule_service_list


def validate_slot_inside_schedule(
    schedule: DoctorSchedule,
    slot_start: time,
    slot_end: time,
):
    if not schedule.start_time or not schedule.end_time:
        raise HTTPException(status_code=400, detail="Selected schedule has invalid time settings")

    schedule_start = datetime.combine(schedule.schedule_date, schedule.start_time)
    schedule_end = datetime.combine(schedule.schedule_date, schedule.end_time)
    selected_start = datetime.combine(schedule.schedule_date, slot_start)
    selected_end = datetime.combine(schedule.schedule_date, slot_end)

    if selected_start < schedule_start or selected_end > schedule_end:
        raise HTTPException(status_code=400, detail="Selected time is outside the doctor's schedule")

    if selected_end <= selected_start:
        raise HTTPException(status_code=400, detail="Selected end time must be after the start time")

    if selected_end - selected_start != timedelta(minutes=SLOT_MINUTES):
        raise HTTPException(status_code=400, detail="Appointments must be booked in one-hour slots")

    if selected_start <= datetime.now():
        raise HTTPException(status_code=400, detail="Past time slots cannot be booked")


def create_appointment_log(
    db: Session,
    appointment_id: int,
    action: str,
    performed_by_id: int | None,
    performed_by_name: str,
    performed_by_role: str,
    reason: str | None = None,
):
    log = AppointmentLog(
        appointment_id=appointment_id,
        action=action,
        performed_by_id=performed_by_id,
        performed_by_name=performed_by_name,
        performed_by_role=performed_by_role,
        reason=reason,
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log


def validate_status_transition(role: str, current_status: str, new_status: str):
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    if current_status == new_status:
        raise HTTPException(status_code=400, detail="Appointment is already in that status")

    allowed_map = ROLE_STATUS_TRANSITIONS.get(role)

    if not allowed_map:
        raise HTTPException(status_code=403, detail="Not allowed")

    allowed_next_statuses = allowed_map.get(current_status, set())

    if new_status not in allowed_next_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"{role.capitalize()} cannot change appointment from {current_status} to {new_status}",
        )


def serialize_appointment(appointment: AppointmentModel):
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
    }


def find_active_same_service_request(db: Session, patient_id: int, service_id: int):
    return (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.patient_id == patient_id,
            AppointmentModel.service_id == service_id,
            AppointmentModel.status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .first()
    )


def find_approved_slot_conflict(
    db: Session,
    schedule_id: int,
    slot_start: time,
    slot_end: time,
    exclude_appointment_id: Optional[int] = None,
):
    query = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.schedule_id == schedule_id,
            AppointmentModel.time == slot_start,
            AppointmentModel.end_time == slot_end,
            AppointmentModel.status == "Approved",
        )
    )

    if exclude_appointment_id is not None:
        query = query.filter(AppointmentModel.id != exclude_appointment_id)

    return query.first()


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


def serialize_assignable_slot(
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
        "appointment_type": "Initial Evaluation",
        "is_available": is_available,
        "unavailable_reason": unavailable_reason,
    }


def get_week_window(value: date):
    monday = value - timedelta(days=value.weekday())
    saturday = monday + timedelta(days=5)

    return monday, saturday


@router.post("/")
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = current_user

    if current_user.role in ["staff", "admin"] and data.patient_id:
        patient = (
            db.query(User)
            .filter(User.id == data.patient_id, User.role == "patient")
            .first()
        )

        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

    if patient.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can own appointments")

    service = (
        db.query(Service)
        .filter(Service.id == data.service_id, Service.is_active == True)
        .first()
    )

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    active_same_service = find_active_same_service_request(
        db=db,
        patient_id=patient.id,
        service_id=service.id,
    )

    if active_same_service:
        raise HTTPException(
            status_code=409,
            detail="You already have an active request for this service. Please wait until the previous appointment is completed, cancelled, or declined before booking the same service again.",
        )

    patient_contact = clean_optional_text(data.patient_contact) or patient.contact
    patient_address = clean_optional_text(data.patient_address) or patient.address
    patient_age = data.patient_age if data.patient_age is not None else calculate_age(patient.date_of_birth)
    patient_age_label = clean_optional_text(data.patient_age_label) or calculate_age_label(patient.date_of_birth)

    if not patient_contact:
        raise HTTPException(status_code=400, detail="Patient contact number is required")

    if not patient_address:
        raise HTTPException(status_code=400, detail="Patient address is required")

    if service.requires_initial_evaluation:
        appointment = AppointmentModel(
            patient_id=patient.id,
            doctor_id=None,
            schedule_id=None,
            service_id=service.id,

            patient_name=patient.name,
            patient_email=patient.email,
            patient_contact=patient_contact,
            patient_address=patient_address,
            patient_age=patient_age,
            patient_age_label=patient_age_label,

            doctor_name=None,

            date=None,
            time=None,
            end_time=None,
            services=service.name,

            appointment_type="Initial Evaluation Request",
            consultation_mode="To be scheduled by staff",
            concern=clean_optional_text(data.concern),
            is_initial_evaluation_request=True,

            status="Pending",
        )

        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        create_appointment_log(
            db=db,
            appointment_id=appointment.id,
            action="Created",
            performed_by_id=current_user.id,
            performed_by_name=current_user.name,
            performed_by_role=current_user.role,
            reason="Initial evaluation request submitted",
        )

        return {
            "message": "Initial evaluation request created",
            "appointment": serialize_appointment(appointment),
        }

    if data.schedule_id is None:
        raise HTTPException(status_code=400, detail="Schedule is required for this service")

    if data.start_time is None or data.end_time is None:
        raise HTTPException(status_code=400, detail="Start time and end time are required")

    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == data.schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    doctor = (
        db.query(User)
        .filter(
            User.id == schedule.doctor_id,
            User.role == "doctor",
            User.status == "Active",
        )
        .first()
    )

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if not schedule.is_available:
        raise HTTPException(status_code=400, detail="Selected schedule is unavailable")

    if is_sunday(schedule.schedule_date):
        raise HTTPException(status_code=400, detail="Sundays are unavailable for scheduling")

    clinic_closed = (
        db.query(ClinicUnavailableDate)
        .filter(ClinicUnavailableDate.closure_date == schedule.schedule_date)
        .first()
    )

    if clinic_closed:
        raise HTTPException(status_code=400, detail="Clinic is unavailable on this date")

    doctor_service = (
        db.query(DoctorService)
        .filter(
            DoctorService.doctor_id == doctor.id,
            DoctorService.service_id == service.id,
        )
        .first()
    )

    if not doctor_service:
        raise HTTPException(
            status_code=400,
            detail="Selected doctor does not perform this service"
        )

    if not service_matches_schedule(schedule.services, service.name):
        raise HTTPException(
            status_code=400,
            detail="Selected schedule is not assigned to this service"
        )

    validate_slot_inside_schedule(
        schedule=schedule,
        slot_start=data.start_time,
        slot_end=data.end_time,
    )

    approved_conflict = find_approved_slot_conflict(
        db=db,
        schedule_id=schedule.id,
        slot_start=data.start_time,
        slot_end=data.end_time,
    )

    if approved_conflict:
        raise HTTPException(
            status_code=409,
            detail="This time slot already has an approved appointment",
        )

    patient_same_slot_request = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.patient_id == patient.id,
            AppointmentModel.schedule_id == schedule.id,
            AppointmentModel.time == data.start_time,
            AppointmentModel.end_time == data.end_time,
            AppointmentModel.status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .first()
    )

    if patient_same_slot_request:
        raise HTTPException(
            status_code=409,
            detail="You already have an active appointment request for this selected time slot",
        )

    appointment = AppointmentModel(
        patient_id=patient.id,
        doctor_id=doctor.id,
        schedule_id=schedule.id,
        service_id=service.id,

        patient_name=patient.name,
        patient_email=patient.email,
        patient_contact=patient_contact,
        patient_address=patient_address,
        patient_age=patient_age,
        patient_age_label=patient_age_label,

        doctor_name=doctor.name,

        date=schedule.schedule_date,
        time=data.start_time,
        end_time=data.end_time,
        services=service.name,

        appointment_type="Regular",
        consultation_mode=schedule.consultation_mode or "In-Person",
        concern=clean_optional_text(data.concern),
        is_initial_evaluation_request=False,

        status="Pending",
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action="Created",
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason=None,
    )

    return {
        "message": "Appointment created",
        "appointment": serialize_appointment(appointment),
    }


@router.get("/my")
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access only")

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_id == current_user.id)
        .order_by(AppointmentModel.id.desc())
        .all()
    )

    results = []

    for appointment in appointments:
        diagnosis_report = (
            db.query(DiagnosisReport)
            .filter(DiagnosisReport.appointment_id == appointment.id)
            .order_by(DiagnosisReport.created_at.desc())
            .first()
        )

        item = serialize_appointment(appointment)

        item.update({
            "diagnosis_report_id": diagnosis_report.id if diagnosis_report else None,

            "final_diagnosis": (
                diagnosis_report.doctor_final_diagnosis
                if diagnosis_report else None
            ),
            "doctor_final_diagnosis": (
                diagnosis_report.doctor_final_diagnosis
                if diagnosis_report else None
            ),

            "prescription": (
                diagnosis_report.doctor_prescription
                if diagnosis_report else None
            ),
            "doctor_prescription": (
                diagnosis_report.doctor_prescription
                if diagnosis_report else None
            ),

            "doctor_notes": (
                diagnosis_report.after_appointment_notes
                if diagnosis_report else None
            ),
            "after_appointment_notes": (
                diagnosis_report.after_appointment_notes
                if diagnosis_report else None
            ),

            "follow_up_plan": (
                diagnosis_report.follow_up_plan
                if diagnosis_report else None
            ),

            "next_visit_date": (
                str(diagnosis_report.next_visit_date)
                if diagnosis_report and diagnosis_report.next_visit_date
                else None
            ),
        })

        results.append(item)

    return results


@router.put("/{id}/status")
def update_appointment_status(
    id: int,
    body: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    role = current_user.role
    current_status = appointment.status
    new_status = body.status

    if role not in ["patient", "staff", "admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    if role == "patient" and appointment.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own appointment")

    validate_status_transition(role, current_status, new_status)

    if new_status == "Approved" and appointment.is_initial_evaluation_request:
        if not appointment.schedule_id or not appointment.doctor_id or not appointment.date or not appointment.time or not appointment.end_time:
            raise HTTPException(
                status_code=400,
                detail="Assign a doctor and schedule before approving this initial evaluation request",
            )

    if new_status == "Approved" and appointment.schedule_id and appointment.time and appointment.end_time:
        approved_conflict = find_approved_slot_conflict(
            db=db,
            schedule_id=appointment.schedule_id,
            slot_start=appointment.time,
            slot_end=appointment.end_time,
            exclude_appointment_id=appointment.id,
        )

        if approved_conflict:
            raise HTTPException(
                status_code=409,
                detail="This time slot already has an approved appointment",
            )

        if datetime.combine(appointment.date, appointment.time) <= datetime.now():
            raise HTTPException(status_code=400, detail="Past time slots cannot be approved")

    if new_status == "Completed" and appointment.date and appointment.time:
        completion_time = appointment.end_time or appointment.time

        if datetime.combine(appointment.date, completion_time) > datetime.now():
            raise HTTPException(
                status_code=400,
                detail="Appointment can only be completed after the scheduled time has passed",
            )

    if new_status in ["Declined", "Cancelled"]:
        if not body.cancel_reason or not body.cancel_reason.strip():
            raise HTTPException(status_code=400, detail="Reason is required")

        appointment.cancel_reason = body.cancel_reason.strip()
    else:
        appointment.cancel_reason = None

    appointment.status = new_status

    db.commit()
    db.refresh(appointment)

    create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action=new_status,
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason=appointment.cancel_reason,
    )

    return {
        "message": "Appointment updated successfully",
        "appointment": serialize_appointment(appointment),
    }


@router.get("/today")
def get_today_appointments(db: Session = Depends(get_db)):
    today = date.today()

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Approved")
        .all()
    )

    return [serialize_appointment(appointment) for appointment in appointments]


@router.get("/requests")
def get_pending_requests(db: Session = Depends(get_db)):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Pending")
        .order_by(AppointmentModel.id.desc())
        .all()
    )

    return [serialize_appointment(appointment) for appointment in appointments]


@router.get("/confirmed")
def get_confirmed_appointments(db: Session = Depends(get_db)):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
        .order_by(AppointmentModel.id.desc())
        .all()
    )

    return [serialize_appointment(appointment) for appointment in appointments]


@router.get("/history-with-analysis")
def get_patient_history(email: str, db: Session = Depends(get_db)):
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.patient_email == email)
        .order_by(AppointmentModel.id.asc())
        .all()
    )

    results = []

    for appt in appointments:
        analyses = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.appointment_id == appt.id)
            .order_by(SkinAnalysis.created_at.desc())
            .all()
        )

        results.append({
            "appointment": serialize_appointment(appt),
            "analyses": analyses,
        })

    return results


@router.get("/history")
def get_appointment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["staff", "admin", "doctor"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status.in_(["Completed", "Cancelled", "Declined"]))
        .order_by(AppointmentModel.id.desc())
        .all()
    )

    results = []

    for appointment in appointments:
        latest_log = (
            db.query(AppointmentLog)
            .filter(
                AppointmentLog.appointment_id == appointment.id,
                AppointmentLog.action == appointment.status,
            )
            .order_by(AppointmentLog.created_at.desc())
            .first()
        )

        item = serialize_appointment(appointment)

        item.update({
            "last_action_by_name": latest_log.performed_by_name if latest_log else None,
            "last_action_by_role": latest_log.performed_by_role if latest_log else None,
        })

        results.append(item)

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

    doctor_links = (
        db.query(DoctorService)
        .filter(DoctorService.service_id == service.id)
        .all()
    )

    allowed_doctor_ids = [link.doctor_id for link in doctor_links]

    if not allowed_doctor_ids:
        return []

    if doctor_id is not None and doctor_id not in allowed_doctor_ids:
        raise HTTPException(status_code=400, detail="Selected doctor does not perform this service")

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
        query = query.filter(DoctorSchedule.doctor_id == doctor_id)

    if week_start is not None:
        week_monday, week_saturday = get_week_window(week_start)
        query = query.filter(
            DoctorSchedule.schedule_date >= week_monday,
            DoctorSchedule.schedule_date <= week_saturday,
        )

    query = query.order_by(
        DoctorSchedule.schedule_date.asc(),
        DoctorSchedule.start_time.asc(),
    )

    results = []

    for schedule, doctor in query.all():
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
            slot_start_datetime = datetime.combine(schedule.schedule_date, slot_start)

            if slot_start_datetime <= now:
                continue

            approved = find_approved_slot_conflict(
                db=db,
                schedule_id=schedule.id,
                slot_start=slot_start,
                slot_end=slot_end,
            )

            results.append(
                serialize_assignable_slot(
                    schedule=schedule,
                    service=service,
                    doctor=doctor,
                    slot_start=slot_start,
                    slot_end=slot_end,
                    is_available=approved is None,
                    unavailable_reason="Already booked" if approved else None,
                )
            )

    return results


@router.put("/{id}/assign-schedule")
def assign_schedule_to_initial_evaluation_request(
    id: int,
    body: AppointmentScheduleAssign,
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

    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == body.schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    doctor = (
        db.query(User)
        .filter(
            User.id == schedule.doctor_id,
            User.role == "doctor",
            User.status == "Active",
        )
        .first()
    )

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if not schedule.is_available:
        raise HTTPException(status_code=400, detail="Selected schedule is unavailable")

    if is_sunday(schedule.schedule_date):
        raise HTTPException(status_code=400, detail="Sundays are unavailable for scheduling")

    clinic_closed = (
        db.query(ClinicUnavailableDate)
        .filter(ClinicUnavailableDate.closure_date == schedule.schedule_date)
        .first()
    )

    if clinic_closed:
        raise HTTPException(status_code=400, detail="Clinic is unavailable on this date")

    doctor_service = (
        db.query(DoctorService)
        .filter(
            DoctorService.doctor_id == doctor.id,
            DoctorService.service_id == service.id,
        )
        .first()
    )

    if not doctor_service:
        raise HTTPException(status_code=400, detail="Selected doctor does not perform this service")

    if not service_matches_schedule(schedule.services, service.name):
        raise HTTPException(status_code=400, detail="Selected schedule is not assigned to this service")

    validate_slot_inside_schedule(
        schedule=schedule,
        slot_start=body.start_time,
        slot_end=body.end_time,
    )

    approved_conflict = find_approved_slot_conflict(
        db=db,
        schedule_id=schedule.id,
        slot_start=body.start_time,
        slot_end=body.end_time,
        exclude_appointment_id=appointment.id,
    )

    if approved_conflict:
        raise HTTPException(status_code=409, detail="This time slot already has an approved appointment")

    appointment.doctor_id = doctor.id
    appointment.schedule_id = schedule.id
    appointment.doctor_name = doctor.name
    appointment.date = schedule.schedule_date
    appointment.time = body.start_time
    appointment.end_time = body.end_time
    appointment.appointment_type = "Initial Evaluation"
    appointment.consultation_mode = schedule.consultation_mode or "In-Person"
    appointment.is_initial_evaluation_request = True

    db.commit()
    db.refresh(appointment)

    create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action="Schedule Assigned",
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason=f"Assigned to {doctor.name} on {schedule.schedule_date.isoformat()} from {format_time(body.start_time)} to {format_time(body.end_time)}",
    )

    return {
        "message": "Initial evaluation schedule assigned",
        "appointment": serialize_appointment(appointment),
    }


@router.get("/{id}/logs")
def get_appointment_logs(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["staff", "admin", "doctor", "patient"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "patient" and appointment.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    logs = (
        db.query(AppointmentLog)
        .filter(AppointmentLog.appointment_id == id)
        .order_by(AppointmentLog.created_at.asc())
        .all()
    )

    return [
        {
            "id": log.id,
            "appointment_id": log.appointment_id,
            "action": log.action,
            "performed_by_id": log.performed_by_id,
            "performed_by_name": log.performed_by_name,
            "performed_by_role": log.performed_by_role,
            "reason": log.reason,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/{id}")
def get_appointment_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "patient" and appointment.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if current_user.role not in ["staff", "admin", "doctor", "patient"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    return serialize_appointment(appointment)
