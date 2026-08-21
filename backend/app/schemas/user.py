from datetime import datetime, date
import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator

from app.core.password_policy import validate_new_password


PH_MOBILE_PATTERN = re.compile(r"^(09\d{9}|\+639\d{9})$")


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
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    profile_image: Optional[str] = None
    specialty: Optional[str] = None
    availability: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not 2 <= len(value) <= 120:
            raise ValueError("Name must be between 2 and 120 characters.")
        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name_part(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not 2 <= len(value) <= 80:
            raise ValueError("Name fields must be between 2 and 80 characters.")
        return value

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not PH_MOBILE_PATTERN.fullmatch(value):
            raise ValueError(
                "Contact number must be a valid Philippine mobile number."
            )
        return value

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not 5 <= len(value) <= 500:
            raise ValueError("Address must be between 5 and 500 characters.")
        return value

    @field_validator("profile_image")
    @classmethod
    def validate_profile_image(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) > 1000:
            raise ValueError("Profile image reference is too long.")
        return value

    @field_validator("specialty")
    @classmethod
    def validate_specialty(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) > 120:
            raise ValueError("Specialty must be 120 characters or fewer.")
        return value

    @field_validator("availability")
    @classmethod
    def validate_availability(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) > 500:
            raise ValueError("Availability must be 500 characters or fewer.")
        return value

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) > 2000:
            raise ValueError("Bio must be 2000 characters or fewer.")
        return value


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
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    contact: Optional[str] = None
    profile_image: Optional[str] = None
    specialty: Optional[str] = None
    availability: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_name(value)

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_contact(value)

    @field_validator("profile_image")
    @classmethod
    def validate_profile_image(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_profile_image(value)

    @field_validator("specialty")
    @classmethod
    def validate_specialty(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_specialty(value)

    @field_validator("availability")
    @classmethod
    def validate_availability(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_availability(value)

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, value: Optional[str]) -> Optional[str]:
        return UserProfileUpdate.validate_bio(value)


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