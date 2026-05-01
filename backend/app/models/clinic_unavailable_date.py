from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func

from app.db import Base


class ClinicUnavailableDate(Base):
    __tablename__ = "clinic_unavailable_dates"

    id = Column(Integer, primary_key=True, index=True)

    closure_date = Column(Date, nullable=False, unique=True, index=True)

    reason = Column(Text, nullable=False)

    note = Column(Text, nullable=True)

    created_by_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())