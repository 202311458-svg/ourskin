from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def log_action(
    db: Session,
    action: str,
    description: str,
    actor_id: int | None = None,
    target_id: int | None = None,
    performed_by: str | None = None,
):
    if not performed_by:
        performed_by = "System"

        if actor_id:
            actor = db.query(User).filter(User.id == actor_id).first()

            if actor:
                performed_by = actor.name or actor.email or f"User #{actor_id}"
            else:
                performed_by = f"User #{actor_id}"

    log = AuditLog(
        action=action,
        description=description,
        performed_by=performed_by,
        actor_id=actor_id,
        target_id=target_id,
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log