from sqlalchemy import Integer

from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementResponse


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_announcement_creator_column_matches_integer_user_ids():
    column = Announcement.__table__.c.created_by
    assert isinstance(column.type, Integer)
    assert any(
        foreign_key.target_fullname == "users.id"
        for foreign_key in column.foreign_keys
    )


def test_staff_announcement_records_real_creator_id(clinical_api):
    response = clinical_api["client"].post(
        "/announcements/",
        headers=auth(clinical_api["tokens"]["staff"]),
        json={
            "title": "Phase 7 creator attribution",
            "message": "Announcement creator IDs should reference the authenticated user.",
            "category": "Clinic Notice",
            "priority": "Normal",
            "status": "Draft",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["created_by"], int)
    assert payload["created_by"] > 0
    assert payload["created_by_role"] == "staff"


def test_announcement_response_accepts_integer_creator_id():
    fields = AnnouncementResponse.model_fields
    assert fields["created_by"].annotation == (int | None)
