"""Validated application configuration.

Secrets are deliberately loaded once and never printed or included in validation
messages. Importing this module fails closed when required configuration is
missing or unsafe.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv
from pydantic import BaseModel, Field, SecretStr, field_validator


BACKEND_DIR = Path(__file__).resolve().parents[2]
BOOTSTRAP_ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
if BOOTSTRAP_ENVIRONMENT in {"development", "test"}:
    load_dotenv(BACKEND_DIR / ".env", override=False)

JWT_ALGORITHM = "HS256"


class Settings(BaseModel):
    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str
    secret_key: SecretStr
    access_token_expire_minutes: int = Field(default=60, ge=5, le=1440)
    jwt_issuer: str = "os-coms"
    jwt_audience: str = "os-coms-api"
    frontend_url: str | None = None
    cors_origins: tuple[str, ...] = ()
    google_client_id: str | None = None
    google_onboarding_token_expire_minutes: int = Field(default=15, ge=5, le=60)
    clinic_timezone: str = "Asia/Manila"

    @field_validator("database_url", "jwt_issuer", "jwt_audience")
    @classmethod
    def require_non_empty_value(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("required configuration value must not be empty")
        return cleaned

    @field_validator("clinic_timezone")
    @classmethod
    def validate_clinic_timezone(cls, value: str) -> str:
        cleaned = value.strip()
        try:
            ZoneInfo(cleaned)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("CLINIC_TIMEZONE must be a valid IANA timezone")
        return cleaned

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: SecretStr) -> SecretStr:
        secret = value.get_secret_value()
        known_weak_values = {
            "supersecretkey",
            "secret",
            "changeme",
            "change-me",
            "development",
        }

        if len(secret.encode("utf-8")) < 32 or secret.lower() in known_weak_values:
            raise ValueError("SECRET_KEY must be a strong value of at least 32 bytes")

        return value

    @classmethod
    def from_environment(cls) -> "Settings":
        raw_origins = os.getenv("CORS_ORIGINS", "")
        origins = tuple(
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        )

        return cls(
            environment=os.getenv("ENVIRONMENT", "development").strip().lower(),
            database_url=os.getenv("DATABASE_URL", ""),
            secret_key=os.getenv("SECRET_KEY", ""),
            access_token_expire_minutes=os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"),
            jwt_issuer=os.getenv("JWT_ISSUER", "os-coms"),
            jwt_audience=os.getenv("JWT_AUDIENCE", "os-coms-api"),
            frontend_url=os.getenv("FRONTEND_URL") or None,
            cors_origins=origins,
            google_client_id=os.getenv("GOOGLE_CLIENT_ID") or None,
            google_onboarding_token_expire_minutes=os.getenv(
                "GOOGLE_ONBOARDING_TOKEN_EXPIRE_MINUTES", "15"
            ),
            clinic_timezone=os.getenv("CLINIC_TIMEZONE", "Asia/Manila"),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_environment()


settings = get_settings()
