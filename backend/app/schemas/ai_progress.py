from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.ai_analysis import AIAnalysisStatus, ImageQualityAssessment


class StrictProgressModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaptureView(str, Enum):
    FRONT = "FRONT"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CLOSE_UP = "CLOSE_UP"
    OTHER = "OTHER"
    UNSPECIFIED = "UNSPECIFIED"


class ProgressTrend(str, Enum):
    IMPROVING = "IMPROVING"
    STABLE = "STABLE"
    POSSIBLE_WORSENING = "POSSIBLE_WORSENING"
    MIXED = "MIXED"
    UNABLE_TO_COMPARE = "UNABLE_TO_COMPARE"


class ProgressChange(str, Enum):
    IMPROVED = "IMPROVED"
    STABLE = "STABLE"
    WORSENED = "WORSENED"
    NEW = "NEW"
    RESOLVED = "RESOLVED"
    UNCERTAIN = "UNCERTAIN"


class ProgressClinicalContext(StrictProgressModel):
    procedure_or_treatment: str = Field(min_length=1, max_length=200)
    body_site: str | None = Field(default=None, max_length=120)
    reference_body_site: str | None = Field(default=None, max_length=120)
    reference_procedure_or_treatment: str | None = Field(default=None, max_length=200)
    current_capture_view: CaptureView = CaptureView.UNSPECIFIED
    reference_capture_view: CaptureView = CaptureView.UNSPECIFIED
    days_since_procedure: int | None = Field(default=None, ge=0, le=3650)
    doctor_observation: str | None = Field(default=None, max_length=1500)
    booked_service_name: str | None = Field(default=None, max_length=160)


class ProgressFinding(StrictProgressModel):
    feature: str = Field(min_length=1, max_length=240)
    change: ProgressChange
    description: str = Field(min_length=1, max_length=1200)


class ProviderProgressResult(StrictProgressModel):
    status: AIAnalysisStatus
    comparison_reliable: bool
    trend: ProgressTrend
    summary: str = Field(min_length=1, max_length=1800)
    findings: list[ProgressFinding] = Field(default_factory=list, max_length=30)
    red_flags: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_comparison(self):
        if not self.comparison_reliable and self.trend != ProgressTrend.UNABLE_TO_COMPARE:
            raise ValueError("Unreliable comparisons must use UNABLE_TO_COMPARE trend")
        if self.status == AIAnalysisStatus.INSUFFICIENT_IMAGE and self.comparison_reliable:
            raise ValueError("Insufficient-image progress results cannot be reliable")
        return self


class ProgressAnalysisResult(StrictProgressModel):
    analysis_mode: str = "RECOVERY_PROGRESS"
    status: AIAnalysisStatus
    pipeline_version: str = Field(min_length=1, max_length=80)
    image_quality: ImageQualityAssessment
    comparison_reliable: bool
    trend: ProgressTrend
    summary: str = Field(min_length=1, max_length=1800)
    findings: list[ProgressFinding] = Field(default_factory=list, max_length=30)
    red_flags: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)


class ProgressReferenceOption(StrictProgressModel):
    run_id: int
    appointment_id: int
    appointment_date: str | None = None
    appointment_time: str | None = None
    service_name: str | None = None
    capture_view: CaptureView = CaptureView.UNSPECIFIED
    body_site: str | None = None
    procedure_or_treatment: str | None = None
    image_url: str
    analysis_mode: str
    capture_type: str
    created_at: str | None = None
