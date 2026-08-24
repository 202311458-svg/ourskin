from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base


class AIImageAsset(Base):
    __tablename__ = "ai_image_assets"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    storage_path = Column(Text, nullable=False, unique=True)
    content_type = Column(String(64), nullable=False)
    source_format = Column(String(16), nullable=False)
    original_extension = Column(String(8), nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    sanitized = Column(Boolean, nullable=False, default=True)
    metadata_stripped = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
