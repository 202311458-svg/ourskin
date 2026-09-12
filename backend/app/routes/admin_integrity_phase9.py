from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.appointment import AppointmentModel
from app.models.user import User
from app.routes.admin import require_admin
from app.routes.admin_accounts_phase6 import (
    ACCOUNT_STATUSES,
    INTERNAL_ROLES,
    AccountStatusUpdate,
    StaffFromUserPayload,
    StaffUpdatePayload,
    _clean,
    _doctor_has_clinical_links,
    _serialize_managed_staff,
    _serialize_managed_user,
)
from app.services.audit_service import stage_action

router = APIRouter(prefix="/admin", tags=["Admin Integrity Phase 9"])


def _active_admin_count(db: Session) -> int:
    return (
        db.query(User)
        .filter(func.lower(User.role) == "admin", func.lower(User.status) == "active")
        .count()
    )


def _lock_user(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .filter(User.id == user_id)
        .with_for_update()
        .first()
    )


def _lock_active_admins(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(func.lower(User.role) == "admin", func.lower(User.status) == "active")
        .order_by(User.id.asc())
        .with_for_update()
        .all()
    )


def _lock_target_for_access_change(
    db: Session,
    user_id: int,
    *,
    removing_active_admin_access: bool,
) -> User | None:
    if not removing_active_admin_access:
        return _lock_user(db, user_id)

    active_admins = _lock_active_admins(db)
    target = next((user for user in active_admins if user.id == user_id), None)
    if target is None:
        return _lock_user(db, user_id)
    if len(active_admins) <= 1:
        raise HTTPException(
            status_code=409,
            detail="The last active administrator must remain active and keep the admin role.",
        )
    return target


def _canonical_status(value: str) -> str:
    status = _clean(value).lower()
    if status not in ACCOUNT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid account status")
    return ACCOUNT_STATUSES[status]


def _assert_admin_access_change_allowed(
    target: User,
    current_user: User,
    *,
    removing_active_admin_access: bool,
) -> None:
    if target.id == current_user.id and removing_active_admin_access:
        raise HTTPException(
            status_code=409,
            detail="You cannot remove your own administrator access.",
        )


def _commit(db: Session, user: User) -> User:
    try:
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        raise


def _stage_account_audit(
    db: Session,
    *,
    action: str,
    description: str,
    current_user: User,
    target: User,
    before_data: dict,
    after_data: dict,
    metadata_json: dict | None = None,
) -> None:
    stage_action(
        db=db,
        action=action,
        description=description,
        actor_id=current_user.id,
        actor_role=current_user.role,
        performed_by=current_user.name or current_user.email or f"User #{current_user.id}",
        target_id=target.id,
        target_type="user",
        target_record_id=target.id,
        before_data=before_data,
        after_data=after_data,
        metadata_json=metadata_json,
    )


def _change_status(
    db: Session,
    *,
    user: User,
    current_user: User,
    next_status: str,
) -> User:
    old_status = user.status or "Active"
    if old_status == next_status:
        return user

    role = _clean(user.role).lower()
    active = _clean(old_status).lower() == "active"
    removing_active_admin_access = (
        next_status == "Inactive" and role == "admin" and active
    )
    if next_status == "Inactive" and user.id == current_user.id:
        raise HTTPException(
            status_code=409,
            detail="You cannot deactivate your own administrator account.",
        )
    _assert_admin_access_change_allowed(
        user,
        current_user,
        removing_active_admin_access=removing_active_admin_access,
    )

    user.status = next_status
    if next_status == "Inactive":
        user.auth_invalid_before = datetime.now(timezone.utc)

    _stage_account_audit(
        db,
        action="DEACTIVATE_ACCOUNT" if next_status == "Inactive" else "REACTIVATE_ACCOUNT",
        description=f"Changed {user.name}'s account status from {old_status} to {next_status}",
        current_user=current_user,
        target=user,
        before_data={"status": old_status},
        after_data={"status": next_status},
        metadata_json={"session_invalidated": next_status == "Inactive"},
    )
    return _commit(db, user)


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    next_status = _canonical_status(payload.status)
    snapshot = db.query(User).filter(User.id == user_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="User not found")
    removing_admin = (
        next_status == "Inactive"
        and _clean(snapshot.role).lower() == "admin"
        and _clean(snapshot.status or "Active").lower() == "active"
    )
    user = _lock_target_for_access_change(
        db,
        user_id,
        removing_active_admin_access=removing_admin,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user = _change_status(
        db,
        user=user,
        current_user=current_user,
        next_status=next_status,
    )
    return _serialize_managed_user(user, current_user, _active_admin_count(db))


@router.put("/staff/{staff_id}/status")
def update_staff_status(
    staff_id: int,
    payload: AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    next_status = _canonical_status(payload.status)
    snapshot = db.query(User).filter(User.id == staff_id).first()
    if not snapshot or _clean(snapshot.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")
    removing_admin = (
        next_status == "Inactive"
        and _clean(snapshot.role).lower() == "admin"
        and _clean(snapshot.status or "Active").lower() == "active"
    )
    user = _lock_target_for_access_change(
        db,
        staff_id,
        removing_active_admin_access=removing_admin,
    )
    if not user or _clean(user.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")

    user = _change_status(
        db,
        user=user,
        current_user=current_user,
        next_status=next_status,
    )
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

    user = _lock_user(db, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if _clean(user.role).lower() in INTERNAL_ROLES:
        raise HTTPException(status_code=400, detail="User is already an internal account")
    if not user.is_verified:
        raise HTTPException(
            status_code=409,
            detail="Only verified accounts can be promoted to internal access.",
        )
    if _clean(user.status).lower() != "active":
        raise HTTPException(
            status_code=409,
            detail="Inactive accounts must be reactivated before promotion.",
        )
    if (
        db.query(AppointmentModel.id)
        .filter(AppointmentModel.patient_id == user.id)
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail="Accounts with patient appointment history cannot be converted to internal staff accounts.",
        )

    previous_role = user.role
    user.role = role
    user.auth_invalid_before = datetime.now(timezone.utc)

    _stage_account_audit(
        db,
        action="PROMOTE_TO_STAFF",
        description=f"Promoted user {user.name} from {previous_role} to {user.role}",
        current_user=current_user,
        target=user,
        before_data={"role": previous_role},
        after_data={"role": user.role},
        metadata_json={"session_invalidated": True},
    )
    user = _commit(db, user)
    return _serialize_managed_staff(user, current_user, _active_admin_count(db))


@router.put("/staff/{staff_id}")
def update_staff(
    staff_id: int,
    payload: StaffUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    snapshot = db.query(User).filter(User.id == staff_id).first()
    if not snapshot or _clean(snapshot.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")

    requested_role = _clean(payload.role).lower() if payload.role is not None else None
    removing_admin = (
        requested_role is not None
        and requested_role != "admin"
        and _clean(snapshot.role).lower() == "admin"
        and _clean(snapshot.status or "Active").lower() == "active"
    )
    user = _lock_target_for_access_change(
        db,
        staff_id,
        removing_active_admin_access=removing_admin,
    )
    if not user or _clean(user.role).lower() not in INTERNAL_ROLES:
        raise HTTPException(status_code=404, detail="Staff not found")

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
        next_role = _clean(payload.role).lower()
        current_role = _clean(user.role).lower()
        if next_role not in INTERNAL_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")

        if next_role != current_role:
            removing_active_admin_access = (
                current_role == "admin"
                and _clean(user.status or "Active").lower() == "active"
                and next_role != "admin"
            )
            _assert_admin_access_change_allowed(
                user,
                current_user,
                removing_active_admin_access=removing_active_admin_access,
            )

            if current_role == "doctor" and _doctor_has_clinical_links(db, user.id):
                raise HTTPException(
                    status_code=409,
                    detail="Doctors with appointment or schedule history cannot be changed to another role. Deactivate the account instead.",
                )

            specialty = _clean(payload.specialty) or _clean(user.specialty)
            if next_role == "doctor" and not specialty:
                raise HTTPException(
                    status_code=400,
                    detail="Doctor specialty is required before assigning the doctor role.",
                )

            user.role = next_role
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
        return _serialize_managed_staff(user, current_user, _active_admin_count(db))

    role_changed = _clean(old["role"]).lower() != _clean(after["role"]).lower()
    _stage_account_audit(
        db,
        action="UPDATE_STAFF",
        description=f"Updated internal account {user.name}",
        current_user=current_user,
        target=user,
        before_data=old,
        after_data=after,
        metadata_json={"session_invalidated": role_changed},
    )
    user = _commit(db, user)
    return _serialize_managed_staff(user, current_user, _active_admin_count(db))
