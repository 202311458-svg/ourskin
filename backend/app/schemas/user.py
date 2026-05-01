from pydantic import BaseModel, EmailStr, model_validator
from datetime import datetime, date
from typing import Optional


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date

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

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    is_minor: Optional[bool] = False

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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    department: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None
    status: Optional[str] = "Active"


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