from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.db import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    action = Column(String, nullable=False)
    description = Column(String, nullable=True)

    performed_by = Column(String, nullable=False, default="System")

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)