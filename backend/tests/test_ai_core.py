from io import BytesIO

import pytest
from PIL import Image, ImageDraw

from app.schemas.ai_analysis import (
    AIAnalysisStatus,
    DermatologyClinicalContext,
    DifferentialCandidate,
    EvidenceStrength,
    ProviderDermatologyResult,
    SeverityAssessment,
    SeverityLevel,
    VisualFinding,
)
from app.services.ai.contracts import AIResultValidationError, TaxonomyCondition
from app.services.ai.dermatology_analysis_service import DermatologyAnalysisService
from app.services.ai.image_quality import ImageQualityService
from app.services.ai.medication_suggestions import MedicationSuggestionOutcome
from app.services.ai.providers.openai_provider import OpenAIVisionAnalysisProvider
from app.services.ai.service_compatibility import ServiceCompatibilityOutcome
from app.services.ai.validator import ClinicalResultValidator


def _pattern_image(size=(512, 512), format_name="JPEG"):
    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    for offset in range(0, min(size), 16):
        draw.line((0, offset, size[0], size[1] - offset), fill="black", width=3)
    buffer = BytesIO()
    image.save(buffer, format=format_name)
    return buffer.getvalue()


def _taxonomy():
    return [
        TaxonomyCondition(1, "ACNE_VULGARIS", "Acne vulgaris", "inflammatory", "SUPPORTED", True, True),
        TaxonomyCondition(2, "VITILIGO", "Vitiligo", "pigmentary", "SUPPORTED", True, False),
        TaxonomyCondition(3, "SUSPICIOUS_PIGMENTED_LESION", "Pigmented lesion requiring direct review", "lesion_flag", "FLAG_ONLY", True, False),
    ]


def test_quality_gate_rejects_low_resolution():
    result = ImageQualityService().assess(_pattern_image(size=(128, 128)))
    assert result.usable is False
    assert "low_resolution" in result.issues


def test_quality_gate_accepts_clear_pattern():
    result = ImageQualityService().assess(_pattern_image())
    assert result.usable is True
    assert "possible_blur" not in result.issues


def test_validator_rejects_unknown_taxonomy_code():
    result = ProviderDermatologyResult(
        status=AIAnalysisStatus.COMPLETED,
        primary_condition_code="NOT_REAL",
        primary_condition_display="Not real",
        evidence_strength=EvidenceStrength.HIGH,
        severity=SeverityAssessment(assessable=False),
    )
    with pytest.raises(AIResultValidationError):
        ClinicalResultValidator().validate(result, _taxonomy())


def test_validator_normalizes_display_and_disables_unsupported_severity():
    result = ProviderDermatologyResult(
        status=AIAnalysisStatus.COMPLETED,
        primary_condition_code="VITILIGO",
        primary_condition_display="wrong display",
        evidence_strength=EvidenceStrength.MODERATE,
        severity=SeverityAssessment(assessable=True, level=SeverityLevel.SEVERE, reason="model guess"),
        differentials=[
            DifferentialCandidate(
                condition_code="ACNE_VULGARIS",
                display_name="wrong",
                evidence_strength=EvidenceStrength.LOW,
                reason="secondary visual possibility",
            )
        ],
    )
    validated = ClinicalResultValidator().validate(result, _taxonomy())
    assert validated.primary_condition_display == "Vitiligo"
    assert validated.differentials[0].display_name == "Acne vulgaris"
    assert validated.severity.assessable is False
    assert validated.severity.level is None


def test_flag_only_condition_forces_direct_review():
    result = ProviderDermatologyResult(
        status=AIAnalysisStatus.COMPLETED,
        primary_condition_code="SUSPICIOUS_PIGMENTED_LESION",
        primary_condition_display="anything",
        evidence_strength=EvidenceStrength.MODERATE,
        severity=SeverityAssessment(assessable=False),
    )
    validated = ClinicalResultValidator().validate(result, _taxonomy())
    assert validated.status == AIAnalysisStatus.REQUIRES_DIRECT_REVIEW


class _FakeTaxonomyService:
    def list_active(self, db):
        return _taxonomy()


class _FakeProvider:
    provider_name = "fake"
    model_id = "fake-model"
    calls = 0

    def analyze_dermatology(self, **kwargs):
        self.calls += 1
        return ProviderDermatologyResult(
            status=AIAnalysisStatus.COMPLETED,
            primary_condition_code="ACNE_VULGARIS",
            primary_condition_display="Acne",
            evidence_strength=EvidenceStrength.HIGH,
            visual_findings=[VisualFinding(finding="Inflammatory papules")],
            severity=SeverityAssessment(assessable=True, level=SeverityLevel.MODERATE, reason="Visible inflammatory burden"),
            limitations=["Image-only assessment"],
        )


class _NoopCompatibilityService:
    def evaluate(self, **_kwargs):
        return ServiceCompatibilityOutcome(None, None, [])


class _NoopMedicationService:
    def suggest(self, **_kwargs):
        return MedicationSuggestionOutcome([], "Not exercised by this core test.")


def test_analysis_service_skips_provider_when_quality_fails():
    provider = _FakeProvider()
    service = DermatologyAnalysisService(provider=provider, taxonomy_service=_FakeTaxonomyService())
    execution = service.analyze(
        db=None,
        image_bytes=_pattern_image(size=(128, 128)),
        content_type="image/jpeg",
        context=DermatologyClinicalContext(booked_service_name="Consultation"),
    )
    assert execution.result.status == AIAnalysisStatus.INSUFFICIENT_IMAGE
    assert provider.calls == 0
    assert execution.provider_name is None


def test_analysis_service_returns_validated_structured_result():
    provider = _FakeProvider()
    service = DermatologyAnalysisService(
        provider=provider,
        taxonomy_service=_FakeTaxonomyService(),
        service_compatibility_service=_NoopCompatibilityService(),
        medication_suggestion_service=_NoopMedicationService(),
    )
    execution = service.analyze(
        db=None,
        image_bytes=_pattern_image(),
        content_type="image/jpeg",
        context=DermatologyClinicalContext(body_site="face", booked_service_name="Consultation"),
    )
    assert execution.result.status == AIAnalysisStatus.COMPLETED
    assert execution.result.primary_condition_code == "ACNE_VULGARIS"
    assert execution.result.primary_condition_display == "Acne vulgaris"
    assert execution.result.medication_suggestions == []
    assert execution.result.service_recommendations == []
    assert execution.provider_name == "fake"


class _ParsedContent:
    def __init__(self, parsed): self.parsed = parsed
class _Message:
    type = "message"
    def __init__(self, parsed): self.content = [_ParsedContent(parsed)]
class _Response:
    def __init__(self, parsed): self.output = [_Message(parsed)]
class _Responses:
    def __init__(self, parsed): self.parsed = parsed; self.kwargs = None
    def parse(self, **kwargs): self.kwargs = kwargs; return _Response(self.parsed)
class _Client:
    def __init__(self, parsed): self.responses = _Responses(parsed)


def test_openai_provider_uses_structured_high_detail_stateless_request():
    parsed = ProviderDermatologyResult(
        status=AIAnalysisStatus.COMPLETED,
        primary_condition_code="ACNE_VULGARIS",
        primary_condition_display="Acne vulgaris",
        evidence_strength=EvidenceStrength.HIGH,
        severity=SeverityAssessment(assessable=True, level=SeverityLevel.MILD, reason="Limited visible inflammatory burden"),
    )
    client = _Client(parsed)
    provider = OpenAIVisionAnalysisProvider(api_key="test-key", model_id="gpt-5.6-sol", client=client)
    output = provider.analyze_dermatology(
        image_bytes=_pattern_image(),
        content_type="image/jpeg",
        context=DermatologyClinicalContext(body_site="face", symptoms=["itching"]),
        taxonomy=_taxonomy(),
    )
    assert output.primary_condition_code == "ACNE_VULGARIS"
    assert client.responses.kwargs["store"] is False
    image_part = client.responses.kwargs["input"][0]["content"][1]
    assert image_part["detail"] == "high"
    assert image_part["image_url"].startswith("data:image/jpeg;base64,")
    assert client.responses.kwargs["text_format"] is ProviderDermatologyResult
