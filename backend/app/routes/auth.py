from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta, timezone, date
from typing import Optional
import secrets
import re

from email_validator import validate_email, EmailNotValidError

from app.db import SessionLocal
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    GoogleCredentialRequest,
    GoogleLinkRequest,
    GooglePatientRegistration,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    hash_token,
)
from app.core.email import send_verification_email, send_password_reset_email
from app.services.google_auth_service import (
    create_google_onboarding_token,
    decode_google_onboarding_token,
    verify_google_credential,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""

    return value.strip()


def validate_password(password: str):
    pattern = r"^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"

    if not re.match(pattern, password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters, include uppercase, number, and special character.",
        )


def validate_contact_number(contact: str, field_name: str = "Contact number"):
    contact = clean_text(contact)

    pattern = r"^(09\d{9}|\+639\d{9})$"

    if not re.match(pattern, contact):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a valid Philippine mobile number. Example: 09123456789 or +639123456789.",
        )

    return contact


def calculate_age_in_months(date_of_birth: date) -> int:
    today = date.today()

    months = (today.year - date_of_birth.year) * 12 + (
        today.month - date_of_birth.month
    )

    if today.day < date_of_birth.day:
        months -= 1

    return months


def check_if_minor(date_of_birth: date) -> bool:
    today = date.today()

    try:
        eighteenth_birthday = date_of_birth.replace(
            year=date_of_birth.year + 18
        )
    except ValueError:
        eighteenth_birthday = date_of_birth.replace(
            year=date_of_birth.year + 18,
            month=2,
            day=28,
        )

    return today < eighteenth_birthday


def validate_deliverable_email(email: str) -> str:
    try:
        result = validate_email(email, check_deliverability=True)
        return result.normalized.lower()

    except EmailNotValidError:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address that can receive verification emails.",
        )


def build_auth_response(user: User):
    return {
        "access_token": create_access_token({"sub": user.email}),
        "token_type": "bearer",
        "role": user.role,
        "status": user.status,
    }


def validate_patient_profile(data, account_email: str):
    first_name = clean_text(data.first_name)
    last_name = clean_text(data.last_name)
    address = clean_text(data.address)

    if len(first_name) < 2:
        raise HTTPException(status_code=400, detail="First name must be at least 2 characters.")
    if len(last_name) < 2:
        raise HTTPException(status_code=400, detail="Last name must be at least 2 characters.")
    if len(address) < 5:
        raise HTTPException(status_code=400, detail="Complete address is required.")

    age_in_months = calculate_age_in_months(data.date_of_birth)
    if age_in_months < 3:
        raise HTTPException(status_code=400, detail="Patient must be at least 3 months old to register.")

    is_minor = check_if_minor(data.date_of_birth)
    if is_minor:
        guardian_first_name = clean_text(data.guardian_first_name)
        guardian_last_name = clean_text(data.guardian_last_name)
        guardian_relationship = clean_text(data.guardian_relationship)
        guardian_contact = clean_text(data.guardian_contact)

        if len(guardian_first_name) < 2 or len(guardian_last_name) < 2:
            raise HTTPException(status_code=400, detail="Parent or guardian name is required for minor patients.")
        if not guardian_relationship:
            raise HTTPException(status_code=400, detail="Relationship to patient is required for minor patients.")
        if not guardian_contact:
            raise HTTPException(status_code=400, detail="Guardian contact number is required for minor patients.")
        if not data.guardian_email:
            raise HTTPException(status_code=400, detail="Guardian email is required for minor patients.")
        if str(data.guardian_email).strip().lower() != account_email:
            raise HTTPException(
                status_code=400,
                detail="Guardian email must match the verified Google account.",
            )
        if not data.guardian_consent:
            raise HTTPException(status_code=400, detail="Guardian consent is required for minor patients.")

        account_contact = validate_contact_number(guardian_contact, "Guardian contact number")
    else:
        account_contact = validate_contact_number(data.contact, "Contact number")

    if not data.terms_accepted or not data.privacy_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms and Conditions and Privacy Policy before registering.",
        )

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": f"{first_name} {last_name}".strip(),
        "address": address,
        "is_minor": is_minor,
        "account_contact": account_contact,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    first_name = clean_text(user.first_name)
    last_name = clean_text(user.last_name)
    full_name = f"{first_name} {last_name}".strip()
    address = clean_text(user.address)

    if len(first_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="First name must be at least 2 characters.",
        )

    if len(last_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Last name must be at least 2 characters.",
        )

    if len(address) < 5:
        raise HTTPException(
            status_code=400,
            detail="Complete address is required.",
        )

    age_in_months = calculate_age_in_months(user.date_of_birth)

    if age_in_months < 3:
        raise HTTPException(
            status_code=400,
            detail="Patient must be at least 3 months old to register.",
        )

    is_minor = check_if_minor(user.date_of_birth)

    if is_minor:
        guardian_first_name = clean_text(user.guardian_first_name)
        guardian_last_name = clean_text(user.guardian_last_name)
        guardian_relationship = clean_text(user.guardian_relationship)
        guardian_contact = clean_text(user.guardian_contact)

        if len(guardian_first_name) < 2 or len(guardian_last_name) < 2:
            raise HTTPException(
                status_code=400,
                detail="Parent or guardian name is required for minor patients.",
            )

        if not guardian_relationship:
            raise HTTPException(
                status_code=400,
                detail="Relationship to patient is required for minor patients.",
            )

        if not guardian_contact:
            raise HTTPException(
                status_code=400,
                detail="Guardian contact number is required for minor patients.",
            )

        if not user.guardian_email:
            raise HTTPException(
                status_code=400,
                detail="Guardian email is required for minor patients.",
            )

        if not user.guardian_consent:
            raise HTTPException(
                status_code=400,
                detail="Guardian consent is required for minor patients.",
            )

        account_email = validate_deliverable_email(str(user.guardian_email))
        account_contact = validate_contact_number(
            guardian_contact,
            "Guardian contact number",
        )

    else:
        account_email = validate_deliverable_email(str(user.email))
        account_contact = validate_contact_number(
            user.contact,
            "Contact number",
        )

    if not user.terms_accepted or not user.privacy_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms and Conditions and Privacy Policy before registering.",
        )

    existing_user = db.query(User).filter(User.email == account_email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered.",
        )

    validate_password(user.password)

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    new_user = User(
        name=full_name,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=user.date_of_birth,
        is_minor=is_minor,
        address=address,

        email=account_email,
        contact=account_contact,
        password_hash=hash_password(user.password),
        role="patient",
        is_verified=False,
        verification_token=token,

        guardian_first_name=clean_text(user.guardian_first_name) if is_minor else None,
        guardian_last_name=clean_text(user.guardian_last_name) if is_minor else None,
        guardian_relationship=clean_text(user.guardian_relationship) if is_minor else None,
        guardian_contact=account_contact if is_minor else None,
        guardian_email=account_email if is_minor else None,
        guardian_consent=True if is_minor else False,
        guardian_consent_at=now if is_minor else None,

        terms_accepted=True,
        terms_accepted_at=now,
        privacy_accepted=True,
        privacy_accepted_at=now,
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
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired token.",
        )

    user.is_verified = True
    user.verification_token = None

    db.commit()
    db.refresh(user)

    return {
        "message": "Email verified successfully. You can now login."
    }


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username.lower().strip()

    db_user = db.query(User).filter(User.email == email).first()

    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials.",
        )

    if db_user.status != "Active":
        raise HTTPException(
            status_code=403,
            detail="Your account is inactive. Please contact the administrator.",
        )

    if not db_user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    return build_auth_response(db_user)


@router.post("/google/start")
def start_google_auth(data: GoogleCredentialRequest, db: Session = Depends(get_db)):
    claims = verify_google_credential(data.credential)

    linked_user = db.query(User).filter(User.google_sub == claims["sub"]).first()
    if linked_user:
        if linked_user.email != claims["email"]:
            raise HTTPException(status_code=401, detail="Google authentication failed")
        if linked_user.status != "Active":
            raise HTTPException(status_code=403, detail="Your account is inactive. Please contact the administrator.")
        if not linked_user.is_verified:
            raise HTTPException(status_code=403, detail="Please verify your OurSkin email before logging in.")
        return {"action": "authenticated", **build_auth_response(linked_user)}

    existing_user = db.query(User).filter(User.email == claims["email"]).first()
    if existing_user:
        return {
            "action": "link_required",
            "message": "This email already has an OurSkin account. Enter the existing account password to link Google securely.",
        }

    return {
        "action": "onboarding_required",
        "onboarding_token": create_google_onboarding_token(claims),
        "profile": {
            "email": claims["email"],
            "first_name": claims["given_name"],
            "last_name": claims["family_name"],
        },
    }


@router.post("/google/link")
def link_google_account(data: GoogleLinkRequest, db: Session = Depends(get_db)):
    claims = verify_google_credential(data.credential)
    user = db.query(User).filter(User.email == claims["email"]).first()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Unable to link Google account")
    if user.status != "Active":
        raise HTTPException(status_code=403, detail="Your account is inactive. Please contact the administrator.")
    if user.google_sub and user.google_sub != claims["sub"]:
        raise HTTPException(status_code=409, detail="Unable to link Google account")

    subject_owner = db.query(User).filter(User.google_sub == claims["sub"]).first()
    if subject_owner and subject_owner.id != user.id:
        raise HTTPException(status_code=409, detail="Unable to link Google account")

    user.google_sub = claims["sub"]
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to link Google account")

    if not user.is_verified:
        return {
            "action": "verification_required",
            "message": "Google was linked. Verify your OurSkin email before logging in.",
        }

    return {"action": "authenticated", **build_auth_response(user)}


@router.post("/google/register", status_code=status.HTTP_201_CREATED)
def register_with_google(data: GooglePatientRegistration, db: Session = Depends(get_db)):
    claims = decode_google_onboarding_token(data.onboarding_token)
    account_email = str(claims["email"]).strip().lower()
    google_subject = str(claims["sub"])
    profile = validate_patient_profile(data, account_email)

    if db.query(User).filter(User.email == account_email).first():
        raise HTTPException(status_code=409, detail="Unable to create Google account")
    if db.query(User).filter(User.google_sub == google_subject).first():
        raise HTTPException(status_code=409, detail="Unable to create Google account")

    now = datetime.now(timezone.utc)
    user = User(
        name=profile["full_name"],
        first_name=profile["first_name"],
        last_name=profile["last_name"],
        date_of_birth=data.date_of_birth,
        is_minor=profile["is_minor"],
        address=profile["address"],
        email=account_email,
        contact=profile["account_contact"],
        password_hash=hash_password(secrets.token_urlsafe(48)),
        google_sub=google_subject,
        role="patient",
        is_verified=True,
        guardian_first_name=clean_text(data.guardian_first_name) if profile["is_minor"] else None,
        guardian_last_name=clean_text(data.guardian_last_name) if profile["is_minor"] else None,
        guardian_relationship=clean_text(data.guardian_relationship) if profile["is_minor"] else None,
        guardian_contact=profile["account_contact"] if profile["is_minor"] else None,
        guardian_email=account_email if profile["is_minor"] else None,
        guardian_consent=profile["is_minor"],
        guardian_consent_at=now if profile["is_minor"] else None,
        terms_accepted=True,
        terms_accepted_at=now,
        privacy_accepted=True,
        privacy_accepted_at=now,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to create Google account")

    return {"action": "authenticated", **build_auth_response(user)}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Current password incorrect.",
        )

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the old password.",
        )

    validate_password(data.new_password)

    user.password_hash = hash_password(data.new_password)

    db.commit()
    db.refresh(user)

    return {
        "message": "Password updated successfully."
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    user = db.query(User).filter(User.email == email).first()

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

        user.reset_token = hash_token(token)
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


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(data.token)

    user = db.query(User).filter(User.reset_token == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    if not user.reset_token_expires:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    token_expiry = user.reset_token_expires

    if token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > token_expiry:
        user.reset_token = None
        user.reset_token_expires = None
        user.reset_requested_at = None

        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Reset token has expired. Please request a new reset link.",
        )

    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the old password.",
        )

    validate_password(data.new_password)

    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.reset_requested_at = None

    db.commit()
    db.refresh(user)

    return {
        "message": "Password reset successfully. You can now login."
    }