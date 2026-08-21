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

# Configuration remains required even in tests. These values are synthetic and
# are established before importing the application modules.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-only-signing-key-with-at-least-32-bytes")
os.environ.setdefault("JWT_ISSUER", "os-coms-test")
os.environ.setdefault("JWT_AUDIENCE", "os-coms-test-api")

from app import db as app_db  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.models import (  # noqa: E402, F401
    announcement,
    appointment,
    appointment_log,
    audit_log,
    clinic_unavailable_date,
    diagnosis_report,
    doctor_schedule,
    doctor_service,
    follow_up,
    notification,
    service,
    skin_analysis,
    user,
)
from app.models.appointment import AppointmentModel  # noqa: E402
from app.models.appointment_log import AppointmentLog  # noqa: E402
from app.models.diagnosis_report import DiagnosisReport  # noqa: E402
from app.models.follow_up import FollowUp  # noqa: E402
from app.models.skin_analysis import SkinAnalysis  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routes import ai_analysis, announcements, appointments, auth, doctor, notifications  # noqa: E402


@pytest.fixture()
def clinical_api(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    app_db.Base.metadata.create_all(bind=engine)

    with TestingSession() as session:
        users = {
            "doctor_a": User(
                name="Synthetic Doctor A",
                email="doctor.a@example.test",
                password_hash="unused",
                role="doctor",
                status="Active",
                is_verified=True,
            ),
            "doctor_b": User(
                name="Synthetic Doctor B",
                email="doctor.b@example.test",
                password_hash="unused",
                role="doctor",
                status="Active",
                is_verified=True,
            ),
            "patient_a": User(
                name="Synthetic Patient A",
                email="patient.a@example.test",
                password_hash="unused",
                role="patient",
                status="Active",
                is_verified=True,
            ),
            "patient_b": User(
                name="Synthetic Patient B",
                email="patient.b@example.test",
                password_hash="unused",
                role="patient",
                status="Active",
                is_verified=True,
            ),
            "staff": User(
                name="Synthetic Staff",
                email="staff@example.test",
                password_hash="unused",
                role="staff",
                status="Active",
                is_verified=True,
            ),
            "admin": User(
                name="Synthetic Admin",
                email="admin@example.test",
                password_hash="unused",
                role="admin",
                status="Active",
                is_verified=True,
            ),
            "inactive_doctor": User(
                name="Synthetic Inactive Doctor",
                email="inactive.doctor@example.test",
                password_hash="unused",
                role="doctor",
                status="Inactive",
                is_verified=True,
            ),
        }
        session.add_all(users.values())
        session.flush()

        appointment_a = AppointmentModel(
            patient_id=users["patient_a"].id,
            doctor_id=users["doctor_a"].id,
            patient_name=users["patient_a"].name,
            patient_email=users["patient_a"].email,
            patient_contact="09000000001",
            patient_address="Synthetic Address A",
            doctor_name=users["doctor_a"].name,
            date=date.today(),
            time=time(9, 0),
            end_time=time(10, 0),
            services="Synthetic Consultation A",
            concern="Synthetic concern A",
            status="Approved",
        )
        appointment_b = AppointmentModel(
            patient_id=users["patient_b"].id,
            doctor_id=users["doctor_b"].id,
            patient_name=users["patient_b"].name,
            patient_email=users["patient_b"].email,
            patient_contact="09000000002",
            patient_address="Synthetic Address B",
            doctor_name=users["doctor_b"].name,
            date=date.today(),
            time=time(10, 0),
            end_time=time(11, 0),
            services="Synthetic Consultation B",
            concern="Synthetic concern B",
            status="Approved",
        )
        pending = AppointmentModel(
            patient_id=users["patient_a"].id,
            patient_name=users["patient_a"].name,
            patient_email=users["patient_a"].email,
            patient_contact="09000000001",
            patient_address="Synthetic Address A",
            services="Synthetic Pending Service",
            concern="Sensitive synthetic concern",
            status="Pending",
        )
        session.add_all([appointment_a, appointment_b, pending])
        session.flush()

        analyses = {
            "a": SkinAnalysis(
                appointment_id=appointment_a.id,
                image_path="private/synthetic-a.png",
                condition="Synthetic result A",
                review_status="Pending Review",
            ),
            "b": SkinAnalysis(
                appointment_id=appointment_b.id,
                image_path="private/synthetic-b.png",
                condition="Synthetic result B",
                review_status="Pending Review",
            ),
        }
        session.add_all(analyses.values())
        session.add_all(
            [
                DiagnosisReport(
                    appointment_id=appointment_a.id,
                    patient_id=users["patient_a"].id,
                    doctor_id=users["doctor_a"].id,
                    doctor_final_diagnosis="Synthetic clinical report A",
                ),
                DiagnosisReport(
                    appointment_id=appointment_b.id,
                    patient_id=users["patient_b"].id,
                    doctor_id=users["doctor_b"].id,
                    doctor_final_diagnosis="Synthetic clinical report B",
                ),
                FollowUp(
                    appointment_id=appointment_b.id,
                    patient_id=users["patient_b"].id,
                    doctor_id=users["doctor_b"].id,
                    follow_up_date=date.today() + timedelta(days=2),
                    reason="Synthetic follow-up B",
                    status="Scheduled",
                ),
                AppointmentLog(
                    appointment_id=appointment_b.id,
                    action="Created",
                    performed_by_id=users["patient_b"].id,
                    performed_by_name=users["patient_b"].name,
                    performed_by_role="patient",
                ),
            ]
        )
        session.commit()

        ids = {
            "appointment_a": appointment_a.id,
            "appointment_b": appointment_b.id,
            "pending": pending.id,
            "analysis_a": analyses["a"].id,
            "analysis_b": analyses["b"].id,
            **{name: item.id for name, item in users.items()},
        }

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    test_app = FastAPI()
    test_app.include_router(appointments.router)
    test_app.include_router(doctor.router)
    test_app.include_router(ai_analysis.router)
    test_app.include_router(announcements.router)
    test_app.include_router(auth.router)
    test_app.include_router(notifications.router)
    test_app.dependency_overrides[app_db.get_db] = override_db
    test_app.dependency_overrides[appointments.get_db] = override_db
    test_app.dependency_overrides[doctor.get_db] = override_db
    test_app.dependency_overrides[ai_analysis.get_db] = override_db
    test_app.dependency_overrides[announcements.get_db] = override_db
    test_app.dependency_overrides[auth.get_db] = override_db
    test_app.dependency_overrides[notifications.get_db] = override_db

    monkeypatch.setattr(
        doctor,
        "create_signed_image_url",
        lambda path: f"https://signed.invalid/{path}" if path else None,
    )
    monkeypatch.setattr(
        ai_analysis,
        "create_signed_image_url",
        lambda path: f"https://signed.invalid/{path}" if path else None,
    )

    tokens = {
        name: create_access_token({"sub": item.email})
        for name, item in users.items()
    }

    with TestClient(test_app) as client:
        yield {
            "client": client,
            "ids": ids,
            "tokens": tokens,
            "session_factory": TestingSession,
        }

    app_db.Base.metadata.drop_all(bind=engine)
    engine.dispose()