from __future__ import annotations

import os
import sys
from datetime import date, time, timedelta
from pathlib import Path

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
from app.models import (  # noqa: E402,F401
    appointment,
    audit_log,
    doctor_schedule,
    service,
    user,
)
from app.models.appointment import AppointmentModel  # noqa: E402
from app.models.doctor_schedule import DoctorSchedule  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routes import admin_accounts_phase6  # noqa: E402


@pytest.fixture()
def account_api():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    app_db.Base.metadata.create_all(bind=engine)

    with TestingSession() as session:
        admin = User(
            name="Admin Owner",
            email="admin@example.test",
            password_hash="unused",
            role="admin",
            status="Active",
            is_verified=True,
        )
        second_admin = User(
            name="Admin Two",
            email="admin2@example.test",
            password_hash="unused",
            role="admin",
            status="Active",
            is_verified=True,
        )
        staff = User(
            name="Clinic Staff",
            email="staff@example.test",
            password_hash="unused",
            role="staff",
            status="Active",
            is_verified=True,
            department="Front Desk",
        )
        doctor = User(
            name="Doctor Linked",
            email="doctor@example.test",
            password_hash="unused",
            role="doctor",
            status="Active",
            is_verified=True,
            specialty="Dermatology",
        )
        eligible = User(
            name="Eligible Candidate",
            email="eligible@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=True,
        )
        unverified = User(
            name="Unverified Candidate",
            email="unverified@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=False,
        )
        patient_history = User(
            name="Patient With History",
            email="history@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=True,
        )
        inactive_patient = User(
            name="Inactive Patient",
            email="inactive@example.test",
            password_hash="unused",
            role="patient",
            status="Inactive",
            is_verified=True,
        )
        session.add_all([admin, second_admin, staff, doctor, eligible, unverified, patient_history, inactive_patient])
        session.flush()

        schedule = DoctorSchedule(
            doctor_id=doctor.id,
            services="Consultation",
            schedule_date=date.today() + timedelta(days=2),
            start_time=time(10, 0),
            end_time=time(11, 0),
            is_available=True,
            consultation_mode="In-Person",
            created_by_staff_id=admin.id,
        )
        history_appt = AppointmentModel(
            patient_id=patient_history.id,
            patient_name=patient_history.name,
            patient_email=patient_history.email,
            services="Consultation",
            status="Completed",
        )
        doctor_appt = AppointmentModel(
            patient_id=eligible.id,
            doctor_id=doctor.id,
            patient_name=eligible.name,
            patient_email=eligible.email,
            doctor_name=doctor.name,
            date=date.today() + timedelta(days=2),
            time=time(10, 0),
            end_time=time(11, 0),
            services="Consultation",
            status="Approved",
        )
        session.add_all([schedule, history_appt, doctor_appt])
        session.commit()

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    def override_admin():
        with TestingSession() as session:
            return session.query(User).filter(User.email == "admin@example.test").first()

    app = FastAPI()
    app.include_router(admin_accounts_phase6.router)
    app.dependency_overrides[admin_accounts_phase6.get_db] = override_db
    app.dependency_overrides[admin_accounts_phase6.require_admin] = override_admin

    with TestClient(app) as client:
        yield client, TestingSession


def test_user_query_filters_status_and_returns_lifecycle_summary(account_api):
    client, _ = account_api
    response = client.get("/admin/users/query", params={"status": "inactive"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["email"] == "inactive@example.test"
    assert payload["items"][0]["can_reactivate"] is True
    assert payload["summary"]["active"] == 7
    assert payload["summary"]["inactive"] == 1


def test_staff_query_is_paginated_and_server_filtered(account_api):
    client, _ = account_api
    response = client.get(
        "/admin/staff/query",
        params={"role": "admin", "page_size": 1, "page": 2},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["page"] == 2
    assert payload["total_pages"] == 2
    assert payload["summary"]["doctors"] == 1
    assert payload["summary"]["inactive"] == 0


def test_deactivation_invalidates_sessions_and_reactivation_keeps_old_sessions_invalid(account_api):
    client, TestingSession = account_api
    deactivate = client.put("/admin/users/3/status", json={"status": "Inactive"})
    assert deactivate.status_code == 200

    with TestingSession() as session:
        staff = session.query(User).filter(User.email == "staff@example.test").first()
        assert staff.status == "Inactive"
        assert staff.auth_invalid_before is not None
        invalid_before = staff.auth_invalid_before

    reactivate = client.put("/admin/users/3/status", json={"status": "Active"})
    assert reactivate.status_code == 200
    with TestingSession() as session:
        staff = session.query(User).filter(User.email == "staff@example.test").first()
        assert staff.status == "Active"
        assert staff.auth_invalid_before == invalid_before


def test_admin_cannot_deactivate_or_demote_self(account_api):
    client, _ = account_api
    status_response = client.put("/admin/staff/1/status", json={"status": "Inactive"})
    assert status_response.status_code == 409

    role_response = client.put(
        "/admin/staff/1",
        json={"full_name": "Admin Owner", "role": "staff"},
    )
    assert role_response.status_code == 409


def test_candidates_exclude_unverified_and_patient_history(account_api):
    client, _ = account_api
    response = client.get("/admin/staff/candidates/query")
    assert response.status_code == 200
    emails = {item["email"] for item in response.json()}
    assert "eligible@example.test" not in emails  # now has doctor-linked appointment as a patient
    assert "unverified@example.test" not in emails
    assert "history@example.test" not in emails


def test_promotion_requires_verified_active_account_without_patient_history(account_api):
    client, TestingSession = account_api
    unverified = client.post("/admin/staff/from-user", json={"user_id": 6, "role": "staff"})
    assert unverified.status_code == 409

    with TestingSession() as session:
        fresh = User(
            name="Fresh Candidate",
            email="fresh@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=True,
        )
        session.add(fresh)
        session.commit()
        session.refresh(fresh)
        fresh_id = fresh.id

    promoted = client.post("/admin/staff/from-user", json={"user_id": fresh_id, "role": "staff"})
    assert promoted.status_code == 200
    payload = promoted.json()
    assert payload["role"] == "staff"
    with TestingSession() as session:
        fresh = session.query(User).filter(User.id == fresh_id).first()
        assert fresh.auth_invalid_before is not None


def test_linked_doctor_cannot_be_changed_to_staff(account_api):
    client, _ = account_api
    response = client.put(
        "/admin/staff/4",
        json={
            "full_name": "Doctor Linked",
            "role": "staff",
            "department": "Front Desk",
            "specialty": "Dermatology",
        },
    )
    assert response.status_code == 409
    assert "appointment or schedule history" in response.json()["detail"]
