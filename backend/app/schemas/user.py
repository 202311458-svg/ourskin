from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    contact: str
    role: str = "patient"

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