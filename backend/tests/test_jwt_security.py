from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import JWT_ALGORITHM, Settings, settings
from app.core.security import create_access_token, decode_access_token


def test_valid_token_contains_and_validates_required_claims():
    token = create_access_token({"sub": "synthetic.user@example.test"})
    payload = decode_access_token(token)

    assert payload["sub"] == "synthetic.user@example.test"
    assert payload["iss"] == settings.jwt_issuer
    assert payload["aud"] == settings.jwt_audience
    assert payload["jti"]


@pytest.mark.parametrize("token", ["not-a-jwt", "a.b.c"])
def test_malformed_token_is_rejected(token):
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token)
    assert exc.value.status_code == 401


def test_expired_token_is_rejected():
    token = create_access_token(
        {"sub": "synthetic.user@example.test"},
        expires_delta=timedelta(seconds=-1),
    )
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token)
    assert exc.value.status_code == 401


def encode_modified_claim(claim: str, value: str) -> str:
    valid = create_access_token({"sub": "synthetic.user@example.test"})
    payload = jwt.decode(valid, options={"verify_signature": False})
    payload[claim] = value
    return jwt.encode(
        payload,
        settings.secret_key.get_secret_value(),
        algorithm=JWT_ALGORITHM,
    )


@pytest.mark.parametrize(
    ("claim", "value"),
    [("iss", "wrong-issuer"), ("aud", "wrong-audience")],
)
def test_wrong_issuer_or_audience_is_rejected(claim, value):
    with pytest.raises(HTTPException) as exc:
        decode_access_token(encode_modified_claim(claim, value))
    assert exc.value.status_code == 401


def test_incorrect_signature_and_tampering_are_rejected():
    valid = create_access_token({"sub": "synthetic.user@example.test"})
    payload = jwt.decode(valid, options={"verify_signature": False})
    payload["sub"] = "forged.admin@example.test"
    forged = jwt.encode(
        payload,
        "different-test-key-that-is-also-at-least-32-bytes",
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(HTTPException) as exc:
        decode_access_token(forged)
    assert exc.value.status_code == 401


def test_missing_or_weak_secret_fails_configuration():
    required_environment = {
        "ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite+pysqlite:///:memory:",
    }

    with patch.dict("os.environ", required_environment, clear=True):
        with pytest.raises(ValidationError):
            Settings.from_environment()

    with pytest.raises(ValidationError):
        Settings(
            environment="test",
            database_url="sqlite+pysqlite:///:memory:",
            secret_key="supersecretkey",
        )