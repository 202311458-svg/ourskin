from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.db import SessionLocal
from app.models.user import User
from app.core.security import decode_access_token
from app.schemas.user import UserProfileUpdate

router = APIRouter(prefix="/users", tags=["Users"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_authenticated_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(token)
    email = payload.get("sub")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


def build_user_response(current_user: User):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "date_of_birth": current_user.date_of_birth,
        "is_minor": current_user.is_minor,
        "address": current_user.address,
        "email": current_user.email,
        "contact": current_user.contact,
        "role": current_user.role,
        "status": current_user.status,
        "department": current_user.department,
        "profile_image": current_user.profile_image,
        "specialty": current_user.specialty,
        "availability": current_user.availability,
        "bio": current_user.bio,
        "guardian_first_name": current_user.guardian_first_name,
        "guardian_last_name": current_user.guardian_last_name,
        "guardian_relationship": current_user.guardian_relationship,
        "guardian_contact": current_user.guardian_contact,
        "guardian_email": current_user.guardian_email,
        "guardian_consent": current_user.guardian_consent,
    }


@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_authenticated_user)):
    return build_user_response(current_user)


@router.put("/me")
def update_current_user_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()

        setattr(current_user, field, value)

    if current_user.first_name or current_user.last_name:
        first_name = current_user.first_name or ""
        last_name = current_user.last_name or ""
        full_name = f"{first_name} {last_name}".strip()

        if full_name:
            current_user.name = full_name

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user": build_user_response(current_user),
    }