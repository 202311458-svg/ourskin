from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import hashlib
import jwt
import secrets
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import JWT_ALGORITHM, settings
from app.core.password_policy import validate_bcrypt_input
from app.db import get_db
from app.models.user import User


SESSION_COOKIE_NAME = "ourskin_session"
SAFE_BROWSER_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


# PASSWORD HASHING
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a new secret after enforcing bcrypt's byte-safety boundary."""

    return pwd_context.hash(validate_bcrypt_input(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify legacy hashes using bcrypt's historical 72-byte effective input.

    Existing accounts may have been created before Phase 6 explicitly rejected
    longer passwords. Supplying the first 72 UTF-8 bytes recreates bcrypt's old
    effective input without allowing new hashes to be silently truncated.
    """

    effective_password = plain_password.encode("utf-8")[:72]
    return pwd_context.verify(effective_password, hashed_password)


def hash_token(token: str) -> str:
    token_value = f"{settings.secret_key.get_secret_value()}:{token}"
    return hashlib.sha256(token_value.encode("utf-8")).hexdigest()


# TOKEN CREATION
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.access_token_expire_minutes)
    )

    to_encode.update(
        {
            "exp": expire,
            "iat": now.timestamp(),
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "jti": secrets.token_urlsafe(24),
        }
    )

    return jwt.encode(
        to_encode,
        settings.secret_key.get_secret_value(),
        algorithm=JWT_ALGORITHM,
    )


# TOKEN DECODING
def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["exp", "iat", "iss", "aud", "jti", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# BROWSER SESSION COOKIE
def session_cookie_secure() -> bool:
    return settings.environment in {"staging", "production"}


def session_cookie_samesite() -> str:
    return "none" if session_cookie_secure() else "lax"


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=session_cookie_secure(),
        samesite=session_cookie_samesite(),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=session_cookie_secure(),
        samesite=session_cookie_samesite(),
        path="/",
    )


def _normalize_origin(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlsplit(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def trusted_browser_origins() -> set[str]:
    candidates = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.frontend_url,
        *settings.cors_origins,
    }
    if settings.environment == "test":
        candidates.add("http://testserver")

    return {
        normalized
        for candidate in candidates
        if (normalized := _normalize_origin(candidate)) is not None
    }


def validate_cookie_request_origin(request: Request) -> None:
    if request.method.upper() in SAFE_BROWSER_METHODS:
        return

    origin = _normalize_origin(request.headers.get("origin"))
    if origin is None or origin not in trusted_browser_origins():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid request origin.",
        )


# AUTH DEPENDENCIES
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_token = cookie_token or token

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if cookie_token:
        validate_cookie_request_origin(request)

    payload = decode_access_token(session_token)
    email = payload.get("sub")

    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication")

    invalid_before = user.auth_invalid_before
    if invalid_before:
        if invalid_before.tzinfo is None:
            invalid_before = invalid_before.replace(tzinfo=timezone.utc)

        issued_at = payload.get("iat")
        issued_at_timestamp = issued_at.timestamp() if isinstance(issued_at, datetime) else float(issued_at)

        if issued_at_timestamp <= invalid_before.timestamp():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
            )

    if user.status != "Active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive.")

    return user
