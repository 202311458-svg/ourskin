import pytest
from pydantic import ValidationError

from app.core.password_policy import (
    MAX_BCRYPT_PASSWORD_BYTES,
    validate_bcrypt_input,
    validate_new_password,
)
from app.core.security import hash_password, pwd_context, verify_password
from app.schemas.user import ChangePasswordRequest, ResetPasswordRequest, StaffCreate


def test_new_password_accepts_exact_bcrypt_byte_limit():
    password = "A1!" + ("x" * (MAX_BCRYPT_PASSWORD_BYTES - 3))
    assert len(password.encode("utf-8")) == MAX_BCRYPT_PASSWORD_BYTES
    assert validate_new_password(password) == password


def test_new_password_rejects_more_than_72_utf8_bytes():
    # Multibyte characters make a character-count-only limit unsafe for bcrypt.
    password = "A1!" + ("é" * 35)
    assert len(password) < MAX_BCRYPT_PASSWORD_BYTES
    assert len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES

    with pytest.raises(ValueError, match="72 UTF-8 bytes"):
        validate_new_password(password)


def test_hash_boundary_rejects_oversized_secret_even_without_schema():
    with pytest.raises(ValueError, match="72 UTF-8 bytes"):
        hash_password("x" * (MAX_BCRYPT_PASSWORD_BYTES + 1))


def test_hash_boundary_does_not_apply_user_strength_rules_to_system_secrets():
    opaque_secret = "system-generated-opaque-secret"
    assert validate_bcrypt_input(opaque_secret) == opaque_secret

    hashed = hash_password(opaque_secret)
    assert verify_password(opaque_secret, hashed) is True


def test_legacy_long_password_verification_uses_historical_72_byte_input():
    legacy_password = "A1!" + ("x" * 90)
    legacy_effective = legacy_password.encode("utf-8")[:MAX_BCRYPT_PASSWORD_BYTES]
    legacy_hash = pwd_context.hash(legacy_effective)

    assert verify_password(legacy_password, legacy_hash) is True


def test_change_password_schema_enforces_shared_policy():
    with pytest.raises(ValidationError):
        ChangePasswordRequest(
            current_password="ExistingPass1!",
            new_password="A1!" + ("x" * 70),
        )


def test_reset_password_schema_enforces_shared_policy_and_match():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(
            token="reset-token",
            new_password="NewPassword1!",
            confirm_password="DifferentPassword1!",
        )


def test_staff_password_uses_same_policy():
    with pytest.raises(ValidationError):
        StaffCreate(
            name="Staff User",
            email="staff.phase6@example.test",
            password="weakpassword",
            role="staff",
        )
