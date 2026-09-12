from __future__ import annotations

import os
import sys
from datetime import date, time
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
from app.models import (  # noqa: E402, F401
    appointment,
    audit_log,
    clinic_unavailable_date,
    diagnosis_report,
    doctor_schedule,
    service,
    skin_analysis,
    user,
)
from app.models.ai_analysis_run import AIAnalysisRun  # noqa: E402
from app.models.ai_clinical_evaluation import AIClinicalEvaluation  # noqa: E402
from app.models.ai_image_asset import AIImageAsset  # noqa: E402
from app.models.appointment import AppointmentModel  # noqa: E402
from app.models.audit_log import AuditLog  # noqa: E402
from app.models.dermatology_condition import DermatologyCondition  # noqa: E402
from app.models.diagnosis_report import DiagnosisReport  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routes import admin_data_phase3  # noqa: E402


@pytest.fixture()
def admin_data_api():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    app_db.Base.metadata.create_all(bind=engine)

    with TestingSession() as session:
        admin = User(
            name="Admin Operator",
            email="admin@example.test",
            password_hash="unused",
            role="admin",
            status="Active",
            is_verified=True,
        )
        doctor = User(
            name="Doctor Rivera",
            email="doctor@example.test",
            password_hash="unused",
            role="doctor",
            status="Active",
            is_verified=True,
            specialty="Dermatology",
        )
        adult = User(
            name="Adult Patient",
            first_name="Adult",
            last_name="Patient",
            email="adult@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=True,
            is_minor=False,
            contact="09170000001",
            address="Adult Street",
        )
        minor = User(
            name="Minor Patient",
            first_name="Minor",
            last_name="Patient",
            email="minor@example.test",
            password_hash="unused",
            role="patient",
            status="Active",
            is_verified=False,
            is_minor=True,
            contact="09170000002",
            address="Minor Street",
            guardian_first_name="Grace",
            guardian_last_name="Guardian",
            guardian_email="guardian@example.test",
            guardian_contact="09179999999",
            guardian_relationship="Parent",
            guardian_consent=True,
        )
        session.add_all([admin, doctor, adult, minor])
        session.flush()

        pending = AppointmentModel(
            patient_id=minor.id,
            patient_name=minor.name,
            patient_email=minor.email,
            patient_contact=minor.contact,
            patient_address=minor.address,
            services="Surgical Evaluation",
            concern="Persistent lesion",
            appointment_type="Initial Evaluation Request",
            is_initial_evaluation_request=True,
            status="Pending",
        )
        approved = AppointmentModel(
            patient_id=adult.id,
            doctor_id=doctor.id,
            patient_name=adult.name,
            patient_email=adult.email,
            patient_contact=adult.contact,
            patient_address=adult.address,
            doctor_name=doctor.name,
            date=date.today(),
            time=time(10, 0),
            end_time=time(11, 0),
            services="Dermatology Consultation",
            concern="Eczema follow-up",
            status="Approved",
        )
        completed = AppointmentModel(
            patient_id=adult.id,
            doctor_id=doctor.id,
            patient_name=adult.name,
            patient_email=adult.email,
            doctor_name=doctor.name,
            date=date.today(),
            time=time(11, 0),
            end_time=time(12, 0),
            services="Skin Review",
            concern="Resolved concern",
            status="Completed",
        )
        session.add_all([pending, approved, completed])
        session.flush()

        session.add_all(
            [
                AuditLog(
                    action="CREATE_STAFF",
                    description="Created staff account",
                    performed_by=admin.name,
                    actor_id=admin.id,
                    actor_role="admin",
                    target_id=doctor.id,
                    target_type="user",
                    target_record_id=str(doctor.id),
                ),
                AuditLog(
                    action="UPDATE_APPOINTMENT_STATUS",
                    description="Approved appointment",
                    performed_by=admin.name,
                    actor_id=admin.id,
                    actor_role="admin",
                    target_type="appointment",
                    target_record_id=str(approved.id),
                ),
                AuditLog(
                    action="AI_ANALYSIS_REVIEW",
                    description="Reviewed AI result",
                    performed_by=doctor.name,
                    actor_id=doctor.id,
                    actor_role="doctor",
                    target_type="ai_analysis",
                    target_record_id="1",
                ),
            ]
        )

        condition = DermatologyCondition(
            code="ECZEMA",
            display_name="Eczema",
            category="Inflammatory",
            support_level="SUPPORTED",
            image_assessment_supported=True,
        )
        session.add(condition)
        session.flush()

        image = AIImageAsset(
            appointment_id=approved.id,
            uploaded_by_id=doctor.id,
            storage_path="private/phase3-test.png",
            content_type="image/png",
            source_format="PNG",
            original_extension="png",
            width=640,
            height=480,
        )
        session.add(image)
        session.flush()

        run = AIAnalysisRun(
            appointment_id=approved.id,
            image_asset_id=image.id,
            created_by_id=doctor.id,
            primary_condition_id=condition.id,
            analysis_mode="DERMATOLOGY_ASSESSMENT",
            status="COMPLETED",
            evidence_strength="MODERATE",
            model_provider="openai",
            model_id="phase3-test-model",
            pipeline_version="phase3-test",
            taxonomy_version="phase3-test",
            review_status="REVIEWED",
        )
        session.add(run)
        session.flush()

        report = DiagnosisReport(
            appointment_id=approved.id,
            patient_id=adult.id,
            doctor_id=doctor.id,
            ai_analysis_run_id=run.id,
            doctor_final_diagnosis="Eczema",
        )
        session.add(report)
        session.flush()

        session.add(
            AIClinicalEvaluation(
                ai_analysis_run_id=run.id,
                appointment_id=approved.id,
                diagnosis_report_id=report.id,
                doctor_id=doctor.id,
                diagnosis_agreement="AGREE",
                ai_status="COMPLETED",
                ai_evidence_strength="MODERATE",
                ai_primary_condition_code="ECZEMA",
                ai_primary_condition_display="Eczema",
                doctor_final_diagnosis="Eczema",
                medication_suggestions_present=False,
            )
        )
        session.commit()

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    test_app = FastAPI()
    test_app.include_router(admin_data_phase3.router)
    test_app.dependency_overrides[admin_data_phase3.get_db] = override_db
    test_app.dependency_overrides[admin_data_phase3.require_admin] = lambda: object()

    with TestClient(test_app) as client:
        yield client


def test_users_query_filters_across_full_dataset_and_returns_global_summary(admin_data_api):
    response = admin_data_api.get(
        "/admin/users/query",
        params={"search": "guardian@example.test", "patient_type": "minor"},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 1
    assert payload["items"][0]["email"] == "minor@example.test"
    assert payload["summary"] == {
        "total": 4,
        "patients": 2,
        "internal": 2,
        "verified": 3,
        "minors": 1,
    }


def test_appointments_query_applies_server_filters_and_keeps_global_summary(admin_data_api):
    response = admin_data_api.get(
        "/admin/appointments/query",
        params={"search": "Dermatology", "status": "approved", "page_size": 1},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 1
    assert payload["total_pages"] == 1
    assert payload["items"][0]["status"] == "Approved"
    assert payload["summary"] == {
        "total": 3,
        "pending": 1,
        "initial_evaluation": 1,
        "approved": 1,
    }


def test_audit_query_filters_by_backend_classification_and_returns_global_counts(admin_data_api):
    response = admin_data_api.get(
        "/admin/audit-logs/query",
        params={"module": "Appointments", "action_type": "update"},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 1
    assert payload["items"][0]["module"] == "Appointments"
    assert payload["items"][0]["action_type"] == "update"
    assert payload["summary"]["total"] == 3
    assert payload["summary"]["account"] == 1
    assert payload["summary"]["appointment"] == 1
    assert payload["summary"]["medical"] == 1


def test_ai_monitor_search_is_server_side_and_combines_with_agreement_filter(admin_data_api):
    response = admin_data_api.get(
        "/admin/ai-monitor/query",
        params={"search": "eczema", "agreement": "AGREE"},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 1
    assert payload["items"][0]["primary_condition_display"] == "Eczema"
    assert payload["items"][0]["diagnosis_agreement"] == "AGREE"
    assert payload["items"][0]["model_id"] == "phase3-test-model"
