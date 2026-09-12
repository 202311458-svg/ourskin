from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.doctor_schedule import DoctorSchedule
from app.models.user import User
from app.routes.admin import (
    require_admin,
    save_audit_log,
    serialize_admin_user,
    serialize_staff,
    validate_pagination,
)
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin Accounts"])

INTERNAL_ROLES = {"admin", "staff", "doctor"}
ACCOUNT_STATUSES = {"active": "Active", "inactive": "Inactive"}


class AccountStatusUpdate(BaseModel):
    status: str


class StaffFromUserPayload(BaseModel):
    user_id: int
    role: str = "staff"


class StaffUpdatePayload(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    contact: Optional[str] = None
    specialty: Optional[str] = None


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _contains(column, term: str):
    return column.ilike(f"%{term}%")


def _canonical_status(value: str) -> str:
    status = _clean(value).lower()
    if status not in ACCOUNT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid account status")
    return ACCOUNT_STATUSES[status]


def _active_admin_count(db: Session) -> int:
    return (
        db.query(User)
        .filter(func.lower(User.role) == "admin", func.lower(User.status) == "active")
        .count()
    )


def _account_controls(user: User, current_user: User, active_admins: int) -> dict:
    role = _clean(user.role).lower()
    active = _clean(user.status or "Active").lower() == "active"
    is_self = user.id == current_user.id
    last_active_admin = role == "admin" and active and active_admins <= 1

    protection_reason = None
    if is_self:
        protection_reason = "Your own administrator role and access cannot be removed here."
    elif last_active_admin:
        protection_reason = "The last active administrator must remain active and keep the admin role."

    return {
        "is_current_user": is_self,
        "can_deactivate": active and not is_self and not last_active_admin,
        "can_reactivate": not active,
        "can_change_role": not is_self and not last_active_admin,
        "protection_reason": protection_reason,
    }


def _serialize_managed_user(user: User, current_user: User, active_admins: int) -> dict:
    item = serialize_admin_user(user)
    item.update(_account_controls(user, current_user, active_admins))
    return item


def _serialize_managed_staff(user: User, current_user: User, active_admins: int) -> dict:
    item = serialize_staff(user)
    item["specialty"] = user.specialty
    item["availability"] = user.availability
    item["bio"] = user.bio
    item.update(_account_controls(user, current_user, active_admins))
    return item


def _user_summary(db: Session) -> dict[str, int]:
    total = db.query(User).count()
    return {
        "total": total,
        "patients": db.query(User).filter(func.lower(User.role) == "patient").count(),
        "internal": db.query(User).filter(func.lower(User.role).in_(INTERNAL_ROLES)).count(),
        "verified": db.query(User).filter(User.is_verified.is_(True)).count(),
        "minors": db.query(User).filter(func.lower(User.role) == "patient", User.is_minor.is_(True)).count(),
        "active": db.query(User).filter(func.lower(User.status) == "active").count(),
        "inactive": db.query(User).filter(func.lower(User.status) != "active").count(),
    }


def _staff_summary(db: Session) -> dict[str, int]:
    base = db.query(User).filter(func.lower(User.role).in_(INTERNAL_ROLES))
    return {
        "total": base.count(),
        "active": base.filter(func.lower(User.status) == "active").count(),
        "inactive": base.filter(func.lower(User.status) != "active").count(),
        "admins": base.filter(func.lower(User.role) == "admin").count(),
        "staff": base.filter(func.lower(User.role) == "staff").count(),
        "doctors": base.filter(func.lower(User.role) == "doctor").count(),
    }


@router.get("/users/query")
def query_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    role: Optional[str] = Query(default=None, max_length=32),
    verification: Optional[str] = Query(default=None, max_length=32),
    patient_type: Optional[str] = Query(default=None, max_length=32),
    status: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    query = db.query(User)

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(User.name, keyword),
                _contains(User.first_name, keyword),
                _contains(User.last_name, keyword),
                _contains(User.email, keyword),
                _contains(User.contact, keyword),
                _contains(User.address, keyword),
                _contains(User.guardian_first_name, keyword),
                _contains(User.guardian_last_name, keyword),
                _contains(User.guardian_email, keyword),
                _contains(User.guardian_contact, keyword),
                _contains(User.specialty, keyword),
                _contains(User.department, keyword),
            )
        )

    role_value = _clean(role).lower()
    if role_value and role_value != "all":
        query = query.filter(func.lower(User.role) == role_value)

    verification_value = _clean(verification).lower()
    if verification_value == "verified":
        query = query.filter(User.is_verified.is_(True))
    elif verification_value == "unverified":
        query = query.filter(User.is_verified.is_(False))

    patient_type_value = _clean(patient_type).lower()
    if patient_type_value == "minor":
        query = query.filter(func.lower(User.role) == "patient", User.is_minor.is_(True))
    elif patient_type_value == "adult":
        query = query.filter(func.lower(User.role) == "patient", User.is_minor.is_(False))
    elif patient_type_value == "internal":
        query = query.filter(func.lower(User.role).in_(INTERNAL_ROLES))

    status_value = _clean(status).lower()
    if status_value in ACCOUNT_STATUSES:
        query = query.filter(func.lower(User.status) == status_value)

    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    active_admins = _active_admin_count(db)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _user_summary(db),
        "items": [_serialize_managed_user(user, current_user, active_admins) for user in users],
    }


@router.get("/staff/query")
def query_admin_staff(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    role: Optional[str] = Query(default=None, max_length=32),
    status: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    query = db.query(User).filter(func.lower(User.role).in_(INTERNAL_ROLES))

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(User.name, keyword),
                _contains(User.email, keyword),
                _contains(User.department, keyword),
                _contains(User.contact, keyword),
                _contains(User.specialty, keyword),
            )
        )

    role_value = _clean(role).lower()
    if role_value and role_value != "all":
        if role_value not in INTERNAL_ROLES:
            raise HTTPException(status_code=400, detail="Invalid internal role")
        query = query.filter(func.lower(User.role) == role_value)

    status_value = _clean(status).lower()
    if status_value in ACCOUNT_STATUSES:
        query = query.filter(func.lower(User.status) == status_value)

    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    active_admins = _active_admin_count(db)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _staff_summary(db),
        "items": [_serialize_managed_staff(user, current_user, active_admins) for user in users],
    }


@router.get("/staff/candidates/query")
def query_staff_candidates(
    search: Optional[str] = Query(default=None, max_length=160),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    appointment_exists = (
        db.query(AppointmentModel.id)
        .filter(AppointmentModel.patient_id == User.id)
        .exists()
    )
    query = (
        db.query(User)
        .filter(User.is_verified.is_(True))
        .filter(func.lower(User.status) == "active")
        .filter(~func.lower(User.role).in_(INTERNAL_ROLES))
        .filter(~appointment_exists)
    )

    keyword = _clean(search)
    if keyword:
        query = query.filter(or_(_contains(User.name, keyword), _contains(User.email, keyword)))

    users = query.order_by(User.created_at.desc(), User.id.desc()).limit(limit).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "contact": user.contact,
            "note": "Verified active account with no patient appointment history.",
        }
        for user in users
    ]


def _assert_status_change_allowed(db: Session, user: User, current_user: User, next_status: str) -> None:
    if next_status != "Inactive":
        return
    if user.id == current_user.id:
        raise HTTPException(status_code=409, detail="You cannot deactivate your own administrator account.")
    if _clean(user.role).lower() == "admin" and _clean(user.status).lower() == "active":
        if _active_admin_count(db) <= 1:
            raise HTTPException(status_code=409, detail="The last active administrator cannot be deactivated.")


def _apply_status_change(db: Session, user: User, current_user: User, next_status: str) -> User:
    old_status = user.status or "Active"
    if old_status == next_status:
        return user

    _assert_status_change_allowed(db, user, current_user, next_status)
    user.status = next_status
    if next_status == "Inactive":
        user.auth_invalid_before = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    save_audit_log(
        db=db,
        action="DEACTIVATE_ACCOUNT" if next_status == "Inactive" else "REACTIVATE_ACCOUNT",
        description=f"Changed {user.name}'s account status from {old_status} to {next_status}",
        current_user=current_user,
        target_type="user",
        target_record_id=user.id,
        target_id=user.id,
        before_data={"status": old_status},
        after_data={"status": next_status},
        metadata_json={"session_invalidated": next_status == "Inactive"},
    )
    return user


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    next_status = _canonical_status(payload.status)
    user = _apply_status_change(db, user, current_user, next_status)
    return _serialize_managed_user(user, current_user, _active_admin_count(db))


@router.put("/staff/{staff_id}/status")
def update_staff_status(
    staff_id: int,
    payload: AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == staff_id).first()
    if not user or _clean(user.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")
    next_status = _canonical_status(payload.status)
    user = _apply_status_change(db, user, current_user, next_status)
    return _serialize_managed_staff(user, current_user, _active_admin_count(db))


@router.post("/staff/from-user")
def create_staff_from_user(
    payload: StaffFromUserPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = _clean(payload.role).lower()
    if role not in INTERNAL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid staff role")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if _clean(user.role).lower() in INTERNAL_ROLES:
        raise HTTPException(status_code=400, detail="User is already an internal account")
    if not user.is_verified:
        raise HTTPException(status_code=409, detail="Only verified accounts can be promoted to internal access.")
    if _clean(user.status).lower() != "active":
        raise HTTPException(status_code=409, detail="Inactive accounts must be reactivated before promotion.")
    if db.query(AppointmentModel).filter(AppointmentModel.patient_id == user.id).first():
        raise HTTPException(
            status_code=409,
            detail="Accounts with patient appointment history cannot be converted to internal staff accounts.",
        )

    previous_role = user.role
    user.role = role
    user.auth_invalid_before = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    save_audit_log(
        db=db,
        action="PROMOTE_TO_STAFF",
        description=f"Promoted user {user.name} from {previous_role} to {user.role}",
        current_user=current_user,
        target_type="user",
        target_record_id=user.id,
        target_id=user.id,
        before_data={"role": previous_role},
        after_data={"role": user.role},
        metadata_json={"session_invalidated": True},
    )
    return _serialize_managed_staff(user, current_user, _active_admin_count(db))


def _doctor_has_clinical_links(db: Session, user_id: int) -> bool:
    return bool(
        db.query(AppointmentModel).filter(AppointmentModel.doctor_id == user_id).first()
        or db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == user_id).first()
    )


@router.put("/staff/{staff_id}")
def update_staff(
    staff_id: int,
    payload: StaffUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == staff_id).first()
    if not user or _clean(user.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")

    active_admins = _active_admin_count(db)
    controls = _account_controls(user, current_user, active_admins)
    old = {
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "contact": user.contact,
        "specialty": user.specialty,
    }

    new_name = payload.full_name if payload.full_name is not None else payload.name
    if new_name is not None:
        cleaned_name = _clean(new_name)
        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Full name is required")
        user.name = cleaned_name

    if payload.role is not None:
        role = _clean(payload.role).lower()
        if role not in INTERNAL_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        if role != _clean(user.role).lower():
            if not controls["can_change_role"]:
                raise HTTPException(status_code=409, detail=controls["protection_reason"] or "Role change is protected.")
            if _clean(user.role).lower() == "doctor" and _doctor_has_clinical_links(db, user.id):
                raise HTTPException(
                    status_code=409,
                    detail="Doctors with appointment or schedule history cannot be changed to another role. Deactivate the account instead.",
                )
            specialty = _clean(payload.specialty) or _clean(user.specialty)
            if role == "doctor" and not specialty:
                raise HTTPException(status_code=400, detail="Doctor specialty is required before assigning the doctor role.")
            user.role = role
            user.auth_invalid_before = datetime.now(timezone.utc)

    if payload.department is not None:
        user.department = _clean(payload.department) or None
    new_contact = payload.phone if payload.phone is not None else payload.contact
    if new_contact is not None:
        user.contact = _clean(new_contact) or None
    if payload.specialty is not None:
        user.specialty = _clean(payload.specialty) or None

    after = {
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "contact": user.contact,
        "specialty": user.specialty,
    }
    if old == after:
        return _serialize_managed_staff(user, current_user, active_admins)

    db.commit()
    db.refresh(user)
    save_audit_log(
        db=db,
        action="UPDATE_STAFF",
        description=f"Updated internal account {user.name}",
        current_user=current_user,
        target_type="user",
        target_record_id=user.id,
        target_id=user.id,
        before_data=old,
        after_data=after,
        metadata_json={"session_invalidated": old["role"] != after["role"]},
    )
    return _serialize_managed_staff(user, current_user, _active_admin_count(db))
