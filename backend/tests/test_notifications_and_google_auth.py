from datetime import date, datetime, timedelta, timezone

import jwt

from app.core.config import settings

from app.core.security import hash_password
from app.models.notification import Notification
from app.models.user import User


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_notifications_are_recipient_scoped(clinical_api):
    session_factory = clinical_api["session_factory"]
    ids = clinical_api["ids"]
    tokens = clinical_api["tokens"]

    with session_factory() as db:
        own = Notification(
            recipient_id=ids["patient_a"],
            title="Own notification",
            message="Visible only to patient A",
            notification_type="test",
        )
        other = Notification(
            recipient_id=ids["patient_b"],
            title="Other notification",
            message="Must remain private",
            notification_type="test",
        )
        db.add_all([own, other])
        db.commit()
        own_id, other_id = own.id, other.id

    response = clinical_api["client"].get(
        "/notifications?page=1&page_size=10",
        headers=auth_header(tokens["patient_a"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["total_pages"] == 1
    assert [item["id"] for item in body["items"]] == [own_id]

    forbidden_read = clinical_api["client"].patch(
        f"/notifications/{other_id}/read",
        headers=auth_header(tokens["patient_a"]),
    )
    assert forbidden_read.status_code == 404

    own_read = clinical_api["client"].patch(
        f"/notifications/{own_id}/read",
        headers=auth_header(tokens["patient_a"]),
    )
    assert own_read.status_code == 200
    assert own_read.json()["is_read"] is True

    with session_factory() as db:
        assert db.get(Notification, other_id).is_read is False


def test_mark_all_only_updates_current_recipient(clinical_api):
    session_factory = clinical_api["session_factory"]
    ids = clinical_api["ids"]
    tokens = clinical_api["tokens"]

    with session_factory() as db:
        db.add_all(
            [
                Notification(recipient_id=ids["patient_a"], title="A1", message="A1", notification_type="test"),
                Notification(recipient_id=ids["patient_a"], title="A2", message="A2", notification_type="test"),
                Notification(recipient_id=ids["patient_b"], title="B1", message="B1", notification_type="test"),
            ]
        )
        db.commit()

    response = clinical_api["client"].patch(
        "/notifications/read-all",
        headers=auth_header(tokens["patient_a"]),
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    with session_factory() as db:
        assert db.query(Notification).filter_by(recipient_id=ids["patient_a"], is_read=False).count() == 0
        assert db.query(Notification).filter_by(recipient_id=ids["patient_b"], is_read=False).count() == 1


def test_google_existing_user_requires_password_and_preserves_role(clinical_api, monkeypatch):
    session_factory = clinical_api["session_factory"]
    admin_id = clinical_api["ids"]["admin"]

    with session_factory() as db:
        admin = db.get(User, admin_id)
        admin.password_hash = hash_password("ExistingPass1!")
        db.commit()

    claims = {
        "sub": "google-admin-subject",
        "email": "admin@example.test",
        "given_name": "Synthetic",
        "family_name": "Admin",
    }
    monkeypatch.setattr("app.routes.auth.verify_google_credential", lambda credential: claims)

    start = clinical_api["client"].post("/auth/google/start", json={"credential": "valid"})
    assert start.status_code == 200
    assert start.json()["action"] == "link_required"

    wrong = clinical_api["client"].post(
        "/auth/google/link",
        json={"credential": "valid", "password": "wrong"},
    )
    assert wrong.status_code == 401

    linked = clinical_api["client"].post(
        "/auth/google/link",
        json={"credential": "valid", "password": "ExistingPass1!"},
    )
    assert linked.status_code == 200
    assert linked.json()["role"] == "admin"

    with session_factory() as db:
        admin = db.get(User, admin_id)
        assert admin.role == "admin"
        assert admin.google_sub == "google-admin-subject"


def test_new_google_registration_is_patient_and_duplicate_is_rejected(clinical_api, monkeypatch):
    claims = {
        "sub": "new-google-patient",
        "email": "new.patient@example.test",
        "given_name": "New",
        "family_name": "Patient",
    }
    monkeypatch.setattr("app.routes.auth.verify_google_credential", lambda credential: claims)

    start = clinical_api["client"].post("/auth/google/start", json={"credential": "valid"})
    assert start.status_code == 200
    token = start.json()["onboarding_token"]

    payload = {
        "onboarding_token": token,
        "first_name": "New",
        "last_name": "Patient",
        "date_of_birth": str(date(1995, 1, 1)),
        "address": "Synthetic Complete Address",
        "contact": "09123456789",
        "terms_accepted": True,
        "privacy_accepted": True,
    }
    registered = clinical_api["client"].post("/auth/google/register", json=payload)
    assert registered.status_code == 201
    assert registered.json()["role"] == "patient"

    duplicate = clinical_api["client"].post("/auth/google/register", json=payload)
    assert duplicate.status_code == 409

    with clinical_api["session_factory"]() as db:
        users = db.query(User).filter(User.email == claims["email"]).all()
        assert len(users) == 1
        assert users[0].role == "patient"
        assert users[0].google_sub == claims["sub"]


def test_invalid_and_expired_google_onboarding_tokens_are_rejected(clinical_api):
    payload = {
        "onboarding_token": "not-a-valid-token",
        "first_name": "Test",
        "last_name": "Patient",
        "date_of_birth": str(date(1995, 1, 1)),
        "address": "Synthetic Complete Address",
        "contact": "09123456789",
        "terms_accepted": True,
        "privacy_accepted": True,
    }
    invalid = clinical_api["client"].post("/auth/google/register", json=payload)
    assert invalid.status_code == 401

    now = datetime.now(timezone.utc)
    payload["onboarding_token"] = jwt.encode(
        {
            "sub": "expired-google-subject",
            "email": "expired@example.test",
            "kind": "google_onboarding",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
            "iss": settings.jwt_issuer,
            "aud": "os-coms-google-onboarding",
        },
        settings.secret_key.get_secret_value(),
        algorithm="HS256",
    )
    expired = clinical_api["client"].post("/auth/google/register", json=payload)
    assert expired.status_code == 401