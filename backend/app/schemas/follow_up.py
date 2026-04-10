from pydantic import BaseModel
from datetime import date
from typing import Optional


class FollowUpCreate(BaseModel):
    appointment_id: int
    follow_up_date: date
    reason: str
    notes: Optional[str] = None


class FollowUpUpdate(BaseModel):
    follow_up_date: Optional[date] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class FollowUpOut(BaseModel):
    id: int
    appointment_id: int
    patient_id: int
    doctor_id: int
    follow_up_date: date
    reason: str
    notes: Optional[str] = None
    status: str

    class Config:
        from_attributes = True