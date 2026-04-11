from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class DiagnosisReportCreate(BaseModel):
    skin_analysis_id: Optional[int] = None
    doctor_final_diagnosis: str
    doctor_prescription: Optional[str] = None
    after_appointment_notes: Optional[str] = None
    follow_up_plan: Optional[str] = None
    next_visit_date: Optional[date] = None


class DiagnosisReportUpdate(BaseModel):
    skin_analysis_id: Optional[int] = None
    doctor_final_diagnosis: Optional[str] = None
    doctor_prescription: Optional[str] = None
    after_appointment_notes: Optional[str] = None
    follow_up_plan: Optional[str] = None
    next_visit_date: Optional[date] = None


class DiagnosisReportOut(BaseModel):
    id: int
    appointment_id: int
    patient_id: Optional[int]
    doctor_id: Optional[int]
    skin_analysis_id: Optional[int]
    doctor_final_diagnosis: str
    doctor_prescription: Optional[str]
    after_appointment_notes: Optional[str]
    follow_up_plan: Optional[str]
    next_visit_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True