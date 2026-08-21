from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.security import set_session_cookie
from app.db import get_db
from app.routes import auth as legacy_auth
from app.routes.auth_phase2 import BROWSER_SESSION_MARKER
from app.schemas.user import GoogleCredentialRequest, GoogleLinkRequest, GooglePatientRegistration

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _cookie_auth_response(response: Response, result: dict) -> dict:
    if result.get("action") != "authenticated":
        return result

    token = result.get("access_token")
    if not token:
        return result

    set_session_cookie(response, token)
    return {
        **result,
        "access_token": BROWSER_SESSION_MARKER,
        "token_type": "cookie",
    }


@router.post("/google/start")
def start_google_auth(
    data: GoogleCredentialRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    result = legacy_auth.start_google_auth(data=data, db=db)
    return _cookie_auth_response(response, result)


@router.post("/google/link")
def link_google_account(
    data: GoogleLinkRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    result = legacy_auth.link_google_account(data=data, db=db)
    return _cookie_auth_response(response, result)


@router.post("/google/register", status_code=status.HTTP_201_CREATED)
def register_with_google(
    data: GooglePatientRegistration,
    response: Response,
    db: Session = Depends(get_db),
):
    result = legacy_auth.register_with_google(data=data, db=db)
    return _cookie_auth_response(response, result)
