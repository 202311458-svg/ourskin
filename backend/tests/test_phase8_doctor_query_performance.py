from __future__ import annotations

from datetime import timedelta

from app.core.clock import clinic_today


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_patient_records_are_bounded_and_include_report_context(clinical_api):
    client = clinical_api["client"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    response = client.get("/doctor/patient-records?limit=1&offset=0", headers=headers)

    assert response.status_code == 200
    items = response.json()
    assert len(items) <= 1
    if items:
        assert "appointment" in items[0]
        assert "analyses" in items[0]
        assert "diagnosis_report" in items[0]


def test_doctor_ai_cases_have_bounded_pagination(clinical_api):
    client = clinical_api["client"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    response = client.get("/doctor/ai-cases?limit=1&offset=0", headers=headers)

    assert response.status_code == 200
    assert len(response.json()) <= 1


def test_follow_up_lists_have_bounded_pagination(clinical_api):
    client = clinical_api["client"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    response = client.get("/doctor/follow-ups?limit=1&offset=0", headers=headers)

    assert response.status_code == 200
    assert len(response.json()) <= 1


def test_follow_up_creation_rejects_clinic_past_date(clinical_api):
    client = clinical_api["client"]
    ids = clinical_api["ids"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    response = client.post(
        "/doctor/follow-ups",
        headers=headers,
        json={
            "appointment_id": ids["appointment_a"],
            "follow_up_date": (clinic_today() - timedelta(days=1)).isoformat(),
            "reason": "Synthetic past follow-up",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Follow-up date cannot be in the past"
