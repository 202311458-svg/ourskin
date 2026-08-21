import re


PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$", re.DOTALL)
MIN_PASSWORD_CHARACTERS = 8
MAX_BCRYPT_PASSWORD_BYTES = 72
PASSWORD_ERROR = (
    "Password must be at least 8 characters, include uppercase, number, and special character."
)
PASSWORD_TOO_LONG_ERROR = (
    "Password is too long. Use a password that is 72 UTF-8 bytes or fewer."
)


def validate_bcrypt_input(password: str) -> str:
    """Reject inputs bcrypt would silently truncate.

    This is deliberately separate from the user-facing strength policy because
    system-generated opaque secrets also pass through the hashing boundary.
    """

    if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(PASSWORD_TOO_LONG_ERROR)
    return password


def validate_new_password(password: str) -> str:
    """Validate a user-selected password before creating a bcrypt hash."""

    validate_bcrypt_input(password)

    if not PASSWORD_PATTERN.match(password):
        raise ValueError(PASSWORD_ERROR)

    return password
