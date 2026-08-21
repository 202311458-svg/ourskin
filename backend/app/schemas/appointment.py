import re
from datetime import date as Date
from datetime import datetime
from datetime import time as Time
from typing import Optional

from pydantic import BaseModel, Field, field_validator


PH_MOBILE_PATTERN = re.compile(r"^(09\d{9}|\+639\d{9})$")


class AppointmentCreate(BaseModel):
    service_id: int

    # Required only for regular appointment bookings.
    # Initial evaluation requests intentionally send these as null or omit them.
    schedule_id: Optional[int] = None
    start_time: Optional[Time] = None
    end_time: Optional[Time] = None

    patient_contact: Optional[str] = None
    patient_address: Optional[str] = None
    patient_age: Optional[int] = Field(default=None, ge=0, le=150)
    patient_age_label: Optional[str] = Field(default=None, max_length=80)
    concern: Optional[str] = Field(default=None, max_length=2000)

    # Optional for staff/admin-created bookings later.
    patient_id: Optional[int] = None

    @field_validator("patient_contact")
    @classmethod
    def validate_patient_contact(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()
        if not cleaned:
            return None

        if not PH_MOBILE_PATTERN.match(cleaned):
            raise ValueError(
                "Patient contact number must be a valid Philippine mobile number. "
                "Example: 09123456789 or +639123456789."
            )

        return cleaned

    @field_validator("patient_address")
    @classmethod
    def validate_patient_address(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()
        if not cleaned:
            return None

        if len(cleaned) < 5:
            raise ValueError("Patient address must contain at least 5 characters.")
        if len(cleaned) > 500:
            raise ValueError("Patient address must not exceed 500 characters.")

        return cleaned

    @field_validator("concern")
    @classmethod
    def normalize_concern(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None


class AppointmentScheduleAssign(BaseModel):
    # For regular weekly schedules, schedule_id can still be used.
    # For Surgical/Cosmetic initial evaluation, staff may assign manually
    # based on staff-doctor coordination without using doctor_schedules.
    schedule_id: Optional[int] = None
    doctor_id: Optional[int] = None
    schedule_date: Optional[Date] = None
    start_time: Time
    end_time: Time
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

    date: Optional[Date]
    time: Optional[Time]
    end_time: Optional[Time]
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


class StaffAppointmentListItem(BaseModel):
    """Least-privilege contract for staff/admin appointment work queues."""

    id: int
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    schedule_id: Optional[int] = None
    service_id: Optional[int] = None
    patient_name: str
    doctor_name: Optional[str] = None
    date: Optional[Date] = None
    time: Optional[Time] = None
    end_time: Optional[Time] = None
    services: str
    appointment_type: str
    consultation_mode: str
    is_initial_evaluation_request: bool
    status: str


class StaffAppointmentHistoryItem(AppointmentOut):
    last_action_by_name: Optional[str] = None
    last_action_by_role: Optional[str] = None


class PaginatedStaffAppointmentHistory(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[StaffAppointmentHistoryItem]
