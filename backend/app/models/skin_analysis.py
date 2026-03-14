from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db import Base


class SkinAnalysis(Base):

    __tablename__ = "skin_analysis"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))

    image_path = Column(String)

    condition = Column(String)

    confidence = Column(Float)

    severity = Column(String)

    recommendation = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())