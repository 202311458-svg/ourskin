from __future__ import annotations

import os
import sys
from datetime import date, time, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-only-signing-key-with-at-least-32-bytes")
os.environ.setdefault("JWT_ISSUER", "os-coms-test")
os.environ.setdefault("JWT_AUDIENCE", "os-coms-test-api")

from app import db as app_db  # noqa: E402
from app.core.clock import clinic_now  # noqa: E402
from app.models import (  # noqa: E402, F401
    appointment,
    clinic_unavailable_date,
    doctor_schedule,
    doctor_service,
    service,
    user,
)
from app.models.appointment import AppointmentModel  # noqa: E402
from app.models.clinic_unavailable_date import ClinicUnavailableDate  # noqa: E402
from app.models.doctor_schedule import DoctorSchedule  # noqa: E402
from app.models.service import Service  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routes import admin_schedules_phase5, staff_schedules_phase5  # noqa: E402


def next_open_date(start: date, offset: int = 1) -> date:
    value = start + timedelta(days=offset)
    while value.weekday() == 6:
        value += timedelta(days=1)
    return value


@pytest.fixture()
def schedule_api():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    app_db.Base.metadata.create_all(bind=engine)

    today = clinic_now().date()
    future_a = next_open_date(today, 1)
    future_b = next_open_date(future_a, 1)
    future_c = next_open_date(future_b, 1)
    future_closure = next_open_date(future_c, 1)
    past_date = today - timedelta(days=2)
    while past_date.weekday() == 6:
        past_date -= timedelta(days=1)

    with TestingSession() as session:
        admin = User(
            name="Admin Scheduler",
            email="admin.scheduler@example.test",
            password_hash="unused",
            role="admin",
            status="Active",
            is_verified=True,
        )
        doctor = User(
            name="Doctor Schedule",
            email="doctor.schedule@example.test",
            password_hash="unused",
            role="doctor",
            status="Active",
            is_verified=True,
            specialty="Dermatology",
        )
        patient = User(
            name="Schedule Patient",
            email="schedule.patient@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=True,
        )
        session.add_all([admin, doctor, patient])
        session.flush()

        dermatology = Service(
            name="Dermatology Consultation",
            description="Synthetic service",
            requires_initial_evaluation=False,
            is_active=True,
        )
        session.add(dermatology)
        session.flush()

        linked = DoctorSchedule(
            doctor_id=doctor.id,
            services=dermatology.name,
            schedule_date=future_a,
            start_time=time(10, 0),
            end_time=time(11, 0),
            is_available=True,
            consultation_mode="In-Person",
            created_by_staff_id=admin.id,
        )
        available = DoctorSchedule(
            doctor_id=doctor.id,
            services=dermatology.name,
            schedule_date=future_b,
            start_time=time(10, 30),
            end_time=time(11, 30),
            is_available=True,
            consultation_mode="Online Consultation",
            created_by_staff_id=admin.id,
        )
        unavailable = DoctorSchedule(
            doctor_id=doctor.id,
            services=dermatology.name,
            schedule_date=future_c,
            start_time=time(12, 0),
            end_time=time(13, 0),
            is_available=False,
            consultation_mode="In-Person",
            unavailable_reason="Doctor Leave",
            created_by_staff_id=admin.id,
        )
        past = DoctorSchedule(
            doctor_id=doctor.id,
            services=dermatology.name,
            schedule_date=past_date,
            start_time=time(10, 0),
            end_time=time(11, 0),
            is_available=True,
            consultation_mode="In-Person",
            created_by_staff_id=admin.id,
        )
        session.add_all([linked, available, unavailable, past])
        session.flush()

        session.add(
            AppointmentModel(
                patient_id=patient.id,
                doctor_id=doctor.id,
                schedule_id=linked.id,
                service_id=dermatology.id,
                patient_name=patient.name,
                patient_email=patient.email,
                doctor_name=doctor.name,
                date=future_a,
                time=time(10, 0),
                end_time=time(11, 0),
                services=dermatology.name,
                status="Approved",
            )
        )
        future_closure_row = ClinicUnavailableDate(
            closure_date=future_closure,
            reason="Maintenance",
            created_by_staff_id=admin.id,
        )
        past_closure_row = ClinicUnavailableDate(
            closure_date=past_date,
            reason="Holiday",
            created_by_staff_id=admin.id,
        )
        session.add_all([future_closure_row, past_closure_row])
        session.commit()

        ids = {
            "linked": linked.id,
            "available": available.id,
            "unavailable": unavailable.id,
            "past": past.id,
            "past_closure": past_closure_row.id,
        }

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    admin_actor = SimpleNamespace(role="admin", id=1)
    test_app = FastAPI()
    test_app.include_router(admin_schedules_phase5.router)
    test_app.include_router(staff_schedules_phase5.router)
    test_app.dependency_overrides[admin_schedules_phase5.get_db] = override_db
    test_app.dependency_overrides[admin_schedules_phase5.require_admin] = lambda: admin_actor
    test_app.dependency_overrides[staff_schedules_phase5.get_db] = override_db
    test_app.dependency_overrides[staff_schedules_phase5.get_current_user] = lambda: admin_actor

    with TestClient(test_app) as client:
        yield client, ids


def test_admin_schedule_query_paginates_full_dataset_and_returns_global_summary(schedule_api):
    client, ids = schedule_api
    response = client.get(
        "/admin/schedules/query",
        params={"scope": "all", "page": 2, "page_size": 2},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 4
    assert payload["page"] == 2
    assert payload["total_pages"] == 2
    assert len(payload["items"]) == 2
    assert payload["summary"] == {
        "total": 4,
        "upcoming_available": 2,
        "unavailable": 1,
        "past": 1,
        "closures": 2,
    }
    linked_record = next(item for item in payload["items"] if item["id"] == ids["linked"])
    assert linked_record["linked_appointments"] == 1


def test_admin_schedule_query_filters_unavailable_records_server_side(schedule_api):
    client, ids = schedule_api
    response = client.get("/admin/schedules/query", params={"scope": "unavailable"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == ids["unavailable"]
    assert payload["items"][0]["unavailable_reason"] == "Doctor Leave"


def test_linked_schedule_blocks_booking_critical_edit_but_allows_note_update(schedule_api):
    client, ids = schedule_api
    blocked = client.put(
        f"/staff/doctor-schedules/{ids['linked']}",
        json={"start_time": "11:00:00"},
    )
    assert blocked.status_code == 409
    assert "linked to appointment records" in blocked.json()["detail"]

    allowed = client.put(
        f"/staff/doctor-schedules/{ids['linked']}",
        json={"schedule_note": "Keep room prepared"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["schedule_note"] == "Keep room prepared"


def test_linked_and_past_schedule_deletes_are_protected(schedule_api):
    client, ids = schedule_api
    linked = client.delete(f"/staff/doctor-schedules/{ids['linked']}")
    assert linked.status_code == 409
    assert "linked to appointment records" in linked.json()["detail"]

    past = client.delete(f"/staff/doctor-schedules/{ids['past']}")
    assert past.status_code == 409
    assert "Past schedules" in past.json()["detail"]


def test_past_closure_delete_is_protected(schedule_api):
    client, ids = schedule_api
    response = client.delete(f"/staff/clinic-unavailable-dates/{ids['past_closure']}")
    assert response.status_code == 409
    assert "Past clinic closure dates" in response.json()["detail"]
