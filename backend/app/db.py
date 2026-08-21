from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

from app.models.audit_log import AuditLog
from app.models.announcement import Announcement
from app.models.notification import Notification

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()