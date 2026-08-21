from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import (
    clear_session_cookie,
    create_access_token,
    get_current_user,
    hash_token,
    set_session_cookie,
    verify_password,
)
from app.db import get_db
from app.models.user import User


router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _auth_response(user: User, response: Response):
    token = create_access_token({"sub": user.email})
    set_session_cookie(response, token)

    # Browser authentication is cookie-based. The JWT is intentionally not
    # exposed in the normal password-login response.
    return {
        "role": user.role,
        "status": user.status,
    }


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = hash_token(token)
    user = (
        db.query(User)
        .filter(
            or_(
                User.verification_token == token_hash,
                # Transitional support for links issued before Phase 2.
                User.verification_token == token,
            )
        )
        .first()
    )

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token.")

    expires_at = _as_utc(user.verification_token_expires)
    if expires_at is None or datetime.now(timezone.utc) > expires_at:
        user.verification_token = None
        user.verification_token_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired token.")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)

    return {"message": "Email verified successfully. You can now login."}


@router.post("/login")
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username.lower().strip()
    now = datetime.now(timezone.utc)
    db_user = db.query(User).filter(User.email == email).first()

    if db_user:
        locked_until = _as_utc(db_user.login_locked_until)
        if locked_until and locked_until > now:
            retry_after = max(1, int((locked_until - now).total_seconds()))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        if locked_until and locked_until <= now:
            db_user.failed_login_attempts = 0
            db_user.login_locked_until = None

    valid_password = bool(
        db_user and verify_password(form_data.password, db_user.password_hash)
    )

    if not valid_password:
        if db_user:
            db_user.failed_login_attempts = (db_user.failed_login_attempts or 0) + 1
            if db_user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                db_user.login_locked_until = now + timedelta(minutes=LOGIN_LOCK_MINUTES)
            db.commit()

        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if db_user.status != "Active":
        raise HTTPException(
            status_code=403,
            detail="Your account is inactive. Please contact the administrator.",
        )

    if not db_user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    if db_user.failed_login_attempts or db_user.login_locked_until:
        db_user.failed_login_attempts = 0
        db_user.login_locked_until = None
        db.commit()
        db.refresh(db_user)

    return _auth_response(db_user, response)


@router.get("/session")
def session(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "status": current_user.status,
    }


@router.post("/session/exchange")
def exchange_bearer_for_cookie(
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Exchange a transient bearer login result (e.g. legacy Google auth) for
    the browser's HttpOnly session cookie without persisting the bearer token.
    """

    token = create_access_token({"sub": current_user.email})
    set_session_cookie(response, token)
    return {
        "role": current_user.role,
        "status": current_user.status,
    }


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"message": "Logged out successfully."}
