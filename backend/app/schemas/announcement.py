from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    message: str = Field(..., min_length=5)

    category: str = "Clinic Notice"
    priority: str = "Normal"
    status: str = "Draft"

    is_pinned: bool = False

    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    message: Optional[str] = Field(None, min_length=5)

    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    is_pinned: Optional[bool] = None

    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AnnouncementResponse(AnnouncementBase):
    id: UUID

    created_by: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True