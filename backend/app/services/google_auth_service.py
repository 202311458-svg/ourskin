from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleRequest
from google.auth.exceptions import GoogleAuthError, TransportError
from google.oauth2 import id_token

from app.core.config import settings


GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
ONBOARDING_AUDIENCE = "os-coms-google-onboarding"


def _require_google_client_id() -> str:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured",
        )
    return settings.google_client_id


def verify_google_credential(credential: str) -> dict:
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            _require_google_client_id(),
        )
    except (ValueError, TypeError, GoogleAuthError, TransportError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed",
        )

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    if claims.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    if not claims.get("sub") or not claims.get("email") or claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="A verified Google email is required")

    return {
        "sub": str(claims["sub"]),
        "email": str(claims["email"]).strip().lower(),
        "given_name": str(claims.get("given_name") or "").strip(),
        "family_name": str(claims.get("family_name") or "").strip(),
    }


def create_google_onboarding_token(claims: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": claims["sub"],
        "email": claims["email"],
        "given_name": claims.get("given_name", ""),
        "family_name": claims.get("family_name", ""),
        "kind": "google_onboarding",
        "iat": now,
        "exp": now + timedelta(minutes=settings.google_onboarding_token_expire_minutes),
        "iss": settings.jwt_issuer,
        "aud": ONBOARDING_AUDIENCE,
    }
    return jwt.encode(
        payload,
        settings.secret_key.get_secret_value(),
        algorithm="HS256",
    )


def decode_google_onboarding_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=ONBOARDING_AUDIENCE,
            options={"require": ["sub", "email", "kind", "iat", "exp", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Google registration session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid Google registration session")

    if payload.get("kind") != "google_onboarding":
        raise HTTPException(status_code=401, detail="Invalid Google registration session")
    return payload