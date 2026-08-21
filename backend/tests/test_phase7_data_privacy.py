from datetime import date

import pytest
from pydantic import ValidationError

from app.models.user import User
from app.routes.booking import serialize_doctor
from app.schemas.user import DoctorProfileUpdate, UserProfileUpdate


def test_patient_booking_doctor_payload_excludes_account_email():
    doctor = User(
        id=42,
        name="Dr. Privacy",
        first_name="Privacy",
        last_name="Doctor",
        email="private-doctor@example.test",
        password_hash="not-used",
        role="doctor",
        status="Active",
        specialty="Dermatology",
        availability="Weekdays",
        bio="Clinical profile",
    )

    payload = serialize_doctor(doctor)

    assert payload["id"] == 42
    assert payload["name"] == "Dr. Privacy"
    assert "email" not in payload


def test_profile_update_rejects_fields_that_are_not_editable():
    with pytest.raises(ValidationError):
        UserProfileUpdate(date_of_birth=date(1990, 1, 1))


def test_profile_update_rejects_invalid_contact_and_short_names():
    with pytest.raises(ValidationError):
        UserProfileUpdate(first_name="A")

    with pytest.raises(ValidationError):
        UserProfileUpdate(contact="12345")


def test_profile_update_trims_and_bounds_editable_fields():
    payload = UserProfileUpdate(
        first_name="  Angela  ",
        last_name="  Reyes  ",
        contact="09123456789",
        address="  123 Example Street, Manila  ",
    )

    assert payload.first_name == "Angela"
    assert payload.last_name == "Reyes"
    assert payload.address == "123 Example Street, Manila"


def test_doctor_profile_update_reuses_bounded_validation():
    payload = DoctorProfileUpdate(
        name="  Dr. Sample  ",
        specialty="  Dermatology  ",
        bio="  Clinical bio  ",
    )

    assert payload.name == "Dr. Sample"
    assert payload.specialty == "Dermatology"
    assert payload.bio == "Clinical bio"

    with pytest.raises(ValidationError):
        DoctorProfileUpdate(bio="x" * 2001)
