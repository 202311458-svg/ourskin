from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.db import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String)          
    description = Column(String)
    actor_id = Column(Integer, ForeignKey("users.id"))  
    target_id = Column(Integer, ForeignKey("users.id")) 

    created_at = Column(DateTime, default=datetime.utcnow)