from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import hashlib
import jwt
import secrets

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import JWT_ALGORITHM, settings
from app.db import get_db
from app.models.user import User


# PASSWORD HASHING
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    # bcrypt only supports 72 bytes
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
            "iat": now,
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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(token)
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

    if user.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return user