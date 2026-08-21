from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core import security
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.routes import auth_phase2


def _client(session_factory):
    app = FastAPI()
    app.include_router(auth_phase2.router)

    def override_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[auth_phase2.get_db] = override_db
    app.dependency_overrides[security.get_db] = override_db

    @app.post("/protected-write")
    def protected_write(current_user: User = Depends(security.get_current_user)):
        return {"user_id": current_user.id}

    return TestClient(app)


def _prepare_staff(clinical_api):
    session_factory = clinical_api["session_factory"]
    with session_factory() as db:
        user = db.query(User).filter(User.id == clinical_api["ids"]["staff"]).first()
        user.password_hash = hash_password("CookiePass1!")
        user.status = "Active"
        user.is_verified = True
        user.failed_login_attempts = 0
        user.login_locked_until = None
        db.commit()
        return user.email, user.id


def test_password_login_sets_httponly_cookie_without_exposing_jwt(clinical_api):
    session_factory = clinical_api["session_factory"]
    email, _ = _prepare_staff(clinical_api)

    with _client(session_factory) as client:
        response = client.post(
            "/auth/login",
            data={"username": email, "password": "CookiePass1!"},
        )

        assert response.status_code == 200
        assert response.json()["access_token"] == auth_phase2.BROWSER_SESSION_MARKER
        assert response.json()["token_type"] == "cookie"

        set_cookie = response.headers["set-cookie"].lower()
        assert security.SESSION_COOKIE_NAME in set_cookie
        assert "httponly" in set_cookie
        assert "samesite=lax" in set_cookie

        # Cookie authentication works without a JavaScript bearer header.
        session = client.get("/auth/session")
        assert session.status_code == 200
        assert session.json()["email"] == email


def test_transient_bearer_can_be_exchanged_for_cookie(clinical_api):
    session_factory = clinical_api["session_factory"]
    email, _ = _prepare_staff(clinical_api)
    bearer = create_access_token({"sub": email})

    with _client(session_factory) as client:
        response = client.post(
            "/auth/session/exchange",
            headers={"Authorization": f"Bearer {bearer}"},
        )

        assert response.status_code == 200
        assert security.SESSION_COOKIE_NAME in response.headers["set-cookie"]
        assert client.get("/auth/session").status_code == 200


def test_cookie_authenticated_write_requires_trusted_origin(clinical_api):
    session_factory = clinical_api["session_factory"]
    email, user_id = _prepare_staff(clinical_api)

    with _client(session_factory) as client:
        login = client.post(
            "/auth/login",
            data={"username": email, "password": "CookiePass1!"},
        )
        assert login.status_code == 200

        missing_origin = client.post("/protected-write")
        assert missing_origin.status_code == 403

        cross_origin = client.post(
            "/protected-write",
            headers={"Origin": "https://attacker.example"},
        )
        assert cross_origin.status_code == 403

        trusted = client.post(
            "/protected-write",
            headers={"Origin": "http://testserver"},
        )
        assert trusted.status_code == 200
        assert trusted.json()["user_id"] == user_id
