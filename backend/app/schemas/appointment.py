from pydantic import BaseModel
from datetime import date, time
from typing import Optional

class AppointmentBase(BaseModel):
    patient_name: str
    patient_email: str
    doctor_name: str
    date: date
    time: time
    services: str

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentOut(AppointmentBase):
    id: int
    status: str
    cancel_reason: Optional[str]

    class Config:
        orm_mode = True