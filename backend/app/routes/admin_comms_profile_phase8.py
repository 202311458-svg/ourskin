from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.announcement import Announcement
from app.models.notification import Notification
from app.models.user import User
from app.routes.admin import require_admin, validate_pagination
from app.schemas.pagination import get_total_pages
from app.services.audit_service import stage_action

router = APIRouter(prefix="/admin", tags=["Admin Communications & Profile"])

VALID_ANNOUNCEMENT_STATUSES = {"Draft", "Published", "Archived"}
VALID_VISIBILITY = {"all", "visible", "scheduled", "expired"}
VALID_READ_STATES = {"all", "read", "unread"}


class AdminProfileUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _aware(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _announcement_visibility(item: Announcement, now: datetime) -> str:
    if item.status != "Published":
        return "not_visible"
    starts_at = _aware(item.starts_at)
    expires_at = _aware(item.expires_at)
    if starts_at and starts_at > now:
        return "scheduled"
    if expires_at and expires_at < now:
        return "expired"
    return "visible"


def _serialize_announcement(item: Announcement, now: datetime) -> dict:
    return {
        "id": str(item.id),
        "title": item.title,
        "message": item.message,
        "category": item.category,
        "priority": item.priority,
        "status": item.status,
        "is_pinned": item.is_pinned,
        "starts_at": item.starts_at.isoformat() if item.starts_at else None,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "created_by": item.created_by,
        "created_by_name": item.created_by_name,
        "created_by_role": item.created_by_role,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "patient_visibility": _announcement_visibility(item, now),
    }


def _announcement_summary(db: Session, now: datetime) -> dict[str, int]:
    published = Announcement.status == "Published"
    visible_now = and_(
        published,
        or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
        or_(Announcement.expires_at.is_(None), Announcement.expires_at >= now),
    )
    scheduled = and_(published, Announcement.starts_at.isnot(None), Announcement.starts_at > now)
    expired = and_(published, Announcement.expires_at.isnot(None), Announcement.expires_at < now)
    return {
        "total": db.query(Announcement).count(),
        "draft": db.query(Announcement).filter(Announcement.status == "Draft").count(),
        "published": db.query(Announcement).filter(published).count(),
        "archived": db.query(Announcement).filter(Announcement.status == "Archived").count(),
        "visible_now": db.query(Announcement).filter(visible_now).count(),
        "scheduled": db.query(Announcement).filter(scheduled).count(),
        "expired": db.query(Announcement).filter(expired).count(),
        "pinned": db.query(Announcement).filter(Announcement.is_pinned.is_(True)).count(),
    }


@router.get("/announcements/query")
def query_admin_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    status: Optional[str] = Query(default=None, max_length=32),
    category: Optional[str] = Query(default=None, max_length=80),
    priority: Optional[str] = Query(default=None, max_length=32),
    visibility: str = Query("all", max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    now = datetime.now(timezone.utc)
    query = db.query(Announcement)

    keyword = _clean(search)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(
            or_(
                Announcement.title.ilike(pattern),
                Announcement.message.ilike(pattern),
                Announcement.category.ilike(pattern),
                Announcement.priority.ilike(pattern),
                Announcement.created_by_name.ilike(pattern),
            )
        )

    status_value = _clean(status)
    if status_value and status_value.lower() != "all":
        if status_value not in VALID_ANNOUNCEMENT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid announcement status.")
        query = query.filter(Announcement.status == status_value)

    category_value = _clean(category)
    if category_value and category_value.lower() != "all":
        query = query.filter(Announcement.category == category_value)

    priority_value = _clean(priority)
    if priority_value and priority_value.lower() != "all":
        query = query.filter(Announcement.priority == priority_value)

    visibility_value = _clean(visibility).lower() or "all"
    if visibility_value not in VALID_VISIBILITY:
        raise HTTPException(status_code=400, detail="Invalid visibility filter.")
    if visibility_value == "visible":
        query = query.filter(
            Announcement.status == "Published",
            or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
            or_(Announcement.expires_at.is_(None), Announcement.expires_at >= now),
        )
    elif visibility_value == "scheduled":
        query = query.filter(
            Announcement.status == "Published",
            Announcement.starts_at.isnot(None),
            Announcement.starts_at > now,
        )
    elif visibility_value == "expired":
        query = query.filter(
            Announcement.status == "Published",
            Announcement.expires_at.isnot(None),
            Announcement.expires_at < now,
        )

    total = query.count()
    items = (
        query.order_by(
            Announcement.is_pinned.desc(),
            Announcement.created_at.desc(),
            Announcement.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _announcement_summary(db, now),
        "items": [_serialize_announcement(item, now) for item in items],
    }


def _serialize_notification(item: Notification) -> dict:
    return {
        "id": item.id,
        "recipient_id": item.recipient_id,
        "title": item.title,
        "message": item.message,
        "notification_type": item.notification_type,
        "related_entity_type": item.related_entity_type,
        "related_entity_id": item.related_entity_id,
        "target_url": item.target_url,
        "is_read": item.is_read,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _notification_summary(db: Session, recipient_id: int) -> dict:
    base = db.query(Notification).filter(Notification.recipient_id == recipient_id)
    type_counts = {
        notification_type: int(count)
        for notification_type, count in (
            db.query(Notification.notification_type, func.count(Notification.id))
            .filter(Notification.recipient_id == recipient_id)
            .group_by(Notification.notification_type)
            .all()
        )
    }
    total = base.count()
    unread = base.filter(Notification.is_read.is_(False)).count()
    return {
        "total": total,
        "unread": unread,
        "read": total - unread,
        "type_counts": dict(sorted(type_counts.items())),
    }


@router.get("/notifications/query")
def query_admin_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    read_state: str = Query("all", max_length=16),
    notification_type: Optional[str] = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)

    keyword = _clean(search)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(
            or_(
                Notification.title.ilike(pattern),
                Notification.message.ilike(pattern),
                Notification.notification_type.ilike(pattern),
                Notification.related_entity_type.ilike(pattern),
                Notification.related_entity_id.ilike(pattern),
            )
        )

    read_value = _clean(read_state).lower() or "all"
    if read_value not in VALID_READ_STATES:
        raise HTTPException(status_code=400, detail="Invalid notification read filter.")
    if read_value == "read":
        query = query.filter(Notification.is_read.is_(True))
    elif read_value == "unread":
        query = query.filter(Notification.is_read.is_(False))

    type_value = _clean(notification_type).lower()
    if type_value and type_value != "all":
        query = query.filter(func.lower(Notification.notification_type) == type_value)

    total = query.count()
    items = (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _notification_summary(db, current_user.id),
        "items": [_serialize_notification(item) for item in items],
    }


def _serialize_profile(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "contact": user.contact,
        "role": user.role,
        "status": user.status,
        "department": user.department,
        "profile_image": user.profile_image,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/profile")
def get_admin_profile(current_user: User = Depends(require_admin)):
    return _serialize_profile(current_user)


@router.put("/profile")
def update_admin_profile(
    payload: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    updates = payload.model_dump(exclude_unset=True)
    before = {
        "name": current_user.name,
        "contact": current_user.contact,
        "profile_image": current_user.profile_image,
    }

    if "name" in updates:
        cleaned_name = _clean(updates["name"])
        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Name is required.")
        current_user.name = cleaned_name
    if "contact" in updates:
        current_user.contact = _clean(updates["contact"]) or None
    if "profile_image" in updates:
        current_user.profile_image = _clean(updates["profile_image"]) or None

    after = {
        "name": current_user.name,
        "contact": current_user.contact,
        "profile_image": current_user.profile_image,
    }
    if before == after:
        return {"message": "No profile changes to save.", "user": _serialize_profile(current_user)}

    stage_action(
        db=db,
        action="UPDATE_ADMIN_PROFILE",
        description=f"Updated administrator profile for {current_user.name}",
        actor_id=current_user.id,
        actor_role=current_user.role,
        performed_by=current_user.name or current_user.email,
        target_id=current_user.id,
        target_type="user",
        target_record_id=current_user.id,
        before_data=before,
        after_data=after,
        metadata_json={"self_service": True},
    )
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated successfully.", "user": _serialize_profile(current_user)}
