from pydantic import BaseModel
from datetime import date, time
from typing import Optional


class AppointmentCreate(BaseModel):
    doctor_id: int
    date: date
    time: time
    services: str

    # optional for admin/staff-created bookings
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: Optional[int]
    doctor_id: Optional[int]
    patient_name: str
    patient_email: str
    doctor_name: str
    date: date
    time: time
    services: str
    status: str
    cancel_reason: Optional[str]

    class Config:
        from_attributes = True