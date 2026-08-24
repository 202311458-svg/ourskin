from collections.abc import Sequence

from app.schemas.ai_analysis import (
    AIAnalysisStatus,
    DifferentialCandidate,
    ProviderDermatologyResult,
    SeverityAssessment,
)
from app.services.ai.contracts import AIResultValidationError, TaxonomyCondition


class ClinicalResultValidator:
    def validate(
        self,
        result: ProviderDermatologyResult,
        taxonomy: Sequence[TaxonomyCondition],
    ) -> ProviderDermatologyResult:
        condition_map = {condition.code: condition for condition in taxonomy}
        if not condition_map:
            raise AIResultValidationError("No active dermatology taxonomy is available")

        primary = None
        if result.primary_condition_code:
            primary = condition_map.get(result.primary_condition_code)
            if primary is None:
                raise AIResultValidationError("Provider returned a condition outside the active taxonomy")

        normalized_differentials = []
        seen_codes = set()
        for candidate in result.differentials:
            condition = condition_map.get(candidate.condition_code)
            if condition is None:
                raise AIResultValidationError("Provider returned a differential outside the active taxonomy")
            if candidate.condition_code == result.primary_condition_code or candidate.condition_code in seen_codes:
                continue
            seen_codes.add(candidate.condition_code)
            normalized_differentials.append(
                DifferentialCandidate(
                    condition_code=condition.code,
                    display_name=condition.display_name,
                    evidence_strength=candidate.evidence_strength,
                    reason=candidate.reason,
                )
            )

        status = result.status
        severity = result.severity
        if primary is None and severity.assessable:
            severity = SeverityAssessment(
                assessable=False,
                level=None,
                reason="Severity cannot be assessed without an in-scope primary condition.",
            )
        if primary is not None:
            if primary.support_level == "FLAG_ONLY":
                status = AIAnalysisStatus.REQUIRES_DIRECT_REVIEW
            if severity.assessable and not primary.severity_assessment_supported:
                severity = SeverityAssessment(
                    assessable=False,
                    level=None,
                    reason="Severity is not supported for this condition from a single image in the current taxonomy.",
                )

        return result.model_copy(
            update={
                "status": status,
                "primary_condition_display": primary.display_name if primary else None,
                "differentials": normalized_differentials,
                "severity": severity,
            }
        )
