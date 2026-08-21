import pytest
from pydantic import ValidationError

from app.core.password_policy import MAX_BCRYPT_PASSWORD_BYTES, validate_new_password
from app.schemas.user import ChangePasswordRequest, ResetPasswordRequest, StaffCreate, UserCreate


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
