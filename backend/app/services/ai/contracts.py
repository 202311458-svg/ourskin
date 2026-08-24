from dataclasses import dataclass
from typing import Protocol, Sequence

from app.schemas.ai_analysis import DermatologyClinicalContext, ProviderDermatologyResult


@dataclass(frozen=True)
class TaxonomyCondition:
    id: int
    code: str
    display_name: str
    category: str
    support_level: str
    image_assessment_supported: bool
    severity_assessment_supported: bool


class VisionAnalysisProvider(Protocol):
    provider_name: str
    model_id: str

    def analyze_dermatology(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        context: DermatologyClinicalContext,
        taxonomy: Sequence[TaxonomyCondition],
    ) -> ProviderDermatologyResult: ...


class AIProviderError(RuntimeError):
    pass


class AIProviderConfigurationError(AIProviderError):
    pass


class AIResultValidationError(ValueError):
    pass
