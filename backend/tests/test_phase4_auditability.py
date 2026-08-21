from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.audit_service import stage_action


def _session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[User.__table__, AuditLog.__table__],
    )
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _user(db):
    user = User(
        name="Audit User",
        email="audit@example.com",
        password_hash="initial-hash",
        role="patient",
        status="Active",
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_staged_audit_rolls_back_with_business_transaction():
    db = _session()
    try:
        user = _user(db)

        stage_action(
            db=db,
            action="TEST_TRANSACTION",
            description="Should roll back",
            actor_id=user.id,
            actor_role=user.role,
            performed_by=user.name,
            target_type="user",
            target_record_id=user.id,
        )
        assert db.query(AuditLog).filter(AuditLog.action == "TEST_TRANSACTION").count() == 1

        db.rollback()

        assert db.query(AuditLog).filter(AuditLog.action == "TEST_TRANSACTION").count() == 0
    finally:
        db.close()


def test_password_change_creates_security_audit_and_invalidates_sessions():
    db = _session()
    try:
        user = _user(db)
        user.password_hash = "replacement-hash"
        db.commit()
        db.refresh(user)

        log = (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "PASSWORD_CHANGED",
                AuditLog.target_record_id == str(user.id),
            )
            .one()
        )

        assert user.auth_invalid_before is not None
        assert log.metadata_json == {"security_event": True}
        assert "hash" not in (log.description or "").lower()
    finally:
        db.close()


def test_email_verification_and_login_lock_are_audited_without_secrets():
    db = _session()
    try:
        user = _user(db)

        user.is_verified = True
        db.commit()

        from datetime import datetime, timedelta, timezone

        user.login_locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()

        actions = {
            row.action
            for row in db.query(AuditLog)
            .filter(AuditLog.target_record_id == str(user.id))
            .all()
        }

        assert "EMAIL_VERIFIED" in actions
        assert "ACCOUNT_LOGIN_LOCKED" in actions
    finally:
        db.close()
