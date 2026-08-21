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


def validate_new_password(password: str) -> str:
    """Validate credentials before creating a bcrypt hash.

    bcrypt considers only the first 72 bytes. Rejecting longer *new* passwords
    prevents two visibly different credentials from silently producing the same
    effective bcrypt input. Existing hashes remain verifiable through the
    compatibility path in ``verify_password``.
    """

    if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(PASSWORD_TOO_LONG_ERROR)

    if not PASSWORD_PATTERN.match(password):
        raise ValueError(PASSWORD_ERROR)

    return password
