from datetime import date, time, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routes.doctor_phase1 import ensure_appointment_has_started
from app.schemas.appointment import AppointmentCreate
from app.schemas.user import StaffCreate


def test_admin_created_staff_password_must_meet_policy():
    with pytest.raises(ValidationError):
        StaffCreate(
            name="Synthetic Staff",
            email="staff@example.test",
            password="weakpass",
            role="staff",
        )

    valid = StaffCreate(
        name="Synthetic Staff",
        email="staff@example.test",
        password="Strong1!",
        role="staff",
    )
    assert valid.password == "Strong1!"


@pytest.mark.parametrize(
    "contact",
    ["12345", "09123abc789", "+631234567890", "09 1234 56789"],
)
def test_booking_rejects_invalid_patient_contact(contact):
    with pytest.raises(ValidationError):
        AppointmentCreate(service_id=1, patient_contact=contact)


@pytest.mark.parametrize("contact", ["09123456789", "+639123456789"])
def test_booking_accepts_supported_philippine_mobile_formats(contact):
    payload = AppointmentCreate(service_id=1, patient_contact=contact)
    assert payload.patient_contact == contact


def test_booking_rejects_meaningless_short_address():
    with pytest.raises(ValidationError):
        AppointmentCreate(service_id=1, patient_address=" x ")


def test_future_appointment_cannot_be_completed():
    appointment = SimpleNamespace(
        date=date.today() + timedelta(days=1),
        time=time(9, 0),
    )

    with pytest.raises(HTTPException) as exc:
        ensure_appointment_has_started(appointment)

    assert exc.value.status_code == 400
    assert "scheduled start time" in exc.value.detail


def test_past_appointment_can_continue_to_completion_workflow():
    appointment = SimpleNamespace(
        date=date.today() - timedelta(days=1),
        time=time(9, 0),
    )

    ensure_appointment_has_started(appointment)
