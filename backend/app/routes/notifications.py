from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationMutationResponse,
    NotificationResponse,
    PaginatedNotifications,
    UnreadNotificationCount,
)
from app.schemas.pagination import get_total_pages


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=PaginatedNotifications)
def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_read: bool | None = None,
    notification_type: str | None = Query(None, max_length=80),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    if notification_type:
        query = query.filter(Notification.notification_type == notification_type.strip().lower())

    total = query.count()
    items = (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": get_total_pages(total, page_size),
    }


@router.get("/unread-count", response_model=UnreadNotificationCount)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread_count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )
    return {"unread_count": unread_count}


@router.patch("/read-all", response_model=NotificationMutationResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications marked as read", "updated_count": updated_count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)

    return notification