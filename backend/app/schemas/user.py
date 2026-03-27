from pydantic import BaseModel, EmailStr, model_validator
from datetime import datetime

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