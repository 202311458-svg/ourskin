from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func

from app.db import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    action = Column(String, nullable=False)
    description = Column(String, nullable=True)

    performed_by = Column(String, nullable=False, default="System")

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String, nullable=True)

    # Legacy field. Keep this for old user-related logs.
    target_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # New flexible audit target fields.
    # Example:
    # target_type = "appointment"
    # target_record_id = "15"
    target_type = Column(String, nullable=True)
    target_record_id = Column(String, nullable=True)

    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)