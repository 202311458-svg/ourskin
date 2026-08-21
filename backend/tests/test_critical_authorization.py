from __future__ import annotations

from datetime import date, timedelta


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_doctor_lists_are_scoped_at_query_level(clinical_api):
    client = clinical_api["client"]
    ids = clinical_api["ids"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    appointments = client.get("/doctor/appointments", headers=headers)
    assert appointments.status_code == 200
    assert {item["id"] for item in appointments.json()} == {ids["appointment_a"]}

    records = client.get("/doctor/patient-records", headers=headers)
    assert records.status_code == 200
    assert {item["appointment"]["id"] for item in records.json()} == {
        ids["appointment_a"]
    }

    ai_cases = client.get("/doctor/ai-cases", headers=headers)
    assert ai_cases.status_code == 200
    assert {item["id"] for item in ai_cases.json()} == {ids["analysis_a"]}


def test_doctor_cannot_read_other_doctors_objects(clinical_api):
    client = clinical_api["client"]
    ids = clinical_api["ids"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    paths = [
        f"/appointments/{ids['appointment_b']}",
        f"/appointments/{ids['appointment_b']}/logs",
        f"/doctor/appointments/{ids['appointment_b']}/diagnosis-report",
        f"/doctor/appointments/{ids['appointment_b']}/patient-history",
        f"/doctor/patients/{ids['patient_b']}/history",
        f"/ai/appointment/{ids['appointment_b']}",
    ]

    for path in paths:
        response = client.get(path, headers=headers)
        assert response.status_code == 404, path


def test_doctor_cannot_modify_other_doctors_resources(clinical_api):
    client = clinical_api["client"]
    ids = clinical_api["ids"]
    headers = auth(clinical_api["tokens"]["doctor_a"])

    status_update = client.put(
        f"/doctor/appointments/{ids['appointment_b']}/status",
        headers=headers,
        json={"status": "Declined", "cancel_reason": "Synthetic reason"},
    )
    assert status_update.status_code == 404

    shared_status_update = client.put(
        f"/appointments/{ids['appointment_b']}/status",
        headers=headers,
        json={"status": "Cancelled", "cancel_reason": "Synthetic reason"},
    )
    assert shared_status_update.status_code == 404

    ai_review = client.put(
        f"/ai/review/{ids['analysis_b']}",
        headers=headers,
        json={"review_status": "Reviewed"},
    )
    assert ai_review.status_code == 404

    follow_up = client.post(
        "/doctor/follow-ups",
        headers=headers,
        json={
            "appointment_id": ids["appointment_b"],
            "follow_up_date": (date.today() + timedelta(days=3)).isoformat(),
            "reason": "Synthetic unauthorized follow-up",
        },
    )
    assert follow_up.status_code == 404


def test_staff_feeds_enforce_role_matrix_and_minimize_phi(clinical_api):
    client = clinical_api["client"]
    tokens = clinical_api["tokens"]

    for path in ("/appointments/today", "/appointments/requests", "/appointments/confirmed"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=auth(tokens["patient_a"])).status_code == 403
        assert client.get(path, headers=auth(tokens["doctor_a"])).status_code == 403
        assert client.get(path, headers=auth(tokens["staff"])).status_code == 200
        assert client.get(path, headers=auth(tokens["admin"])).status_code == 200

    response = client.get(
        "/appointments/requests", headers=auth(tokens["staff"])
    )
    assert response.status_code == 200
    item = response.json()[0]
    assert item["patient_name"] == "Synthetic Patient A"
    forbidden_fields = {
        "patient_email",
        "patient_contact",
        "patient_address",
        "patient_age",
        "patient_age_label",
        "is_minor",
        "guardian_first_name",
        "guardian_last_name",
        "guardian_relationship",
        "guardian_contact",
        "guardian_email",
        "guardian_consent",
        "concern",
        "cancel_reason",
        "patient_instruction",
    }
    assert forbidden_fields.isdisjoint(item)


def test_inactive_user_is_rejected(clinical_api):
    response = clinical_api["client"].get(
        "/doctor/appointments",
        headers=auth(clinical_api["tokens"]["inactive_doctor"]),
    )
    assert response.status_code == 403


def test_doctor_cannot_bypass_report_workflow_with_generic_completion(clinical_api):
    response = clinical_api["client"].put(
        f"/appointments/{clinical_api['ids']['appointment_a']}/status",
        headers=auth(clinical_api["tokens"]["doctor_a"]),
        json={"status": "Completed"},
    )
    assert response.status_code == 400


def test_staff_history_enforces_role_matrix_and_pagination(clinical_api):
    client = clinical_api["client"]
    tokens = clinical_api["tokens"]

    assert client.get("/appointments/history").status_code == 401
    assert client.get(
        "/appointments/history", headers=auth(tokens["patient_a"])
    ).status_code == 403
    assert client.get(
        "/appointments/history", headers=auth(tokens["doctor_a"])
    ).status_code == 403

    for role in ("staff", "admin"):
        response = client.get(
            "/appointments/history?page=1&page_size=1",
            headers=auth(tokens[role]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 1
        assert data["total"] >= 2
        assert len(data["items"]) == 1
        assert "last_action_by_name" in data["items"][0]
        assert "last_action_by_role" in data["items"][0]


def test_doctor_cannot_manage_announcements(clinical_api):
    client = clinical_api["client"]
    tokens = clinical_api["tokens"]
    payload = {
        "title": "Synthetic Clinic Notice",
        "message": "Synthetic announcement content for authorization testing.",
        "category": "Clinic Notice",
        "priority": "Normal",
        "status": "Draft",
    }

    assert client.post("/announcements/", json=payload).status_code == 401
    assert client.post(
        "/announcements/", headers=auth(tokens["patient_a"]), json=payload
    ).status_code == 403
    assert client.post(
        "/announcements/", headers=auth(tokens["doctor_a"]), json=payload
    ).status_code == 403

    for role in ("staff", "admin"):
        response = client.post(
            "/announcements/", headers=auth(tokens[role]), json=payload
        )
        assert response.status_code == 200
        assert response.json()["created_by_role"] == role