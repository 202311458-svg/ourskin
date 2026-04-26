from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel

from app.db import SessionLocal
from app.models.user import User
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.core.security import get_current_user
from app.schemas.user import StaffCreate, StaffUpdate, StaffStatusUpdate

router = APIRouter(prefix="/admin", tags=["Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AppointmentStatusUpdate(BaseModel):
    status: str
    cancel_reason: str | None = None


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
        "email": user.email,
        "role": user.role,
        "status": user.status or "Active",
        "department": user.department,
        "phone": user.contact,
        "profile_image": user.profile_image,
        "created_at": user.created_at,
    }


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
        db.query(AppointmentModel).filter(AppointmentModel.status == "Pending").count()
    )
    approved_appointments = (
        db.query(AppointmentModel).filter(AppointmentModel.status == "Approved").count()
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
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "contact": u.contact,
            "role": u.role,
            "is_verified": u.is_verified,
            "status": getattr(u, "status", "Active"),
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/appointments")
def get_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    appointments = db.query(AppointmentModel).order_by(AppointmentModel.date.desc()).all()

    return [
        {
            "id": a.id,
            "patient_name": a.patient_name,
            "patient_email": a.patient_email,
            "doctor_name": a.doctor_name,
            "date": str(a.date),
            "time": str(a.time),
            "services": a.services,
            "status": a.status,
            "cancel_reason": a.cancel_reason,
        }
        for a in appointments
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

    allowed_statuses = ["Pending", "Approved", "Declined"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    if payload.status == "Declined" and not payload.cancel_reason:
        raise HTTPException(status_code=400, detail="Cancel reason is required")

    appointment.status = payload.status
    appointment.cancel_reason = (
        payload.cancel_reason if payload.status == "Declined" else None
    )

    db.commit()
    db.refresh(appointment)

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

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "appointment_id": log.appointment_id,
            "image_path": log.image_path,
            "condition": log.condition,
            "confidence": log.confidence,
            "severity": log.severity,
            "recommendation": log.recommendation,
            "doctor_note": log.doctor_note,
            "created_at": log.created_at,
        }
        for log in logs
    ]


#staff mgmt endpoints
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

    return serialize_staff(new_staff)


@router.put("/staff/{id}")
def update_staff(
    id: int,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == id).first()

    if not user or user.role not in ["Admin", "Staff", "Doctor"]:
        raise HTTPException(status_code=404, detail="Staff not found")

    if payload.email and payload.email.lower() != user.email:
        existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = payload.email.lower()

    if payload.name is not None:
        user.name = payload.name

    if payload.role is not None:
        if payload.role not in ["Admin", "Staff", "Doctor"]:
            raise HTTPException(status_code=400, detail="Invalid staff role")
        user.role = payload.role

    if payload.department is not None:
        user.department = payload.department

    if payload.contact is not None:
        user.contact = payload.contact

    if payload.profile_image is not None:
        user.profile_image = payload.profile_image

    if payload.status is not None:
        user.status = payload.status

    db.commit()
    db.refresh(user)

    return serialize_staff(user)

@router.put("/staff/{id}")
def update_staff(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Staff not found")

    # NAME (accept EXACT input, no formatting)
    if "full_name" in payload:
        user.name = payload["full_name"]

    # ROLE (NO LOWERCASE, NO VALIDATION STRIP)
    if "role" in payload:
        user.role = payload["role"]

    if "department" in payload:
        user.department = payload["department"]

    if "phone" in payload:
        user.contact = payload["phone"]

    db.commit()
    db.refresh(user)

    return serialize_staff(user)


@router.get("/staff/candidates")
def get_verified_non_staff_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # users who are VERIFIED but NOT already staff/admin/doctor
    candidates = (
        db.query(User)
        .filter(User.is_verified == True)
        .filter(~User.role.in_(["admin", "staff", "doctor"]))
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "contact": u.contact,
        }
        for u in candidates
    ]

@router.get("/verified-users")
def get_verified_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = db.query(User).filter(User.is_verified == True).all()

    return [
        {"id": u.id, "name": u.name, "email": u.email}
        for u in users
    ]


@router.post("/staff/from-user")
def create_staff_from_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == payload["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = payload.get("role", "staff")
    user.status = "Active"

    db.commit()
    db.refresh(user)

    return serialize_staff(user)