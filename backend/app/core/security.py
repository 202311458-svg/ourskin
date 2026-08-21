from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import hashlib
import jwt
import secrets

from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import JWT_ALGORITHM, settings
from app.db import get_db
from app.models.user import User


SESSION_COOKIE_NAME = "ourskin_session"

# PASSWORD HASHING
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    # bcrypt only supports 72 bytes. The application password policy currently
    # keeps normal credentials below that limit; slicing is retained here for
    # compatibility with existing password hashes.
    password = password[:72]
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)


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
            # Store a numeric timestamp with sub-second precision so a token
            # issued immediately after a password change is distinguishable
            # from a token created immediately before it.
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
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["exp", "iat", "iss", "aud", "jti", "sub"]},
        )
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# AUTH DEPENDENCIES
# Bearer authentication remains accepted during the Phase 5 migration so older
# frontend pages continue to work while the browser session moves to HttpOnly
# cookies. Once all callers are cookie-based this compatibility path can be
# removed.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    session_token = token or request.cookies.get(SESSION_COOKIE_NAME)

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(session_token)
    email = payload.get("sub")

    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication",
        )

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication",
        )

    invalid_before = user.auth_invalid_before
    if invalid_before:
        if invalid_before.tzinfo is None:
            invalid_before = invalid_before.replace(tzinfo=timezone.utc)

        issued_at = payload.get("iat")
        issued_at_timestamp = (
            issued_at.timestamp()
            if isinstance(issued_at, datetime)
            else float(issued_at)
        )

        if issued_at_timestamp <= invalid_before.timestamp():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please log in again.",
            )

    if user.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return user
