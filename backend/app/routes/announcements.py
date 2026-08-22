from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.services.notification_service import (
    create_notifications_for_recipients,
    get_active_user_ids_by_roles,
)


router = APIRouter(prefix="/announcements", tags=["Announcements"])


VALID_CATEGORIES = {
    "Clinic Notice",
    "Service Update",
    "Promo",
    "Health Advisory",
    "Appointment Reminder",
}

VALID_PRIORITIES = {"Normal", "Important", "Urgent"}

VALID_STATUSES = {"Draft", "Published", "Archived"}


def require_staff_or_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Staff or admin access only.",
        )

    return current_user


def validate_announcement_fields(category: str, priority: str, status: str):
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail="Invalid announcement category.",
        )

    if priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail="Invalid announcement priority.",
        )

    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid announcement status.",
        )


def validate_announcement_dates(starts_at, expires_at):
    if starts_at and expires_at and expires_at <= starts_at:
        raise HTTPException(
            status_code=400,
            detail="Expiry date must be later than the start date.",
        )


def clean_string(value):
    if isinstance(value, str):
        return value.strip()

    return value


def notify_patients_of_announcement(db: Session, announcement: Announcement):
    patient_ids = get_active_user_ids_by_roles(db, ["patient"])
    if not patient_ids:
        return

    target_url = "/pages/patient/announcements"
    target_urls = {patient_id: target_url for patient_id in patient_ids}
    message = announcement.title.strip()

    create_notifications_for_recipients(
        db,
        recipient_ids=patient_ids,
        title="New clinic announcement",
        message=message,
        notification_type="clinic_announcement",
        related_entity_type="announcement",
        related_entity_id=announcement.id,
        target_url_by_recipient=target_urls,
    )


@router.get("/", response_model=List[AnnouncementResponse])
def get_announcements(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    query = db.query(Announcement)

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid announcement status.",
            )

        query = query.filter(Announcement.status == status)

    announcements = (
        query.order_by(
            Announcement.is_pinned.desc(),
            Announcement.created_at.desc(),
        )
        .all()
    )

    return announcements


@router.get("/patient-visible", response_model=List[AnnouncementResponse])
def get_patient_visible_announcements(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    announcements = (
        db.query(Announcement)
        .filter(Announcement.status == "Published")
        .filter(
            or_(
                Announcement.starts_at == None,
                Announcement.starts_at <= now,
            )
        )
        .filter(
            or_(
                Announcement.expires_at == None,
                Announcement.expires_at >= now,
            )
        )
        .order_by(
            Announcement.is_pinned.desc(),
            Announcement.priority.desc(),
            Announcement.created_at.desc(),
        )
        .all()
    )

    return announcements


@router.post("/", response_model=AnnouncementResponse)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    title = payload.title.strip()
    message = payload.message.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Announcement title is required.",
        )

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Announcement message is required.",
        )

    validate_announcement_fields(
        payload.category,
        payload.priority,
        payload.status,
    )

    validate_announcement_dates(
        payload.starts_at,
        payload.expires_at,
    )

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

    if announcement.status == "Published":
        notify_patients_of_announcement(db, announcement)

    db.commit()
    db.refresh(announcement)

    return announcement


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if not announcement:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

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
        .first()
    )

    if not announcement:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

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

        if key in ["title", "message"] and not value:
            raise HTTPException(
                status_code=400,
                detail=f"Announcement {key} cannot be empty.",
            )

        setattr(announcement, key, value)

    if not was_published and announcement.status == "Published":
        notify_patients_of_announcement(db, announcement)

    db.commit()
    db.refresh(announcement)

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
        .first()
    )

    if not announcement:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

    announcement.status = "Archived"

    db.commit()
    db.refresh(announcement)

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
        .first()
    )

    if not announcement:
        raise HTTPException(
            status_code=404,
            detail="Announcement not found.",
        )

    db.delete(announcement)
    db.commit()

    return {
        "message": "Announcement deleted successfully.",
    }
