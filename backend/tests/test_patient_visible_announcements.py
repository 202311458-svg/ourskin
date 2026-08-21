from datetime import datetime, timedelta, timezone

from app.models.announcement import Announcement


def make_announcement(title: str, **overrides):
    values = {
        "title": title,
        "message": f"{title} message",
        "category": "Clinic Notice",
        "priority": "Normal",
        "status": "Published",
        "is_pinned": False,
        "starts_at": None,
        "expires_at": None,
    }
    values.update(overrides)
    return Announcement(**values)


def test_patient_visible_announcements_only_returns_currently_published_items(
    clinical_api,
):
    now = datetime.now(timezone.utc)
    session_factory = clinical_api["session_factory"]

    with session_factory() as session:
        session.add_all(
            [
                make_announcement("Always visible"),
                make_announcement(
                    "Active window",
                    starts_at=now - timedelta(days=1),
                    expires_at=now + timedelta(days=1),
                ),
                make_announcement(
                    "Starts later",
                    starts_at=now + timedelta(days=1),
                ),
                make_announcement(
                    "Already expired",
                    expires_at=now - timedelta(days=1),
                ),
                make_announcement("Draft item", status="Draft"),
                make_announcement("Archived item", status="Archived"),
            ]
        )
        session.commit()

    response = clinical_api["client"].get("/announcements/patient-visible")

    assert response.status_code == 200
    assert {item["title"] for item in response.json()} == {
        "Always visible",
        "Active window",
    }


def test_patient_visible_announcements_orders_pinned_items_first(clinical_api):
    session_factory = clinical_api["session_factory"]

    with session_factory() as session:
        session.add_all(
            [
                make_announcement("Regular urgent", priority="Urgent"),
                make_announcement("Pinned normal", is_pinned=True),
            ]
        )
        session.commit()

    response = clinical_api["client"].get("/announcements/patient-visible")

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == [
        "Pinned normal",
        "Regular urgent",
    ]