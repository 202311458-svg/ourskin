from app.routes.ai_phase3 import _legacy_support_fields, _split_csv
from app.schemas.ai_analysis import (
    AIAnalysisMode,
    AIAnalysisResult,
    AIAnalysisStatus,
    DermatologyClinicalContext,
    EvidenceStrength,
    ImageQualityAssessment,
    MedicationSuggestion,
    ServiceCompatibilityStatus,
    ServiceRecommendation,
    SeverityAssessment,
    SeverityLevel,
    VisualFinding,
)
from app.schemas.diagnosis_report import DiagnosisReportCreate


def _completed_result() -> AIAnalysisResult:
    return AIAnalysisResult(
        analysis_mode=AIAnalysisMode.DERMATOLOGY_ASSESSMENT,
        status=AIAnalysisStatus.COMPLETED,
        taxonomy_version="ourskin-derm-v1",
        pipeline_version="ourskin-ai-clinical-v1",
        primary_condition_code="ACNE_VULGARIS",
        primary_condition_display="Acne vulgaris",
        evidence_strength=EvidenceStrength.HIGH,
        image_quality=ImageQualityAssessment(usable=True),
        visual_findings=[VisualFinding(finding="Inflammatory papules", location="cheeks")],
        severity=SeverityAssessment(
            assessable=True,
            level=SeverityLevel.MODERATE,
            reason="Visible inflammatory burden",
        ),
        booked_service_id=4,
        booked_service_name="Chemical Peels",
        service_compatibility=ServiceCompatibilityStatus.COMPATIBLE,
        compatibility_reason="Chemical Peels is mapped as clinically relevant after physician confirmation.",
        service_recommendations=[
            ServiceRecommendation(
                service_id=4,
                service_name="Chemical Peels",
                relationship_type="SECONDARY",
                reason="Potentially relevant after physician assessment.",
            )
        ],
        medication_suggestions=[
            MedicationSuggestion(
                name_or_class="Benzoyl peroxide",
                role="Topical acne option for doctor review.",
                considerations=["Review irritation risk."],
                requires_more_context=True,
            )
        ],
        medication_knowledge_version="ourskin-medication-support-v1",
        medication_guidance="Physician-review options only.",
        limitations=["Image-only assessment"],
    )


def test_split_csv_trims_deduplicates_and_bounds_items():
    assert _split_csv(" itching, pain, itching, burning ", 2) == ["itching", "pain"]


def test_doctor_observation_is_part_of_clinical_context():
    context = DermatologyClinicalContext(
        body_site="face",
        doctor_observation="Inflammatory papules concentrated on both cheeks.",
    )
    assert context.doctor_observation.startswith("Inflammatory")


def test_legacy_bridge_never_generates_ai_dosing():
    fields = _legacy_support_fields(_completed_result())
    assert "Usage: Doctor to determine" in fields["prescription_suggestions"]
    assert "Benzoyl peroxide" in fields["prescription_suggestions"]
    assert "%" not in fields["key_findings"]


def test_legacy_bridge_preserves_structured_service_compatibility_summary():
    fields = _legacy_support_fields(_completed_result())
    assert "Chemical Peels" in fields["treatment_suggestions"]
    assert "clinically relevant" in fields["recommendation"]


def test_diagnosis_report_can_link_versioned_ai_run():
    payload = DiagnosisReportCreate(
        ai_analysis_run_id=17,
        doctor_final_diagnosis="Acne vulgaris",
    )
    assert payload.ai_analysis_run_id == 17
    assert payload.skin_analysis_id is None
