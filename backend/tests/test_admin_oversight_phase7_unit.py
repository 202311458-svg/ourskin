from app.routes.admin_ai_oversight_phase7 import _pct
from app.routes.admin_audit_phase7 import _audit_classification


def test_audit_status_update_uses_status_classification():
    module, action_type = _audit_classification("UPDATE_APPOINTMENT_STATUS")
    assert module == "Appointments"
    assert action_type == "status"


def test_audit_account_access_change_is_status_action():
    module, action_type = _audit_classification("DEACTIVATE_ACCOUNT")
    assert module == "Account Management"
    assert action_type == "status"


def test_ai_percentage_helper_handles_empty_denominator():
    assert _pct(0, 0) is None
    assert _pct(3, 4) == 75.0
