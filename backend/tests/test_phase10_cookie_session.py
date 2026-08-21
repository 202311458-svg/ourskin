from fastapi import Response

from app.main import app
from app.routes import auth_phase10
from app.routes.auth_phase2 import BROWSER_SESSION_MARKER


def test_phase10_google_routes_precede_legacy_routes():
    matching = [
        route
        for route in app.routes
        if getattr(route, "path", None) == "/auth/google/start"
        and "POST" in getattr(route, "methods", set())
    ]

    assert len(matching) >= 2
    assert matching[0].endpoint is auth_phase10.start_google_auth


def test_google_authenticated_result_sets_cookie_and_hides_bearer():
    response = Response()
    result = auth_phase10._cookie_auth_response(
        response,
        {
            "action": "authenticated",
            "access_token": "signed-jwt-that-must-not-reach-browser-js",
            "token_type": "bearer",
            "role": "doctor",
            "status": "Active",
        },
    )

    assert result["access_token"] == BROWSER_SESSION_MARKER
    assert result["token_type"] == "cookie"
    assert "signed-jwt-that-must-not-reach-browser-js" not in str(result)
    set_cookie = response.headers.get("set-cookie", "")
    assert set_cookie
    assert "HttpOnly" in set_cookie


def test_non_authenticated_google_result_is_not_mutated():
    response = Response()
    original = {
        "action": "link_required",
        "message": "Link required",
    }

    result = auth_phase10._cookie_auth_response(response, original)

    assert result == original
    assert response.headers.get("set-cookie") is None
