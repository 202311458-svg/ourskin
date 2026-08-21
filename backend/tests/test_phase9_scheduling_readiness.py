from datetime import date, datetime, time

import pytest
from fastapi import HTTPException

from app.core.clock import get_clinic_timezone
from app.main import app
from app.models.doctor_schedule import DoctorSchedule
from app.routes import appointments as legacy
from app.routes import appointments_phase9 as phase9
from app.routes import staff_schedules as legacy_staff_schedules
from app.routes import staff_schedules_phase9 as phase9_staff_schedules


def test_phase9_routes_precede_legacy_appointment_routes():
    matching = [
        route
        for route in app.routes
        if getattr(route, "path", None) == "/appointments/today"
        and "GET" in getattr(route, "methods", set())
    ]

    assert len(matching) >= 2
    assert matching[0].endpoint is phase9.get_today_appointments


def test_phase9_staff_schedule_route_precedes_legacy_route():
    matching = [
        route
        for route in app.routes
        if getattr(route, "path", None) == "/staff/doctor-schedules"
        and "GET" in getattr(route, "methods", set())
    ]

    assert len(matching) >= 2
    assert matching[0].endpoint is phase9_staff_schedules.get_doctor_schedules


def test_shared_legacy_helpers_are_replaced_with_phase9_clock_safe_versions():
    assert legacy.calculate_age is phase9.calculate_age
    assert legacy.calculate_age_label is phase9.calculate_age_label
    assert legacy.validate_slot_inside_schedule is phase9.validate_slot_inside_schedule
    assert (
        legacy.validate_manual_initial_evaluation_schedule
        is phase9.validate_manual_initial_evaluation_schedule
    )
    assert legacy_staff_schedules.is_past_schedule is phase9_staff_schedules.is_past_schedule


def test_clinic_local_datetime_uses_configured_zone():
    value = phase9.clinic_local_datetime(date(2026, 8, 21), time(9, 30))

    assert value.tzinfo is not None
    assert getattr(value.tzinfo, "key", None) == getattr(
        get_clinic_timezone(), "key", None
    )


def test_schedule_validator_compares_against_clinic_clock(monkeypatch):
    schedule = DoctorSchedule(
        schedule_date=date(2026, 8, 21),
        start_time=time(8, 0),
        end_time=time(12, 0),
    )
    clinic_tz = get_clinic_timezone()

    monkeypatch.setattr(
        phase9,
        "clinic_now",
        lambda: datetime(2026, 8, 21, 9, 0, tzinfo=clinic_tz),
    )

    phase9.validate_slot_inside_schedule(schedule, time(10, 0), time(11, 0))

    with pytest.raises(HTTPException, match="Past time slots cannot be booked"):
        phase9.validate_slot_inside_schedule(schedule, time(8, 0), time(9, 0))


def test_manual_initial_evaluation_validator_uses_clinic_clock(monkeypatch):
    clinic_tz = get_clinic_timezone()
    monkeypatch.setattr(
        phase9,
        "clinic_now",
        lambda: datetime(2026, 8, 21, 14, 0, tzinfo=clinic_tz),
    )

    phase9.validate_manual_initial_evaluation_schedule(
        date(2026, 8, 21), time(15, 0), time(16, 0)
    )

    with pytest.raises(HTTPException, match="Past schedules cannot be assigned"):
        phase9.validate_manual_initial_evaluation_schedule(
            date(2026, 8, 21), time(13, 0), time(14, 0)
        )


def test_staff_schedule_past_check_uses_clinic_clock(monkeypatch):
    clinic_tz = get_clinic_timezone()
    monkeypatch.setattr(
        phase9_staff_schedules,
        "clinic_now",
        lambda: datetime(2026, 8, 21, 10, 30, tzinfo=clinic_tz),
    )

    assert phase9_staff_schedules.is_past_schedule(
        date(2026, 8, 21), time(10, 0)
    ) is True
    assert phase9_staff_schedules.is_past_schedule(
        date(2026, 8, 21), time(11, 0)
    ) is False


def test_phase9_array_endpoints_are_bounded_by_contract():
    assert phase9.DEFAULT_LIST_LIMIT <= phase9.MAX_LIST_LIMIT
    assert phase9.LEGACY_ARRAY_LIMIT <= phase9.MAX_LIST_LIMIT
    assert phase9.MAX_LIST_LIMIT == 200
    assert phase9_staff_schedules.DEFAULT_LIST_LIMIT <= phase9_staff_schedules.MAX_LIST_LIMIT
    assert phase9_staff_schedules.MAX_LIST_LIMIT == 200
