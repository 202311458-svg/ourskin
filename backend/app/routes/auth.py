from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta, timezone
import re
import secrets

from app.db import SessionLocal
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.core.email import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_password(password: str):
    pattern = r"^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
    if not re.match(pattern, password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters, include uppercase, number, and special character",
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email.lower()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    validate_password(user.password)

    token = secrets.token_urlsafe(32)

    new_user = User(
        name=user.name,
        email=user.email.lower(),
        contact=user.contact,
        password_hash=hash_password(user.password),
        role="patient",
        is_verified=False,
        verification_token=token,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    try:
        send_verification_email(new_user.email, token)
    except Exception as e:
        print("Verification email failed:", e)
        raise HTTPException(
            status_code=500,
            detail=f"Account created, but verification email could not be sent: {str(e)}",
        )

    return {
        "message": "Account created. Please verify your email before logging in."
    }


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return {"message": "Email verified successfully. You can now login."}


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.email == form_data.username.lower()).first()

    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not db_user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    token = create_access_token({"sub": db_user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": db_user.role,
    }


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the old password",
        )

    validate_password(data.new_password)

    user.password_hash = hash_password(data.new_password)

    db.commit()
    db.refresh(user)

    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()

    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()

        try:
            send_password_reset_email(user.email, token)
        except Exception as e:
            print("Password reset email failed:", e)
            raise HTTPException(
                status_code=500,
                detail=f"Could not send password reset email: {str(e)}",
            )

    return {
        "message": "If an account exists for this email, a reset link has been sent."
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()

    cooldown_seconds = 60
    now = datetime.now(timezone.utc)

    if user:
        if user.reset_requested_at:
            last_request = user.reset_requested_at

            if last_request.tzinfo is None:
                last_request = last_request.replace(tzinfo=timezone.utc)

            seconds_since_last_request = (now - last_request).total_seconds()

            if seconds_since_last_request < cooldown_seconds:
                remaining = int(cooldown_seconds - seconds_since_last_request)
                raise HTTPException(
                    status_code=429,
                    detail={
                        "message": f"Please wait {remaining} seconds before requesting another reset link.",
                        "retry_after": remaining,
                    },
                )

        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = now + timedelta(hours=1)
        user.reset_requested_at = now
        db.commit()

        try:
            send_password_reset_email(user.email, token)
        except Exception as e:
            print("Password reset email failed:", e)
            raise HTTPException(
                status_code=500,
                detail=f"Could not send password reset email: {str(e)}",
            )

    return {
        "message": "If an account exists for this email, a reset link has been sent."
    }