from datetime import datetime, timedelta, timezone
import hashlib
import re

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, event, inspect
from sqlalchemy.orm import validates
from sqlalchemy.sql import func

from app.core.config import settings
from app.db import Base


def _hash_verification_token(token: str) -> str:
    token_value = f"{settings.secret_key.get_secret_value()}:{token}"
    return hashlib.sha256(token_value.encode("utf-8")).hexdigest()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Keep this because existing pages still use user.name.
    name = Column(String, nullable=False)

    # New structured name fields for registration.
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    google_sub = Column(String(255), unique=True, index=True, nullable=True)
    contact = Column(String, nullable=True)

    role = Column(String, default="patient", nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Authentication security state.
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    login_locked_until = Column(DateTime(timezone=True), nullable=True)
    auth_invalid_before = Column(DateTime(timezone=True), nullable=True)

    # Patient age support.
    date_of_birth = Column(Date, nullable=True)
    is_minor = Column(Boolean, default=False, nullable=False)
    address = Column(Text, nullable=True)

    # Guardian details for minor patients.
    guardian_first_name = Column(String, nullable=True)
    guardian_last_name = Column(String, nullable=True)
    guardian_relationship = Column(String, nullable=True)
    guardian_contact = Column(String, nullable=True)
    guardian_email = Column(String, nullable=True)
    guardian_consent = Column(Boolean, default=False, nullable=False)
    guardian_consent_at = Column(DateTime(timezone=True), nullable=True)

    terms_accepted = Column(Boolean, default=False, nullable=False)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)

    privacy_accepted = Column(Boolean, default=False, nullable=False)
    privacy_accepted_at = Column(DateTime(timezone=True), nullable=True)

    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_requested_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    status = Column(String, default="Active", nullable=False)
    department = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)

    specialty = Column(String, nullable=True)
    availability = Column(String, nullable=True)
    bio = Column(String, nullable=True)

    @validates("verification_token")
    def protect_verification_token(self, _key: str, value: str | None):
        if not value:
            self.verification_token_expires = None
            return value

        # New verification links are stored as keyed hashes. A 64-character
        # hexadecimal value is already protected and should not be re-hashed.
        if re.fullmatch(r"[0-9a-f]{64}", value):
            return value

        self.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
        return _hash_verification_token(value)


@event.listens_for(User, "before_update")
def invalidate_sessions_after_password_change(_mapper, _connection, target: User):
    state = inspect(target)
    if state.attrs.password_hash.history.has_changes():
        target.auth_invalid_before = datetime.now(timezone.utc)


@event.listens_for(User, "after_update")
def audit_security_state_changes(_mapper, connection, target: User):
    """Record security-sensitive user changes in the central audit trail.

    These inserts share the caller's database transaction. No password hashes,
    verification tokens, reset tokens, or credentials are written to audit
    metadata.
    """

    state = inspect(target)
    events: list[tuple[str, str]] = []

    if state.attrs.password_hash.history.has_changes():
        events.append(("PASSWORD_CHANGED", "Password changed; prior sessions invalidated"))

    if state.attrs.is_verified.history.has_changes() and target.is_verified:
        events.append(("EMAIL_VERIFIED", "Email address verified"))

    if state.attrs.login_locked_until.history.has_changes():
        if target.login_locked_until is not None:
            events.append(("ACCOUNT_LOGIN_LOCKED", "Account temporarily locked after failed login attempts"))
        else:
            events.append(("ACCOUNT_LOGIN_UNLOCKED", "Temporary login lock cleared"))

    if not events:
        return

    from app.models.audit_log import AuditLog

    actor_name = target.name or target.email or f"User #{target.id}"
    for action, description in events:
        connection.execute(
            AuditLog.__table__.insert().values(
                action=action,
                description=description,
                performed_by=actor_name,
                actor_id=target.id,
                actor_role=target.role,
                target_id=target.id,
                target_type="user",
                target_record_id=str(target.id),
                metadata_json={"security_event": True},
            )
        )
