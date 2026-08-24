from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AIAnalysisMode(str, Enum):
    DERMATOLOGY_ASSESSMENT = "DERMATOLOGY_ASSESSMENT"
    SERVICE_COMPATIBILITY = "SERVICE_COMPATIBILITY"
    RECOVERY_PROGRESS = "RECOVERY_PROGRESS"


class AIAnalysisStatus(str, Enum):
    COMPLETED = "COMPLETED"
    UNCERTAIN = "UNCERTAIN"
    INSUFFICIENT_IMAGE = "INSUFFICIENT_IMAGE"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    REQUIRES_DIRECT_REVIEW = "REQUIRES_DIRECT_REVIEW"
    FAILED = "FAILED"


class EvidenceStrength(str, Enum):
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"


class SeverityLevel(str, Enum):
    MILD = "MILD"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"


class ServiceCompatibilityStatus(str, Enum):
    COMPATIBLE = "COMPATIBLE"
    REVIEW_RECOMMENDED = "REVIEW_RECOMMENDED"
    LIKELY_DIFFERENT_CONCERN = "LIKELY_DIFFERENT_CONCERN"
    UNABLE_TO_ASSESS = "UNABLE_TO_ASSESS"
    DIRECT_REVIEW_REQUIRED = "DIRECT_REVIEW_REQUIRED"


class ConditionSupportLevel(str, Enum):
    SUPPORTED = "SUPPORTED"
    LIMITED = "LIMITED"
    FLAG_ONLY = "FLAG_ONLY"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DermatologyClinicalContext(StrictModel):
    body_site: str | None = Field(default=None, max_length=120)
    duration: str | None = Field(default=None, max_length=120)
    symptoms: list[str] = Field(default_factory=list, max_length=12)
    progression: str | None = Field(default=None, max_length=120)
    appointment_concern: str | None = Field(default=None, max_length=1000)
    booked_service_id: int | None = Field(default=None, gt=0)
    booked_service_name: str | None = Field(default=None, max_length=160)


class ImageQualityAssessment(StrictModel):
    usable: bool
    issues: list[str] = Field(default_factory=list, max_length=20)
    note: str | None = Field(default=None, max_length=1000)


class VisualFinding(StrictModel):
    finding: str = Field(min_length=1, max_length=240)
    location: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)


class DifferentialCandidate(StrictModel):
    condition_code: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=160)
    evidence_strength: EvidenceStrength
    reason: str = Field(min_length=1, max_length=1200)


class SeverityAssessment(StrictModel):
    assessable: bool
    level: SeverityLevel | None = None
    reason: str | None = Field(default=None, max_length=1200)

    @model_validator(mode="after")
    def validate_level(self):
        if self.assessable and self.level is None:
            raise ValueError("Severity level is required when severity is assessable")
        if not self.assessable and self.level is not None:
            raise ValueError("Severity level must be omitted when severity is not assessable")
        return self


class ServiceRecommendation(StrictModel):
    service_id: int | None = Field(default=None, gt=0)
    service_name: str = Field(min_length=1, max_length=160)
    relationship_type: str = Field(pattern="^(PRIMARY|SECONDARY|REVIEW_ONLY)$")
    reason: str | None = Field(default=None, max_length=1200)


class MedicationSuggestion(StrictModel):
    name_or_class: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=1000)
    considerations: list[str] = Field(default_factory=list, max_length=20)
    requires_more_context: bool = False


class ProviderDermatologyResult(StrictModel):
    status: AIAnalysisStatus
    primary_condition_code: str | None = Field(default=None, max_length=64)
    primary_condition_display: str | None = Field(default=None, max_length=160)
    evidence_strength: EvidenceStrength | None = None
    visual_findings: list[VisualFinding] = Field(default_factory=list, max_length=50)
    differentials: list[DifferentialCandidate] = Field(default_factory=list, max_length=10)
    severity: SeverityAssessment
    red_flags: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_status_fields(self):
        if self.status == AIAnalysisStatus.COMPLETED:
            if not self.primary_condition_code:
                raise ValueError("Completed provider results require a primary condition")
            if self.evidence_strength is None:
                raise ValueError("Completed provider results require evidence strength")
        if self.status in {AIAnalysisStatus.OUT_OF_SCOPE, AIAnalysisStatus.INSUFFICIENT_IMAGE}:
            if self.primary_condition_code is not None:
                raise ValueError("Out-of-scope or insufficient-image results cannot assert a primary condition")
        return self


class AIAnalysisResult(StrictModel):
    analysis_mode: AIAnalysisMode
    status: AIAnalysisStatus
    taxonomy_version: str = Field(min_length=1, max_length=80)
    pipeline_version: str = Field(min_length=1, max_length=80)
    primary_condition_code: str | None = Field(default=None, max_length=64)
    primary_condition_display: str | None = Field(default=None, max_length=160)
    evidence_strength: EvidenceStrength | None = None
    image_quality: ImageQualityAssessment
    visual_findings: list[VisualFinding] = Field(default_factory=list, max_length=50)
    differentials: list[DifferentialCandidate] = Field(default_factory=list, max_length=10)
    severity: SeverityAssessment
    booked_service_id: int | None = Field(default=None, gt=0)
    booked_service_name: str | None = Field(default=None, max_length=160)
    service_compatibility: ServiceCompatibilityStatus | None = None
    compatibility_reason: str | None = Field(default=None, max_length=1600)
    service_recommendations: list[ServiceRecommendation] = Field(default_factory=list, max_length=10)
    medication_suggestions: list[MedicationSuggestion] = Field(default_factory=list, max_length=20)
    red_flags: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_completed_result(self):
        if self.status == AIAnalysisStatus.COMPLETED:
            if not self.image_quality.usable:
                raise ValueError("Completed analyses require a usable image")
            if not self.primary_condition_code:
                raise ValueError("Completed analyses require a primary condition")
            if self.evidence_strength is None:
                raise ValueError("Completed analyses require evidence strength")
        if self.status == AIAnalysisStatus.INSUFFICIENT_IMAGE and self.image_quality.usable:
            raise ValueError("Insufficient-image analyses must mark the image unusable")
        return self
