from pydantic import BaseModel, EmailStr, model_validator
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str
    contact: str
    role: str = "patient"

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
    email: EmailStr
    contact: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


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