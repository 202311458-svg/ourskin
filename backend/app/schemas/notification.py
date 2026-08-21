from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recipient_id: int
    title: str
    message: str
    notification_type: str
    related_entity_type: str | None = None
    related_entity_id: str | None = None
    target_url: str | None = None
    is_read: bool
    created_at: datetime
    updated_at: datetime


class PaginatedNotifications(BaseModel):
    items: list[NotificationResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class UnreadNotificationCount(BaseModel):
    unread_count: int


class NotificationMutationResponse(BaseModel):
    message: str
    updated_count: int