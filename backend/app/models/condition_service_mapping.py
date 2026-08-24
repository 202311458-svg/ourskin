from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db import Base


class ConditionServiceMapping(Base):
    __tablename__ = "condition_service_mappings"
    __table_args__ = (
        UniqueConstraint(
            "condition_id",
            "service_id",
            "relationship_type",
            name="uq_condition_service_relationship",
        ),
        CheckConstraint(
            "relationship_type IN ('PRIMARY', 'SECONDARY', 'REVIEW_ONLY')",
            name="ck_condition_service_relationship_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    condition_id = Column(
        Integer,
        ForeignKey("dermatology_conditions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_id = Column(
        Integer,
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type = Column(String(32), nullable=False)
    priority = Column(Integer, nullable=False, default=100)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
