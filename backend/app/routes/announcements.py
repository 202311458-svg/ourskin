from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db import get_db
from app.models.announcement import Announcement
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
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


def validate_announcement_fields(category: str, priority: str, status: str):
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid announcement category.")

    if priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid announcement priority.")

    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid announcement status.")


@router.get("/", response_model=List[AnnouncementResponse])
def get_announcements(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Announcement)

    if status:
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
):
    validate_announcement_fields(
        payload.category,
        payload.priority,
        payload.status,
    )

    if payload.starts_at and payload.expires_at:
        if payload.expires_at <= payload.starts_at:
            raise HTTPException(
                status_code=400,
                detail="Expiry date must be later than the start date.",
            )

    announcement = Announcement(
        title=payload.title.strip(),
        message=payload.message.strip(),
        category=payload.category,
        priority=payload.priority,
        status=payload.status,
        is_pinned=payload.is_pinned,
        starts_at=payload.starts_at,
        expires_at=payload.expires_at,

        created_by=None,
        created_by_name="Clinic Team",
        created_by_role="Staff",
    )

    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    return announcement


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    return announcement


@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    update_data = payload.model_dump(exclude_unset=True)

    category = update_data.get("category", announcement.category)
    priority = update_data.get("priority", announcement.priority)
    status = update_data.get("status", announcement.status)

    validate_announcement_fields(category, priority, status)

    starts_at = update_data.get("starts_at", announcement.starts_at)
    expires_at = update_data.get("expires_at", announcement.expires_at)

    if starts_at and expires_at and expires_at <= starts_at:
        raise HTTPException(
            status_code=400,
            detail="Expiry date must be later than the start date.",
        )

    for key, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()

        setattr(announcement, key, value)

    db.commit()
    db.refresh(announcement)

    return announcement


@router.patch("/{announcement_id}/archive", response_model=AnnouncementResponse)
def archive_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    announcement.status = "Archived"

    db.commit()
    db.refresh(announcement)

    return announcement


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
):
    announcement = (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )

    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    db.delete(announcement)
    db.commit()

    return {"message": "Announcement deleted successfully."}