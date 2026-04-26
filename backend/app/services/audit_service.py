from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user import User

def log_action(db: Session, action: str, description: str, actor_id: int, target_id: int = None):
    log = AuditLog(
        action=action,
        description=description,
        actor_id=actor_id,
        target_id=target_id
    )
    db.add(log)
    db.commit()