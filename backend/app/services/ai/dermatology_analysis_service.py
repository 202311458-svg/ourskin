from dataclasses import dataclass
from time import perf_counter

from sqlalchemy.orm import Session

from app.schemas.ai_analysis import (
    AIAnalysisMode,
    AIAnalysisResult,
    AIAnalysisStatus,
    DermatologyClinicalContext,
    MedicationClinicalContext,
    ServiceCompatibilityStatus,
    SeverityAssessment,
)
from app.services.ai.contracts import VisionAnalysisProvider
from app.services.ai.image_quality import ImageQualityService
from app.services.ai.medication_suggestions import (
    MEDICATION_KNOWLEDGE_VERSION,
    MedicationSuggestionService,
)
from app.services.ai.service_compatibility import ServiceCompatibilityService
from app.services.ai.taxonomy import ConditionTaxonomyService, TAXONOMY_VERSION
from app.services.ai.validator import ClinicalResultValidator


PIPELINE_VERSION = "ourskin-ai-clinical-v1"


@dataclass(frozen=True)
class DermatologyAnalysisExecution:
    result: AIAnalysisResult
    provider_name: str | None
    model_id: str | None
    latency_ms: int


class DermatologyAnalysisService:
    def __init__(
        self,
        *,
        provider: VisionAnalysisProvider,
        image_quality_service: ImageQualityService | None = None,
        taxonomy_service: ConditionTaxonomyService | None = None,
        result_validator: ClinicalResultValidator | None = None,
        service_compatibility_service: ServiceCompatibilityService | None = None,
        medication_suggestion_service: MedicationSuggestionService | None = None,
    ):
        self.provider = provider
        self.image_quality_service = image_quality_service or ImageQualityService()
        self.taxonomy_service = taxonomy_service or ConditionTaxonomyService()
        self.result_validator = result_validator or ClinicalResultValidator()
        self.service_compatibility_service = (
            service_compatibility_service or ServiceCompatibilityService()
        )
        self.medication_suggestion_service = (
            medication_suggestion_service or MedicationSuggestionService()
        )

    def analyze(
        self,
        *,
        db: Session,
        image_bytes: bytes,
        content_type: str,
        context: DermatologyClinicalContext,
        medication_context: MedicationClinicalContext | None = None,
    ) -> DermatologyAnalysisExecution:
        medication_context = medication_context or MedicationClinicalContext()
        started = perf_counter()
        quality = self.image_quality_service.assess(image_bytes)
        has_booked_service = bool(
            context.booked_service_id or context.booked_service_name
        )

        if not quality.usable:
            result = AIAnalysisResult(
                analysis_mode=AIAnalysisMode.DERMATOLOGY_ASSESSMENT,
                status=AIAnalysisStatus.INSUFFICIENT_IMAGE,
                taxonomy_version=TAXONOMY_VERSION,
                pipeline_version=PIPELINE_VERSION,
                image_quality=quality,
                severity=SeverityAssessment(
                    assessable=False,
                    reason="Severity was not assessed because the image did not pass quality checks.",
                ),
                booked_service_id=context.booked_service_id,
                booked_service_name=context.booked_service_name,
                service_compatibility=(
                    ServiceCompatibilityStatus.UNABLE_TO_ASSESS
                    if has_booked_service
                    else None
                ),
                compatibility_reason=(
                    "The image did not pass quality checks, so booked-service compatibility was not assessed."
                    if has_booked_service
                    else None
                ),
                medication_knowledge_version=MEDICATION_KNOWLEDGE_VERSION,
                medication_guidance=(
                    "Medication options were withheld because the image did not pass quality checks."
                ),
                limitations=[
                    "Model inference was skipped because the image failed pre-inference quality checks."
                ],
            )
            return DermatologyAnalysisExecution(
                result=result,
                provider_name=None,
                model_id=None,
                latency_ms=max(0, int((perf_counter() - started) * 1000)),
            )

        taxonomy = self.taxonomy_service.list_active(db)
        provider_result = self.provider.analyze_dermatology(
            image_bytes=image_bytes,
            content_type=content_type,
            context=context,
            taxonomy=taxonomy,
        )
        validated = self.result_validator.validate(provider_result, taxonomy)
        condition = next(
            (
                item
                for item in taxonomy
                if item.code == validated.primary_condition_code
            ),
            None,
        )

        compatibility = self.service_compatibility_service.evaluate(
            db=db,
            analysis_status=validated.status,
            condition=condition,
            booked_service_id=context.booked_service_id,
            booked_service_name=context.booked_service_name,
        )
        medications = self.medication_suggestion_service.suggest(
            analysis_status=validated.status,
            evidence_strength=validated.evidence_strength,
            condition=condition,
            dermatology_context=context,
            medication_context=medication_context,
            red_flags=validated.red_flags,
        )

        result = AIAnalysisResult(
            analysis_mode=AIAnalysisMode.DERMATOLOGY_ASSESSMENT,
            status=validated.status,
            taxonomy_version=TAXONOMY_VERSION,
            pipeline_version=PIPELINE_VERSION,
            primary_condition_code=validated.primary_condition_code,
            primary_condition_display=validated.primary_condition_display,
            evidence_strength=validated.evidence_strength,
            image_quality=quality,
            visual_findings=validated.visual_findings,
            differentials=validated.differentials,
            severity=validated.severity,
            booked_service_id=context.booked_service_id,
            booked_service_name=context.booked_service_name,
            service_compatibility=compatibility.status,
            compatibility_reason=compatibility.reason,
            service_recommendations=compatibility.recommendations,
            medication_suggestions=medications.suggestions,
            medication_knowledge_version=MEDICATION_KNOWLEDGE_VERSION,
            medication_guidance=medications.guidance,
            red_flags=validated.red_flags,
            limitations=validated.limitations,
        )
        return DermatologyAnalysisExecution(
            result=result,
            provider_name=self.provider.provider_name,
            model_id=self.provider.model_id,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
        )
