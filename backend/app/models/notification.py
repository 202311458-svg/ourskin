from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index(
            "ix_notifications_recipient_read_created",
            "recipient_id",
            "is_read",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(80), nullable=False, default="general", index=True)
    related_entity_type = Column(String(80), nullable=True)
    related_entity_id = Column(String(120), nullable=True)
    target_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )