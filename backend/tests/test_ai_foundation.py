from io import BytesIO

import pytest
from PIL import Image
from pydantic import ValidationError

from app.core.image_security import normalize_image_for_analysis
from app.schemas.ai_analysis import (
    AIAnalysisMode,
    AIAnalysisResult,
    AIAnalysisStatus,
    EvidenceStrength,
    ImageQualityAssessment,
    SeverityAssessment,
    SeverityLevel,
)
from app.services.ai_taxonomy import (
    CONDITION_DEFINITIONS,
    SERVICE_MAPPING_DEFINITIONS,
    service_key_for_name,
)


def _base_result(**overrides):
    payload = {
        "analysis_mode": AIAnalysisMode.DERMATOLOGY_ASSESSMENT,
        "status": AIAnalysisStatus.COMPLETED,
        "taxonomy_version": "ourskin-derm-v1",
        "pipeline_version": "ourskin-ai-m1",
        "primary_condition_code": "ACNE_VULGARIS",
        "primary_condition_display": "Acne vulgaris",
        "evidence_strength": EvidenceStrength.HIGH,
        "image_quality": {"usable": True, "issues": []},
        "visual_findings": [{"finding": "Inflammatory papules"}],
        "differentials": [],
        "severity": {
            "assessable": True,
            "level": SeverityLevel.MODERATE,
            "reason": "Multiple inflammatory lesions are visible.",
        },
        "limitations": ["Image analysis cannot assess tenderness."],
    }
    payload.update(overrides)
    return payload


def test_structured_result_accepts_bounded_completed_analysis():
    result = AIAnalysisResult.model_validate(_base_result())

    assert result.status == AIAnalysisStatus.COMPLETED
    assert result.primary_condition_code == "ACNE_VULGARIS"
    assert result.image_quality.usable is True


def test_completed_result_requires_primary_condition_and_evidence():
    with pytest.raises(ValidationError):
        AIAnalysisResult.model_validate(
            _base_result(primary_condition_code=None, evidence_strength=None)
        )


def test_insufficient_image_requires_unusable_quality_state():
    with pytest.raises(ValidationError):
        AIAnalysisResult.model_validate(
            _base_result(
                status=AIAnalysisStatus.INSUFFICIENT_IMAGE,
                primary_condition_code=None,
                primary_condition_display=None,
                evidence_strength=None,
                image_quality={"usable": True, "issues": ["blur"]},
                severity={"assessable": False},
            )
        )


def test_severity_level_is_only_present_when_assessable():
    with pytest.raises(ValidationError):
        SeverityAssessment.model_validate({"assessable": True})

    with pytest.raises(ValidationError):
        SeverityAssessment.model_validate(
            {"assessable": False, "level": SeverityLevel.MILD}
        )


def test_contract_forbids_unknown_fields():
    with pytest.raises(ValidationError):
        ImageQualityAssessment.model_validate(
            {"usable": True, "issues": [], "confidence": 0.99}
        )


def test_taxonomy_codes_are_unique_and_include_abstention_sensitive_flags():
    codes = [item.code for item in CONDITION_DEFINITIONS]

    assert len(codes) == len(set(codes))
    assert "ACNE_VULGARIS" in codes
    assert "SUSPICIOUS_PIGMENTED_LESION" in codes
    assert "POSSIBLE_INFECTION" in codes


def test_cosmetic_surgery_is_not_an_ai_condition_service_mapping():
    assert all(
        mapping.service_key != "COSMETIC_SURGERY"
        for mapping in SERVICE_MAPPING_DEFINITIONS
    )


def test_service_aliases_handle_current_injectable_spelling():
    assert service_key_for_name("Injectables") == "INJECTABLES"
    assert service_key_for_name("Injectibles") == "INJECTABLES"
    assert service_key_for_name("Lasers & Energy-Based Devices") == "LASERS_EBDS"


def test_image_normalization_applies_exif_orientation_and_strips_metadata():
    source = Image.new("RGB", (40, 80), "white")
    exif = source.getexif()
    exif[274] = 6
    buffer = BytesIO()
    source.save(buffer, format="JPEG", quality=95, exif=exif)

    normalized = normalize_image_for_analysis(buffer.getvalue(), ".jpg")

    assert (normalized.width, normalized.height) == (80, 40)
    assert normalized.metadata_stripped is True

    with Image.open(BytesIO(normalized.data)) as result:
        assert result.size == (80, 40)
        assert not result.getexif()
