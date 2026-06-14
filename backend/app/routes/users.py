from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import User
from app.core.security import get_current_user
from app.schemas.user import UserProfileUpdate


router = APIRouter(prefix="/users", tags=["Users"])


PATIENT_ALLOWED_PROFILE_FIELDS = {
    "first_name",
    "last_name",
    "contact",
    "address",
    "profile_image",
}

DOCTOR_ALLOWED_PROFILE_FIELDS = {
    "name",
    "contact",
    "profile_image",
    "specialty",
    "availability",
    "bio",
}

STAFF_ALLOWED_PROFILE_FIELDS = {
    "name",
    "contact",
    "profile_image",
}

ADMIN_ALLOWED_PROFILE_FIELDS = {
    "name",
    "contact",
    "profile_image",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_allowed_profile_fields(role: str):
    if role == "patient":
        return PATIENT_ALLOWED_PROFILE_FIELDS

    if role == "doctor":
        return DOCTOR_ALLOWED_PROFILE_FIELDS

    if role == "staff":
        return STAFF_ALLOWED_PROFILE_FIELDS

    if role == "admin":
        return ADMIN_ALLOWED_PROFILE_FIELDS

    return set()


def build_user_response(current_user: User):
    response = {
        "id": current_user.id,
        "name": current_user.name,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "contact": current_user.contact,
        "role": current_user.role,
        "status": current_user.status,
        "profile_image": current_user.profile_image,
    }

    if current_user.role == "patient":
        response.update(
            {
                "date_of_birth": current_user.date_of_birth,
                "is_minor": current_user.is_minor,
                "address": current_user.address,
                "guardian_first_name": current_user.guardian_first_name,
                "guardian_last_name": current_user.guardian_last_name,
                "guardian_relationship": current_user.guardian_relationship,
                "guardian_contact": current_user.guardian_contact,
                "guardian_email": current_user.guardian_email,
                "guardian_consent": current_user.guardian_consent,
            }
        )

    if current_user.role == "doctor":
        response.update(
            {
                "specialty": current_user.specialty,
                "availability": current_user.availability,
                "bio": current_user.bio,
            }
        )

    if current_user.role in ["staff", "admin"]:
        response.update(
            {
                "department": current_user.department,
            }
        )

    return response


@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    return build_user_response(current_user)


@router.put("/me")
def update_current_user_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)

    allowed_fields = get_allowed_profile_fields(current_user.role)

    blocked_fields = [
        field
        for field in updates.keys()
        if field not in allowed_fields
    ]

    if blocked_fields:
        raise HTTPException(
            status_code=403,
            detail=f"You are not allowed to update these fields: {', '.join(blocked_fields)}",
        )

    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()

        setattr(current_user, field, value)

    if current_user.role == "patient":
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