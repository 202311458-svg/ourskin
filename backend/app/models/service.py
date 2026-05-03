from sqlalchemy import Boolean, Column, DateTime, Integer, Text
from sqlalchemy.sql import func

from app.db import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(Text, nullable=False, unique=True)

    description = Column(Text, nullable=True)

    requires_initial_evaluation = Column(Boolean, default=False, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())