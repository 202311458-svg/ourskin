from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel


class AppointmentCreate(BaseModel):
    service_id: int

    # Required only for regular appointment bookings.
    # Initial evaluation requests intentionally send these as null or omit them.
    schedule_id: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    patient_contact: Optional[str] = None
    patient_address: Optional[str] = None
    patient_age: Optional[int] = None
    patient_age_label: Optional[str] = None
    concern: Optional[str] = None

    # Optional for staff/admin-created bookings later.
    patient_id: Optional[int] = None


class AppointmentScheduleAssign(BaseModel):
    # For regular weekly schedules, schedule_id can still be used.
    # For Surgical/Cosmetic initial evaluation, staff may assign manually
    # based on staff-doctor coordination without using doctor_schedules.
    schedule_id: Optional[int] = None
    doctor_id: Optional[int] = None
    schedule_date: Optional[date] = None
    start_time: time
    end_time: time
    consultation_mode: Optional[str] = "In-Person"


class AppointmentStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None
    patient_instruction: Optional[str] = None
    send_email: Optional[bool] = False


class AppointmentOut(BaseModel):
    id: int
    patient_id: Optional[int]
    doctor_id: Optional[int]
    schedule_id: Optional[int]
    service_id: Optional[int]

    patient_name: str
    patient_email: str
    patient_contact: Optional[str]
    patient_address: Optional[str]
    patient_age: Optional[int]
    patient_age_label: Optional[str]

    is_minor: Optional[bool] = False
    guardian_first_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_contact: Optional[str] = None
    guardian_email: Optional[str] = None
    guardian_consent: Optional[bool] = False

    doctor_name: Optional[str]

    date: Optional[date]
    time: Optional[time]
    end_time: Optional[time]
    services: str

    appointment_type: str
    consultation_mode: str
    concern: Optional[str]
    is_initial_evaluation_request: bool

    status: str
    cancel_reason: Optional[str]

    patient_instruction: Optional[str] = None
    approval_email_sent: Optional[bool] = False
    approval_email_sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True
