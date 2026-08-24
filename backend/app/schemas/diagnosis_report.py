from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DiagnosisReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skin_analysis_id: Optional[int] = Field(default=None, gt=0)
    ai_analysis_run_id: Optional[int] = Field(default=None, gt=0)
    doctor_final_diagnosis: str
    doctor_prescription: Optional[str] = None
    after_appointment_notes: Optional[str] = None
    follow_up_plan: Optional[str] = None
    next_visit_date: Optional[date] = None


class DiagnosisReportUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skin_analysis_id: Optional[int] = Field(default=None, gt=0)
    ai_analysis_run_id: Optional[int] = Field(default=None, gt=0)
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
    ai_analysis_run_id: Optional[int]
    doctor_final_diagnosis: str
    doctor_prescription: Optional[str]
    after_appointment_notes: Optional[str]
    follow_up_plan: Optional[str]
    next_visit_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
