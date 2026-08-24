from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base


class AIImageAsset(Base):
    __tablename__ = "ai_image_assets"
    __table_args__ = (
        CheckConstraint(
            "capture_view IS NULL OR capture_view IN ('FRONT', 'LEFT', 'RIGHT', 'CLOSE_UP', 'OTHER', 'UNSPECIFIED')",
            name="ck_ai_image_assets_capture_view",
        ),
    )

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
    capture_view = Column(String(24), nullable=True, index=True)
    sanitized = Column(Boolean, nullable=False, default=True)
    metadata_stripped = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
