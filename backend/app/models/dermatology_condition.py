from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base


class DermatologyCondition(Base):
    __tablename__ = "dermatology_conditions"
    __table_args__ = (
        CheckConstraint(
            "support_level IN ('SUPPORTED', 'LIMITED', 'FLAG_ONLY')",
            name="ck_dermatology_conditions_support_level",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), nullable=False, unique=True, index=True)
    display_name = Column(String(160), nullable=False)
    category = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    support_level = Column(String(32), nullable=False)
    image_assessment_supported = Column(Boolean, nullable=False, default=True)
    severity_assessment_supported = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
