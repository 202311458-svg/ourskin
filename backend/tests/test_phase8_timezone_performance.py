from datetime import date, time

import pytest
from pydantic import SecretStr, ValidationError

from app.core.clock import clinic_now, get_clinic_timezone
from app.core.config import Settings
from app.routes.booking import slot_is_blocked


def build_settings(clinic_timezone: str) -> Settings:
    return Settings(
        environment="test",
        database_url="sqlite:///:memory:",
        secret_key=SecretStr("phase-eight-test-secret-key-at-least-32-bytes"),
        clinic_timezone=clinic_timezone,
    )


def test_clinic_timezone_accepts_valid_iana_zone():
    settings = build_settings("Asia/Manila")
    assert settings.clinic_timezone == "Asia/Manila"


def test_clinic_timezone_rejects_invalid_zone():
    with pytest.raises(ValidationError, match="valid IANA timezone"):
        build_settings("Mars/Clinic")


def test_clinic_clock_is_timezone_aware():
    timezone = get_clinic_timezone()
    current = clinic_now()

    assert current.tzinfo is not None
    assert getattr(timezone, "key", None) == "Asia/Manila"
    assert getattr(current.tzinfo, "key", None) == "Asia/Manila"


def test_slot_overlap_uses_preloaded_intervals():
    appointment_date = date(2026, 8, 25)
    blocking = {
        (7, appointment_date): [
            (time(9, 0), time(10, 0)),
            (time(13, 0), time(14, 0)),
        ]
    }

    assert slot_is_blocked(
        blocking, 7, appointment_date, time(9, 30), time(10, 30)
    ) is True
    assert slot_is_blocked(
        blocking, 7, appointment_date, time(10, 0), time(11, 0)
    ) is False
    assert slot_is_blocked(
        blocking, 8, appointment_date, time(9, 30), time(10, 30)
    ) is False


def test_adjacent_appointments_do_not_false_positive():
    appointment_date = date(2026, 8, 25)
    blocking = {(3, appointment_date): [(time(8, 0), time(9, 0))]}

    assert slot_is_blocked(
        blocking, 3, appointment_date, time(9, 0), time(10, 0)
    ) is False
