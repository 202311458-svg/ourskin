from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional
from collections import Counter, defaultdict
from datetime import datetime

from app.db import SessionLocal
from app.models.user import User
from app.models.diagnosis_report import DiagnosisReport
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.core.security import get_current_user
from app.schemas.user import StaffCreate
from app.models.audit_log import AuditLog
from app.services.audit_service import log_action

router = APIRouter(prefix="/admin", tags=["Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AppointmentStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None


class AdminStaffUpdate(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    contact: Optional[str] = None


class AdminStaffStatusUpdate(BaseModel):
    status: str


class StaffFromUserPayload(BaseModel):
    user_id: int
    role: str = "staff"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user


def serialize_staff(user: User):
    return {
        "id": user.id,
        "full_name": user.name,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status or "Active",
        "department": user.department,
        "phone": user.contact,
        "contact": user.contact,
        "profile_image": user.profile_image,
        "created_at": user.created_at,
    }


def save_audit_log(
    db: Session,
    action: str,
    description: str,
    current_user: User,
    target_id: Optional[int] = None,
):
    return log_action(
        db=db,
        action=action,
        description=description,
        actor_id=current_user.id,
        target_id=target_id,
        performed_by=current_user.name or current_user.email or f"User #{current_user.id}",
    )


@router.get("/dashboard")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_users = db.query(User).count()
    total_patients = db.query(User).filter(User.role == "patient").count()
    total_staff = db.query(User).filter(User.role == "staff").count()
    total_doctors = db.query(User).filter(User.role == "doctor").count()
    total_appointments = db.query(AppointmentModel).count()

    pending_appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Pending")
        .count()
    )

    approved_appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.status == "Approved")
        .count()
    )

    total_ai_logs = db.query(SkinAnalysis).count()

    return {
        "total_users": total_users,
        "total_patients": total_patients,
        "total_staff": total_staff,
        "total_doctors": total_doctors,
        "total_appointments": total_appointments,
        "pending_appointments": pending_appointments,
        "approved_appointments": approved_appointments,
        "total_ai_logs": total_ai_logs,
    }


@router.get("/users")
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "contact": user.contact,
            "role": user.role,
            "is_verified": user.is_verified,
            "status": user.status or "Active",
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.get("/appointments")
def get_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    appointments = (
        db.query(AppointmentModel)
        .order_by(AppointmentModel.date.desc())
        .all()
    )

    return [
        {
            "id": appointment.id,
            "patient_name": appointment.patient_name,
            "patient_email": appointment.patient_email,
            "doctor_name": appointment.doctor_name,
            "date": str(appointment.date),
            "time": str(appointment.time),
            "services": appointment.services,
            "status": appointment.status,
            "cancel_reason": appointment.cancel_reason,
        }
        for appointment in appointments
    ]


@router.put("/appointments/{id}/status")
def update_appointment_status(
    id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    allowed_statuses = ["Pending", "Approved", "Declined", "Cancelled", "Completed"]

    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    if payload.status in ["Declined", "Cancelled"] and not payload.cancel_reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    appointment.status = payload.status

    if payload.status in ["Declined", "Cancelled"]:
        appointment.cancel_reason = payload.cancel_reason
    else:
        appointment.cancel_reason = None

    db.commit()
    db.refresh(appointment)

    save_audit_log(
        db=db,
        action="UPDATE_APPOINTMENT_STATUS",
        description=f"Updated appointment #{appointment.id} status to {appointment.status}",
        current_user=current_user,
        target_id=appointment.id,
    )

    return {
        "message": "Appointment status updated successfully",
        "id": appointment.id,
        "status": appointment.status,
        "cancel_reason": appointment.cancel_reason,
    }


@router.get("/ai-logs")
def get_ai_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    logs = db.query(SkinAnalysis).order_by(SkinAnalysis.created_at.desc()).all()

    appointment_ids = [
        log.appointment_id for log in logs if log.appointment_id is not None
    ]

    user_ids = [
        log.user_id for log in logs if log.user_id is not None
    ]

    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.id.in_(appointment_ids))
        .all()
        if appointment_ids
        else []
    )

    users = (
        db.query(User)
        .filter(User.id.in_(user_ids))
        .all()
        if user_ids
        else []
    )

    reports = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.appointment_id.in_(appointment_ids))
        .order_by(DiagnosisReport.created_at.desc())
        .all()
        if appointment_ids
        else []
    )

    appointment_map = {
        appointment.id: appointment for appointment in appointments
    }

    user_map = {
        user.id: user for user in users
    }

    report_map = {}

    for report in reports:
        if report.appointment_id not in report_map:
            report_map[report.appointment_id] = report

    allowed_severities = ["mild", "moderate", "severe"]

    results = []

    for log in logs:
        appointment = appointment_map.get(log.appointment_id)
        user = user_map.get(log.user_id)
        report = report_map.get(log.appointment_id)

        patient_name = None
        patient_email = None
        doctor_name = None

        if appointment:
            patient_name = appointment.patient_name
            patient_email = appointment.patient_email
            doctor_name = appointment.doctor_name

        if not patient_name and user:
            patient_name = user.name

        if not patient_email and user:
            patient_email = user.email

        raw_severity = log.severity or "Unspecified"

        if raw_severity.lower() in allowed_severities:
            severity = raw_severity.capitalize()
        else:
            severity = "Unspecified"

        final_diagnosis = ""
        doctor_prescription = ""
        doctor_notes = ""
        follow_up_plan = ""
        next_visit_date = None
        diagnosis_report_id = None

        if report:
            diagnosis_report_id = report.id
            final_diagnosis = report.doctor_final_diagnosis or ""
            doctor_prescription = report.doctor_prescription or ""
            doctor_notes = report.after_appointment_notes or ""
            follow_up_plan = report.follow_up_plan or ""
            next_visit_date = (
                str(report.next_visit_date)
                if report.next_visit_date
                else None
            )

        review_status = "Pending"

        if report:
            review_status = "Completed"
        elif log.review_status == "Reviewed" or log.reviewed_at:
            review_status = "Reviewed"

        results.append(
            {
                "id": log.id,
                "user_id": log.user_id,
                "appointment_id": log.appointment_id,
                "diagnosis_report_id": diagnosis_report_id,

                "patient_name": patient_name or "Unknown Patient",
                "patient_email": patient_email or "No email available",
                "doctor_name": doctor_name or "Not assigned",

                "condition": log.condition or "No result",
                "confidence": log.confidence,
                "severity": severity,
                "recommendation": log.recommendation or "",

                "possible_conditions": log.possible_conditions or "",
                "key_findings": log.key_findings or "",
                "treatment_suggestions": log.treatment_suggestions or "",
                "prescription_suggestions": log.prescription_suggestions or "",
                "follow_up_suggestions": log.follow_up_suggestions or "",
                "red_flags": log.red_flags or "",

                "doctor_note": log.doctor_note or "",
                "review_status": review_status,
                "reviewed_at": (
                    log.reviewed_at.isoformat()
                    if log.reviewed_at
                    else None
                ),

                "final_diagnosis": final_diagnosis,
                "doctor_final_diagnosis": final_diagnosis,
                "doctor_prescription": doctor_prescription,
                "prescription": doctor_prescription,
                "doctor_notes": doctor_notes,
                "after_appointment_notes": doctor_notes,
                "follow_up_plan": follow_up_plan,
                "next_visit_date": next_visit_date,

                "created_at": (
                    log.created_at.isoformat()
                    if log.created_at
                    else None
                ),
            }
        )

    return results


@router.get("/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    appointments = db.query(AppointmentModel).all()
    users = db.query(User).all()
    ai_records = db.query(SkinAnalysis).all()
    diagnosis_reports = db.query(DiagnosisReport).all()

    # -------------------------------------------------
    # Monthly Appointment Summary
    # -------------------------------------------------
    monthly_data = defaultdict(
        lambda: {
            "total": 0,
            "pending": 0,
            "approved": 0,
            "completed": 0,
            "cancelled": 0,
            "declined": 0,
        }
    )

    for appointment in appointments:
        appointment_date = getattr(appointment, "date", None)

        if isinstance(appointment_date, str):
            try:
                appointment_date = datetime.fromisoformat(appointment_date).date()
            except ValueError:
                appointment_date = None

        if appointment_date:
            month_label = appointment_date.strftime("%B %Y")
            sort_key = appointment_date.strftime("%Y-%m")
        else:
            month_label = "No Date"
            sort_key = "0000-00"

        status = (appointment.status or "").strip().lower()

        monthly_data[(sort_key, month_label)]["total"] += 1

        if status == "pending":
            monthly_data[(sort_key, month_label)]["pending"] += 1
        elif status == "approved":
            monthly_data[(sort_key, month_label)]["approved"] += 1
        elif status == "completed":
            monthly_data[(sort_key, month_label)]["completed"] += 1
        elif status == "cancelled":
            monthly_data[(sort_key, month_label)]["cancelled"] += 1
        elif status == "declined":
            monthly_data[(sort_key, month_label)]["declined"] += 1

    monthly_appointments = []

    for (sort_key, month_label), values in monthly_data.items():
        monthly_appointments.append(
            {
                "month": month_label,
                "total": values["total"],
                "pending": values["pending"],
                "approved": values["approved"],
                "completed": values["completed"],
                "cancelled": values["cancelled"],
                "declined": values["declined"],
                "_sort_key": sort_key,
            }
        )

    monthly_appointments.sort(key=lambda item: item["_sort_key"], reverse=True)

    for item in monthly_appointments:
        item.pop("_sort_key", None)

    # -------------------------------------------------
    # AI Skin Condition Summary
    # -------------------------------------------------
    condition_groups = defaultdict(
        lambda: {
            "cases": 0,
            "confidence_values": [],
            "severity_values": [],
        }
    )

    for record in ai_records:
        condition = record.condition or "Unspecified"
        severity = record.severity or "Unspecified"
        confidence = record.confidence

        condition_groups[condition]["cases"] += 1
        condition_groups[condition]["severity_values"].append(severity)

        if confidence is not None:
            try:
                condition_groups[condition]["confidence_values"].append(
                    float(confidence)
                )
            except (TypeError, ValueError):
                pass

    ai_condition_summary = []

    for condition, values in condition_groups.items():
        confidence_values = values["confidence_values"]
        severity_values = values["severity_values"]

        average_confidence = None

        if confidence_values:
            average_confidence = sum(confidence_values) / len(confidence_values)

        common_severity = "Unspecified"

        if severity_values:
            common_severity = Counter(severity_values).most_common(1)[0][0]

        ai_condition_summary.append(
            {
                "condition": condition,
                "cases": values["cases"],
                "average_confidence": average_confidence,
                "common_severity": common_severity,
            }
        )

    ai_condition_summary.sort(key=lambda item: item["cases"], reverse=True)

    # -------------------------------------------------
    # User Growth / User Summary
    # -------------------------------------------------
    user_groups = defaultdict(
        lambda: {
            "total": 0,
            "active": 0,
            "inactive": 0,
            "verified": 0,
            "unverified": 0,
        }
    )

    for user in users:
        role = user.role or "unknown"
        status = (user.status or "Active").strip().lower()
        is_verified = bool(user.is_verified)

        user_groups[role]["total"] += 1

        if status == "active":
            user_groups[role]["active"] += 1
        else:
            user_groups[role]["inactive"] += 1

        if is_verified:
            user_groups[role]["verified"] += 1
        else:
            user_groups[role]["unverified"] += 1

    user_growth = []

    for role, values in user_groups.items():
        user_growth.append(
            {
                "role": role,
                "total": values["total"],
                "active": values["active"],
                "inactive": values["inactive"],
                "verified": values["verified"],
                "unverified": values["unverified"],
            }
        )

    user_growth.sort(key=lambda item: item["role"])

    # -------------------------------------------------
    # Completed vs Cancelled Appointments
    # -------------------------------------------------
    completed_count = 0
    cancelled_count = 0

    for appointment in appointments:
        status = (appointment.status or "").strip().lower()

        if status == "completed":
            completed_count += 1
        elif status == "cancelled":
            cancelled_count += 1

    completed_cancelled_total = completed_count + cancelled_count

    completion_rate = 0
    cancellation_rate = 0

    if completed_cancelled_total > 0:
        completion_rate = (completed_count / completed_cancelled_total) * 100
        cancellation_rate = (cancelled_count / completed_cancelled_total) * 100

    completed_vs_cancelled = {
        "completed": completed_count,
        "cancelled": cancelled_count,
        "total": completed_cancelled_total,
        "completion_rate": completion_rate,
        "cancellation_rate": cancellation_rate,
    }

    # -------------------------------------------------
    # Doctor Activity
    # -------------------------------------------------
    doctor_activity_map = {}

    doctors = [
        user for user in users if (user.role or "").strip().lower() == "doctor"
    ]

    for doctor in doctors:
        doctor_name = doctor.name or doctor.email or f"Doctor #{doctor.id}"

        doctor_activity_map[doctor_name] = {
            "doctor_name": doctor_name,
            "assigned_appointments": 0,
            "completed_appointments": 0,
            "pending_ai_reviews": 0,
            "reviewed_ai_cases": 0,
        }

    appointments_by_id = {}

    for appointment in appointments:
        appointments_by_id[appointment.id] = appointment

        doctor_name = appointment.doctor_name or "Unassigned"

        if doctor_name not in doctor_activity_map:
            doctor_activity_map[doctor_name] = {
                "doctor_name": doctor_name,
                "assigned_appointments": 0,
                "completed_appointments": 0,
                "pending_ai_reviews": 0,
                "reviewed_ai_cases": 0,
            }

        doctor_activity_map[doctor_name]["assigned_appointments"] += 1

        status = (appointment.status or "").strip().lower()

        if status == "completed":
            doctor_activity_map[doctor_name]["completed_appointments"] += 1

    report_appointment_ids = {
        report.appointment_id
        for report in diagnosis_reports
        if report.appointment_id is not None
    }

    for record in ai_records:
        appointment = appointments_by_id.get(record.appointment_id)

        if not appointment:
            continue

        doctor_name = appointment.doctor_name or "Unassigned"

        if doctor_name not in doctor_activity_map:
            doctor_activity_map[doctor_name] = {
                "doctor_name": doctor_name,
                "assigned_appointments": 0,
                "completed_appointments": 0,
                "pending_ai_reviews": 0,
                "reviewed_ai_cases": 0,
            }

        review_status = (getattr(record, "review_status", "") or "").strip().lower()
        reviewed_at = getattr(record, "reviewed_at", None)

        has_diagnosis_report = record.appointment_id in report_appointment_ids

        is_reviewed = (
            review_status in ["reviewed", "completed", "done"]
            or reviewed_at is not None
            or has_diagnosis_report
        )

        if is_reviewed:
            doctor_activity_map[doctor_name]["reviewed_ai_cases"] += 1
        else:
            doctor_activity_map[doctor_name]["pending_ai_reviews"] += 1

    doctor_activity = list(doctor_activity_map.values())

    doctor_activity.sort(
        key=lambda item: item["assigned_appointments"],
        reverse=True,
    )

    return {
        "monthly_appointments": monthly_appointments,
        "ai_condition_summary": ai_condition_summary,
        "user_growth": user_growth,
        "completed_vs_cancelled": completed_vs_cancelled,
        "doctor_activity": doctor_activity,
    }


@router.get("/staff")
def get_all_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    staff_roles = ["admin", "staff", "doctor"]

    staff_users = (
        db.query(User)
        .filter(User.role.in_(staff_roles))
        .order_by(User.created_at.desc())
        .all()
    )

    return [serialize_staff(user) for user in staff_users]


@router.get("/staff/candidates")
def get_verified_non_staff_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    candidates = (
        db.query(User)
        .filter(User.is_verified == True)
        .filter(~User.role.in_(["admin", "staff", "doctor"]))
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "contact": user.contact,
        }
        for user in candidates
    ]


@router.get("/verified-users")
def get_verified_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = (
        db.query(User)
        .filter(User.is_verified == True)
        .filter(~User.role.in_(["admin", "staff", "doctor"]))
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
        for user in users
    ]


@router.get("/staff/{id}")
def get_staff_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == id).first()

    if not user or user.role not in ["admin", "staff", "doctor"]:
        raise HTTPException(status_code=404, detail="Staff not found")

    return serialize_staff(user)


@router.post("/staff")
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.role not in ["admin", "staff", "doctor"]:
        raise HTTPException(status_code=400, detail="Invalid staff role")

    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_staff = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=pwd_context.hash(payload.password),
        contact=payload.contact,
        role=payload.role,
        is_verified=True,
        verification_token=None,
        status=payload.status or "Active",
        department=payload.department,
        profile_image=payload.profile_image,
    )

    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    save_audit_log(
        db=db,
        action="CREATE_STAFF",
        description=f"Created new staff account: {new_staff.name} with role {new_staff.role}",
        current_user=current_user,
        target_id=new_staff.id,
    )

    return serialize_staff(new_staff)


@router.post("/staff/from-user")
def create_staff_from_user(
    payload: StaffFromUserPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = payload.role.lower()

    if role not in ["admin", "staff", "doctor"]:
        raise HTTPException(status_code=400, detail="Invalid staff role")

    user = db.query(User).filter(User.id == payload.user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role in ["admin", "staff", "doctor"]:
        raise HTTPException(
            status_code=400,
            detail="User is already an internal account",
        )

    previous_role = user.role

    user.role = role
    user.status = "Active"

    db.commit()
    db.refresh(user)

    save_audit_log(
        db=db,
        action="PROMOTE_TO_STAFF",
        description=f"Promoted user {user.name} from {previous_role} to {user.role}",
        current_user=current_user,
        target_id=user.id,
    )

    return serialize_staff(user)


@router.put("/staff/{id}")
def update_staff(
    id: int,
    payload: AdminStaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == id).first()

    if not user or user.role not in ["admin", "staff", "doctor"]:
        raise HTTPException(status_code=404, detail="Staff not found")

    old_name = user.name
    old_role = user.role
    old_department = user.department
    old_contact = user.contact

    new_name = payload.full_name or payload.name
    new_contact = payload.phone or payload.contact

    changes = []

    if new_name is not None:
        cleaned_name = new_name.strip()

        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Full name is required")

        if cleaned_name != user.name:
            changes.append(f"name from '{user.name}' to '{cleaned_name}'")
            user.name = cleaned_name

    if payload.role is not None:
        role = payload.role.strip().lower()

        if role not in ["admin", "staff", "doctor"]:
            raise HTTPException(status_code=400, detail="Invalid role")

        if role != user.role:
            changes.append(f"role from '{user.role}' to '{role}'")
            user.role = role

    if payload.department is not None:
        department = payload.department.strip() if payload.department else None

        if department != user.department:
            changes.append(
                f"department from '{user.department or 'N/A'}' to '{department or 'N/A'}'"
            )
            user.department = department

    if new_contact is not None:
        contact = new_contact.strip() if new_contact else None

        if contact != user.contact:
            changes.append(
                f"contact from '{user.contact or 'N/A'}' to '{contact or 'N/A'}'"
            )
            user.contact = contact

    if not changes:
        return serialize_staff(user)

    db.commit()
    db.refresh(user)

    save_audit_log(
        db=db,
        action="UPDATE_STAFF",
        description=f"Updated staff account {old_name}: " + "; ".join(changes),
        current_user=current_user,
        target_id=user.id,
    )

    return serialize_staff(user)


@router.put("/staff/{id}/status")
def update_staff_status(
    id: int,
    payload: AdminStaffStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == id).first()

    if not user or user.role not in ["admin", "staff", "doctor"]:
        raise HTTPException(status_code=404, detail="Staff not found")

    allowed_statuses = ["Active", "Inactive"]

    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid account status")

    if user.id == current_user.id and payload.status == "Inactive":
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own admin account",
        )

    old_status = user.status or "Active"

    if old_status == payload.status:
        return serialize_staff(user)

    user.status = payload.status

    db.commit()
    db.refresh(user)

    action = "DEACTIVATE_ACCOUNT" if payload.status == "Inactive" else "REACTIVATE_ACCOUNT"

    save_audit_log(
        db=db,
        action=action,
        description=f"Changed {user.name}'s account status from {old_status} to {user.status}",
        current_user=current_user,
        target_id=user.id,
    )

    return serialize_staff(user)


@router.get("/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()

    user_ids = set()

    for log in logs:
        if log.actor_id:
            user_ids.add(log.actor_id)

        if log.target_id:
            user_ids.add(log.target_id)

    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {user.id: user for user in users}

    return [
        {
            "id": log.id,
            "action": log.action,
            "description": log.description,
            "actor_id": log.actor_id,
            "actor_name": user_map[log.actor_id].name
            if log.actor_id in user_map
            else None,
            "target_id": log.target_id,
            "target_name": user_map[log.target_id].name
            if log.target_id in user_map
            else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]