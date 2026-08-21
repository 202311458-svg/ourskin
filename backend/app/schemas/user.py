from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.core.password_policy import validate_new_password


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    address: str

    email: EmailStr
    password: str
    confirm_password: str
    contact: str
    role: str = "patient"

    guardian_first_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    guardian_consent: Optional[bool] = False

    terms_accepted: bool = False
    privacy_accepted: bool = False

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        return validate_new_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleCredentialRequest(BaseModel):
    credential: str


class GoogleLinkRequest(GoogleCredentialRequest):
    password: str


class GooglePatientRegistration(BaseModel):
    onboarding_token: str
    first_name: str
    last_name: str
    date_of_birth: date
    address: str
    contact: str

    guardian_first_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    guardian_consent: Optional[bool] = False

    terms_accepted: bool = False
    privacy_accepted: bool = False


class UserResponse(BaseModel):
    id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    is_minor: Optional[bool] = False
    address: Optional[str] = None

    email: EmailStr
    contact: Optional[str] = None
    role: str
    created_at: datetime

    guardian_first_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    guardian_consent: Optional[bool] = False
    terms_accepted: Optional[bool] = False
    privacy_accepted: Optional[bool] = False

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    profile_image: Optional[str] = None
    specialty: Optional[str] = None
    availability: Optional[str] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_policy(cls, value: str) -> str:
        return validate_new_password(value)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_policy(cls, value: str) -> str:
        return validate_new_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    department: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None
    status: Optional[str] = "Active"

    @field_validator("password")
    @classmethod
    def validate_staff_password(cls, value: str) -> str:
        return validate_new_password(value)


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None
    status: Optional[str] = None


class StaffStatusUpdate(BaseModel):
    status: str


class DoctorProfileUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None
    specialty: Optional[str] = None
    availability: Optional[str] = None
    bio: Optional[str] = None


class DoctorProfileResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    contact: Optional[str] = None
    role: str
    status: Optional[str] = None
    department: Optional[str] = None
    profile_image: Optional[str] = None
    specialty: Optional[str] = None
    availability: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        from_attributes = True
