from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routes import (
    admin_integrity_phase9,
    admin_performance_phase9,
    announcement_integrity_phase9,
)


def test_phase9_account_routes_are_registered():
    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in admin_integrity_phase9.router.routes
    }
    assert ("/admin/users/{user_id}/status", ("PUT",)) in paths
    assert ("/admin/staff/{staff_id}/status", ("PUT",)) in paths
    assert ("/admin/staff/from-user", ("POST",)) in paths
    assert ("/admin/staff/{staff_id}", ("PUT",)) in paths


def test_phase9_performance_routes_preserve_admin_contracts():
    paths = {route.path for route in admin_performance_phase9.router.routes}
    assert "/admin/dashboard" in paths
    assert "/admin/appointments/query" in paths


def test_canonical_appointment_status_supports_ui_variants():
    mapping = admin_performance_phase9.STATUS_CANONICAL
    assert mapping["pending"] == "Pending"
    assert mapping["cancelled"] == "Cancelled"
    assert mapping["canceled"] == "Cancelled"
    assert mapping["no-show"] == "No-Show"
    assert mapping["no_show"] == "No-Show"


def test_self_admin_access_removal_is_rejected():
    user = SimpleNamespace(id=7)
    with pytest.raises(HTTPException) as exc:
        admin_integrity_phase9._assert_admin_access_change_allowed(
            user,
            user,
            removing_active_admin_access=True,
        )
    assert exc.value.status_code == 409


def test_announcement_mutations_are_owned_by_phase9():
    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in announcement_integrity_phase9.router.routes
    }
    assert ("/announcements/", ("POST",)) in paths
    assert ("/announcements/{announcement_id}", ("PATCH",)) in paths
    assert ("/announcements/{announcement_id}/archive", ("PATCH",)) in paths
    assert ("/announcements/{announcement_id}", ("DELETE",)) in paths
