from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def _validate_target_url(target_url: str | None) -> str | None:
    if target_url is None:
        return None

    cleaned = target_url.strip()
    if not cleaned:
        return None

    if not cleaned.startswith("/pages/") or cleaned.startswith("//"):
        raise ValueError("Notification target_url must be an internal portal route")

    return cleaned


def create_notification(
    db: Session,
    *,
    recipient_id: int,
    title: str,
    message: str,
    notification_type: str,
    related_entity_type: str | None = None,
    related_entity_id: int | str | None = None,
    target_url: str | None = None,
) -> Notification:
    """Add a notification to the caller's transaction without committing it."""
    notification = Notification(
        recipient_id=recipient_id,
        title=title.strip(),
        message=message.strip(),
        notification_type=notification_type.strip().lower(),
        related_entity_type=(related_entity_type or "").strip() or None,
        related_entity_id=(str(related_entity_id) if related_entity_id is not None else None),
        target_url=_validate_target_url(target_url),
    )
    db.add(notification)
    return notification


def create_notifications_for_recipients(
    db: Session,
    *,
    recipient_ids: Iterable[int],
    title: str,
    message: str,
    notification_type: str,
    related_entity_type: str | None = None,
    related_entity_id: int | str | None = None,
    target_url_by_recipient: dict[int, str] | None = None,
) -> list[Notification]:
    notifications: list[Notification] = []
    for recipient_id in set(recipient_ids):
        notifications.append(
            create_notification(
                db,
                recipient_id=recipient_id,
                title=title,
                message=message,
                notification_type=notification_type,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                target_url=(target_url_by_recipient or {}).get(recipient_id),
            )
        )
    return notifications


def get_active_user_ids_by_roles(db: Session, roles: Iterable[str]) -> list[int]:
    normalized_roles = {role.strip().lower() for role in roles if role.strip()}
    if not normalized_roles:
        return []

    return [
        user_id
        for (user_id,) in (
            db.query(User.id)
            .filter(User.role.in_(normalized_roles), User.status == "Active")
            .all()
        )
    ]