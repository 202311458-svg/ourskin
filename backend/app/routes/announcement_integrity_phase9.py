from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.announcement import Announcement
from app.models.user import User
from app.routes.announcements import (
    clean_string,
    require_staff_or_admin,
    validate_announcement_dates,
    validate_announcement_fields,
)
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.services.audit_service import stage_action
from app.services.notification_service import (
    create_notifications_for_recipients,
    get_active_user_ids_by_roles,
)

router = APIRouter(prefix="/announcements", tags=["Announcement Integrity Phase 9"])


def _snapshot(item: Announcement) -> dict:
    return {
        "title": item.title,
        "message": item.message,
        "category": item.category,
        "priority": item.priority,
        "status": item.status,
        "is_pinned": item.is_pinned,
        "starts_at": item.starts_at.isoformat() if item.starts_at else None,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
    }


def _notify_patients(db: Session, announcement: Announcement) -> int:
    patient_ids = get_active_user_ids_by_roles(db, ["patient"])
    if not patient_ids:
        return 0

    create_notifications_for_recipients(
        db,
        recipient_ids=patient_ids,
        title="New clinic announcement",
        message=announcement.title.strip(),
        notification_type="clinic_announcement",
        related_entity_type="announcement",
        related_entity_id=announcement.id,
        target_url_by_recipient={
            patient_id: "/pages/patient/announcements"
            for patient_id in patient_ids
        },
    )
    return len(set(patient_ids))


def _stage_announcement_audit(
    db: Session,
    *,
    action: str,
    description: str,
    current_user: User,
    announcement: Announcement,
    before_data: dict | None,
    after_data: dict | None,
    metadata_json: dict | None = None,
) -> None:
    stage_action(
        db=db,
        action=action,
        description=description,
        actor_id=current_user.id,
        actor_role=current_user.role,
        performed_by=current_user.name or current_user.email or f"User #{current_user.id}",
        target_type="announcement",
        target_record_id=announcement.id,
        before_data=before_data,
        after_data=after_data,
        metadata_json=metadata_json,
    )


def _commit(db: Session, announcement: Announcement | None = None) -> None:
    try:
        db.commit()
        if announcement is not None:
            db.refresh(announcement)
    except Exception:
        db.rollback()
        raise


@router.post("/", response_model=AnnouncementResponse)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    title = payload.title.strip()
    message = payload.message.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Announcement title is required.")
    if not message:
        raise HTTPException(status_code=400, detail="Announcement message is required.")

    validate_announcement_fields(payload.category, payload.priority, payload.status)
    validate_announcement_dates(payload.starts_at, payload.expires_at)

    announcement = Announcement(
        title=title,
        message=message,
        category=payload.category,
        priority=payload.priority,
        status=payload.status,
        is_pinned=payload.is_pinned,
        starts_at=payload.starts_at,
        expires_at=payload.expires_at,
        created_by=current_user.id,
        created_by_name=current_user.name or current_user.email,
        created_by_role=current_user.role,
    )
    db.add(announcement)
    db.flush()

    notified = 0
    if announcement.status == "Published":
        notified = _notify_patients(db, announcement)

    _stage_announcement_audit(
        db,
        action="CREATE_ANNOUNCEMENT",
        description=f"Created clinic announcement {announcement.title}",
        current_user=current_user,
        announcement=announcement,
        before_data=None,
        after_data=_snapshot(announcement),
        metadata_json={
            "patient_notifications_created": notified,
            "published": announcement.status == "Published",
        },
    )
    _commit(db, announcement)
    return announcement


@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .with_for_update()
        .first()
    )
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    before = _snapshot(announcement)
    was_published = announcement.status == "Published"
    update_data = payload.model_dump(exclude_unset=True)

    category = update_data.get("category", announcement.category)
    priority = update_data.get("priority", announcement.priority)
    status = update_data.get("status", announcement.status)
    validate_announcement_fields(category, priority, status)

    starts_at = update_data.get("starts_at", announcement.starts_at)
    expires_at = update_data.get("expires_at", announcement.expires_at)
    validate_announcement_dates(starts_at, expires_at)

    for key, value in update_data.items():
        value = clean_string(value)
        if key in {"title", "message"} and not value:
            raise HTTPException(
                status_code=400,
                detail=f"Announcement {key} cannot be empty.",
            )
        setattr(announcement, key, value)

    notified = 0
    became_published = not was_published and announcement.status == "Published"
    if became_published:
        notified = _notify_patients(db, announcement)

    after = _snapshot(announcement)
    if before == after:
        return announcement

    _stage_announcement_audit(
        db,
        action="UPDATE_ANNOUNCEMENT",
        description=f"Updated clinic announcement {announcement.title}",
        current_user=current_user,
        announcement=announcement,
        before_data=before,
        after_data=after,
        metadata_json={
            "published_transition": became_published,
            "patient_notifications_created": notified,
        },
    )
    _commit(db, announcement)
    return announcement


@router.patch("/{announcement_id}/archive", response_model=AnnouncementResponse)
def archive_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .with_for_update()
        .first()
    )
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    if announcement.status == "Archived":
        return announcement

    before = _snapshot(announcement)
    announcement.status = "Archived"
    after = _snapshot(announcement)
    _stage_announcement_audit(
        db,
        action="ARCHIVE_ANNOUNCEMENT",
        description=f"Archived clinic announcement {announcement.title}",
        current_user=current_user,
        announcement=announcement,
        before_data=before,
        after_data=after,
    )
    _commit(db, announcement)
    return announcement


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .with_for_update()
        .first()
    )
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    before = _snapshot(announcement)
    _stage_announcement_audit(
        db,
        action="DELETE_ANNOUNCEMENT",
        description=f"Deleted clinic announcement {announcement.title}",
        current_user=current_user,
        announcement=announcement,
        before_data=before,
        after_data=None,
    )
    db.delete(announcement)
    _commit(db)
    return {"message": "Announcement deleted successfully."}
