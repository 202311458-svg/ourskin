from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.db import SessionLocal
from app.models.user import User
from app.core.security import decode_access_token
from app.schemas.user import DoctorProfileUpdate

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


@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_authenticated_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "contact": current_user.contact,
        "role": current_user.role,
        "status": current_user.status,
        "department": current_user.department,
        "profile_image": current_user.profile_image,
        "specialty": current_user.specialty,
        "availability": current_user.availability,
        "bio": current_user.bio,
    }


@router.put("/me")
def update_current_user_profile(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "contact": current_user.contact,
            "role": current_user.role,
            "status": current_user.status,
            "department": current_user.department,
            "profile_image": current_user.profile_image,
            "specialty": current_user.specialty,
            "availability": current_user.availability,
            "bio": current_user.bio,
        },
    }