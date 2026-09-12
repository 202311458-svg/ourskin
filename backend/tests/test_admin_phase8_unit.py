from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.routes.admin_comms_profile_phase8 import _announcement_visibility


def test_announcement_visibility_states():
    now = datetime.now(timezone.utc)
    visible = SimpleNamespace(status="Published", starts_at=None, expires_at=None)
    scheduled = SimpleNamespace(status="Published", starts_at=now + timedelta(hours=1), expires_at=None)
    expired = SimpleNamespace(status="Published", starts_at=None, expires_at=now - timedelta(hours=1))
    draft = SimpleNamespace(status="Draft", starts_at=None, expires_at=None)

    assert _announcement_visibility(visible, now) == "visible"
    assert _announcement_visibility(scheduled, now) == "scheduled"
    assert _announcement_visibility(expired, now) == "expired"
    assert _announcement_visibility(draft, now) == "not_visible"
