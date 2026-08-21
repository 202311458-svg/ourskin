from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.models.user import User
from app.routes import auth_phase2


def _phase2_client(session_factory):
    app = FastAPI()
    app.include_router(auth_phase2.router)

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[auth_phase2.get_db] = override_db
    return TestClient(app)


def test_login_locks_account_after_repeated_bad_passwords(clinical_api):
    session_factory = clinical_api["session_factory"]

    with session_factory() as db:
        user = db.query(User).filter(User.id == clinical_api["ids"]["staff"]).first()
        user.password_hash = hash_password("CorrectPass1!")
        user.failed_login_attempts = 0
        user.login_locked_until = None
        db.commit()
        email = user.email

    with _phase2_client(session_factory) as client:
        for _ in range(auth_phase2.MAX_FAILED_LOGIN_ATTEMPTS):
            response = client.post(
                "/auth/login",
                data={"username": email, "password": "WrongPass1!"},
            )
            assert response.status_code == 401

        locked = client.post(
            "/auth/login",
            data={"username": email, "password": "CorrectPass1!"},
        )

    assert locked.status_code == 429
    assert "Retry-After" in locked.headers


def test_verification_token_is_hashed_and_expires(clinical_api):
    session_factory = clinical_api["session_factory"]
    raw_token = "phase-two-verification-token"

    with session_factory() as db:
        user = User(
            name="Verification Patient",
            email="verify.phase2@example.test",
            password_hash=hash_password("StrongPass1!"),
            role="patient",
            status="Active",
            is_verified=False,
            verification_token=raw_token,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.verification_token != raw_token
        assert user.verification_token_expires is not None

    with _phase2_client(session_factory) as client:
        response = client.get("/auth/verify-email", params={"token": raw_token})

    assert response.status_code == 200

    with session_factory() as db:
        user = db.query(User).filter(User.email == "verify.phase2@example.test").first()
        assert user.is_verified is True
        assert user.verification_token is None
        assert user.verification_token_expires is None


def test_password_change_invalidates_preexisting_access_token(clinical_api):
    session_factory = clinical_api["session_factory"]
    token = clinical_api["tokens"]["doctor_a"]

    before = clinical_api["client"].get(
        "/doctor/appointments",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert before.status_code == 200

    with session_factory() as db:
        user = db.query(User).filter(User.id == clinical_api["ids"]["doctor_a"]).first()
        user.password_hash = hash_password("ChangedPass1!")
        db.commit()
        db.refresh(user)
        assert user.auth_invalid_before is not None

    after = clinical_api["client"].get(
        "/doctor/appointments",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert after.status_code == 401
    assert after.json()["detail"] == "Session expired. Please log in again."


def test_legacy_plaintext_verification_token_is_temporarily_supported(clinical_api):
    session_factory = clinical_api["session_factory"]
    raw_token = "legacy-verification-token"

    with session_factory() as db:
        user = User(
            name="Legacy Verification Patient",
            email="legacy.verify@example.test",
            password_hash=hash_password("StrongPass1!"),
            role="patient",
            status="Active",
            is_verified=False,
        )
        # Simulate a pre-Phase-2 row by bypassing the model validator through a
        # direct SQL update after insertion.
        db.add(user)
        db.commit()
        db.execute(
            User.__table__.update()
            .where(User.id == user.id)
            .values(
                verification_token=raw_token,
                verification_token_expires=datetime.now(timezone.utc),
            )
        )
        db.commit()

    with _phase2_client(session_factory) as client:
        response = client.get("/auth/verify-email", params={"token": raw_token})

    # The simulated token expires at 'now', so it must never be accepted past
    # the migration grace timestamp.
    assert response.status_code == 400
