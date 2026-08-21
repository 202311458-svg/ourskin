from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    description: Optional[str] = None,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    performed_by: str = "System",
    target_type: Optional[str] = None,
    target_record_id: Optional[Any] = None,
    target_id: Optional[int] = None,
    before_data: Optional[dict] = None,
    after_data: Optional[dict] = None,
    metadata_json: Optional[dict] = None,
    *,
    commit: bool = True,
):
    """Create a centralized audit record.

    ``commit=True`` preserves the legacy admin-call behaviour. New business
    flows should use ``commit=False`` (or :func:`stage_action`) so the audit
    record is committed or rolled back atomically with the state change it
    describes.

    Use ``target_type`` and ``target_record_id`` for new logs. ``target_id`` is
    kept only for older user-related logs.
    """

    log = AuditLog(
        action=action,
        description=description,
        actor_id=actor_id,
        actor_role=actor_role,
        performed_by=performed_by,
        target_id=target_id,
        target_type=target_type,
        target_record_id=(
            str(target_record_id) if target_record_id is not None else None
        ),
        before_data=before_data,
        after_data=after_data,
        metadata_json=metadata_json,
    )

    db.add(log)

    if commit:
        db.commit()
        db.refresh(log)
    else:
        # Allocate the primary key and surface database errors without ending
        # the caller's transaction. The caller remains responsible for commit.
        db.flush()

    return log


def stage_action(
    db: Session,
    action: str,
    description: Optional[str] = None,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    performed_by: str = "System",
    target_type: Optional[str] = None,
    target_record_id: Optional[Any] = None,
    target_id: Optional[int] = None,
    before_data: Optional[dict] = None,
    after_data: Optional[dict] = None,
    metadata_json: Optional[dict] = None,
):
    """Stage an audit row in the caller's current database transaction."""

    return log_action(
        db=db,
        action=action,
        description=description,
        actor_id=actor_id,
        actor_role=actor_role,
        performed_by=performed_by,
        target_type=target_type,
        target_record_id=target_record_id,
        target_id=target_id,
        before_data=before_data,
        after_data=after_data,
        metadata_json=metadata_json,
        commit=False,
    )
