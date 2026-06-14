from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import User
from app.core.security import get_current_user


router = APIRouter(prefix="/patients", tags=["Patients"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_staff_or_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Staff or admin access only.",
        )

    return current_user


def serialize_patient(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "contact": user.contact,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "is_minor": user.is_minor,
        "address": user.address,
        "status": user.status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/")
def get_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    patients = (
        db.query(User)
        .filter(User.role == "patient")
        .order_by(User.created_at.desc())
        .all()
    )

    return [serialize_patient(patient) for patient in patients]