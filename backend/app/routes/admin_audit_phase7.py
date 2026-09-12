from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session, aliased

from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.routes.admin import require_admin, validate_pagination
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin Audit Oversight"])


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _contains(column, term: str):
    return column.ilike(f"%{term}%")


def _audit_action_has(*terms: str):
    upper_action = func.upper(func.coalesce(AuditLog.action, ""))
    return or_(*(upper_action.like(f"%{term}%") for term in terms))


def _audit_module_conditions():
    account_raw = _audit_action_has("STAFF", "USER", "ACCOUNT", "ROLE", "PASSWORD", "LOGIN")
    appointment_raw = _audit_action_has("APPOINTMENT", "FOLLOW_UP", "SCHEDULE")
    medical_raw = _audit_action_has("AI", "ANALYSIS", "DOCTOR", "PATIENT", "DIAGNOSIS", "REPORT")
    return {
        "Account Management": account_raw,
        "Appointments": and_(~account_raw, appointment_raw),
        "Medical Records": and_(~account_raw, ~appointment_raw, medical_raw),
        "System": and_(~account_raw, ~appointment_raw, ~medical_raw),
    }


def _audit_action_conditions():
    create_raw = _audit_action_has("CREATE", "PROMOTE", "REGISTER")
    status_raw = _audit_action_has("DEACTIVATE", "REACTIVATE", "INACTIVE", "STATUS", "CHANGE", "LOCK", "UNLOCK")
    update_raw = _audit_action_has("UPDATE", "EDIT", "REVIEW")
    danger_raw = _audit_action_has("DELETE", "REMOVE")
    return {
        "create": create_raw,
        "status": and_(~create_raw, status_raw),
        "update": and_(~create_raw, ~status_raw, update_raw),
        "danger": and_(~create_raw, ~status_raw, ~update_raw, danger_raw),
        "system": and_(~create_raw, ~status_raw, ~update_raw, ~danger_raw),
    }


def _audit_classification(action: str) -> tuple[str, str]:
    upper = (action or "").upper()
    if any(token in upper for token in ("STAFF", "USER", "ACCOUNT", "ROLE", "PASSWORD", "LOGIN")):
        module = "Account Management"
    elif any(token in upper for token in ("APPOINTMENT", "FOLLOW_UP", "SCHEDULE")):
        module = "Appointments"
    elif any(token in upper for token in ("AI", "ANALYSIS", "DOCTOR", "PATIENT", "DIAGNOSIS", "REPORT")):
        module = "Medical Records"
    else:
        module = "System"

    if any(token in upper for token in ("CREATE", "PROMOTE", "REGISTER")):
        action_type = "create"
    elif any(token in upper for token in ("DEACTIVATE", "REACTIVATE", "INACTIVE", "STATUS", "CHANGE", "LOCK", "UNLOCK")):
        action_type = "status"
    elif any(token in upper for token in ("UPDATE", "EDIT", "REVIEW")):
        action_type = "update"
    elif any(token in upper for token in ("DELETE", "REMOVE")):
        action_type = "danger"
    else:
        action_type = "system"
    return module, action_type


def _audit_summary(db: Session) -> dict[str, int]:
    modules = _audit_module_conditions()
    actions = _audit_action_conditions()
    return {
        "total": db.query(AuditLog).count(),
        "account": db.query(AuditLog).filter(modules["Account Management"]).count(),
        "appointment": db.query(AuditLog).filter(modules["Appointments"]).count(),
        "medical": db.query(AuditLog).filter(modules["Medical Records"]).count(),
        "system": db.query(AuditLog).filter(modules["System"]).count(),
        "status_changes": db.query(AuditLog).filter(actions["status"]).count(),
        "destructive": db.query(AuditLog).filter(actions["danger"]).count(),
    }


@router.get("/audit-logs/query")
def query_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    module: Optional[str] = Query(default=None, max_length=64),
    action_type: Optional[str] = Query(default=None, max_length=32),
    actor_role: Optional[str] = Query(default=None, max_length=32),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")

    actor = aliased(User)
    target = aliased(User)
    query = (
        db.query(AuditLog)
        .outerjoin(actor, actor.id == AuditLog.actor_id)
        .outerjoin(target, target.id == AuditLog.target_id)
    )

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(AuditLog.action, keyword),
                _contains(AuditLog.description, keyword),
                _contains(AuditLog.performed_by, keyword),
                _contains(AuditLog.target_type, keyword),
                _contains(AuditLog.target_record_id, keyword),
                _contains(actor.name, keyword),
                _contains(actor.email, keyword),
                _contains(target.name, keyword),
                _contains(target.email, keyword),
                cast(AuditLog.actor_id, String).ilike(f"%{keyword}%"),
                cast(AuditLog.target_id, String).ilike(f"%{keyword}%"),
            )
        )

    modules = _audit_module_conditions()
    module_value = _clean(module)
    if module_value and module_value.lower() != "all":
        if module_value not in modules:
            raise HTTPException(status_code=400, detail="Invalid audit module.")
        query = query.filter(modules[module_value])

    actions = _audit_action_conditions()
    action_value = _clean(action_type).lower()
    if action_value and action_value != "all":
        if action_value not in actions:
            raise HTTPException(status_code=400, detail="Invalid audit action type.")
        query = query.filter(actions[action_value])

    role_value = _clean(actor_role).lower()
    if role_value and role_value != "all":
        query = query.filter(func.lower(func.coalesce(AuditLog.actor_role, "system")) == role_value)

    if date_from:
        query = query.filter(func.date(AuditLog.created_at) >= date_from.isoformat())
    if date_to:
        query = query.filter(func.date(AuditLog.created_at) <= date_to.isoformat())

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    actor_ids = {item.actor_id for item in logs if item.actor_id is not None}
    target_ids = {item.target_id for item in logs if item.target_id is not None}
    user_ids = actor_ids | target_ids
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {item.id: item for item in users}

    items = []
    for log in logs:
        module_name, action_name = _audit_classification(log.action or "")
        actor_user = user_map.get(log.actor_id)
        target_user = user_map.get(log.target_id)
        items.append(
            {
                "id": log.id,
                "action": log.action,
                "description": log.description,
                "performed_by": log.performed_by,
                "actor_id": log.actor_id,
                "actor_name": actor_user.name if actor_user else log.performed_by,
                "actor_email": actor_user.email if actor_user else None,
                "actor_role": log.actor_role,
                "target_id": log.target_id,
                "target_name": target_user.name if target_user else None,
                "target_type": log.target_type,
                "target_record_id": log.target_record_id,
                "before_data": log.before_data,
                "after_data": log.after_data,
                "metadata_json": log.metadata_json,
                "module": module_name,
                "action_type": action_name,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _audit_summary(db),
        "items": items,
    }
