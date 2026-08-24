from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.condition_service_mapping import ConditionServiceMapping
from app.models.dermatology_condition import DermatologyCondition
from app.models.service import Service
from app.schemas.ai_analysis import (
    AIAnalysisStatus,
    DermatologyClinicalContext,
    EvidenceStrength,
    ImageQualityAssessment,
    MedicationClinicalContext,
    PregnancyStatus,
    ProviderDermatologyResult,
    ServiceCompatibilityStatus,
    SeverityAssessment,
    SeverityLevel,
    VisualFinding,
)
from app.services.ai.contracts import TaxonomyCondition
from app.services.ai.dermatology_analysis_service import DermatologyAnalysisService
from app.services.ai.medication_suggestions import MedicationSuggestionService
from app.services.ai.service_compatibility import ServiceCompatibilityService
from app.services.ai.validator import ClinicalResultValidator


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    DermatologyCondition.__table__.create(engine)
    Service.__table__.create(engine)
    ConditionServiceMapping.__table__.create(engine)
    db = Session(engine)

    db.add_all(
        [
            Service(id=1, name="Consultation", is_active=True, requires_initial_evaluation=False),
            Service(id=2, name="Chemical Peels", is_active=True, requires_initial_evaluation=False),
            Service(id=3, name="Surgical", is_active=True, requires_initial_evaluation=True),
        ]
    )
    db.add_all(
        [
            DermatologyCondition(id=1, code="ACNE_VULGARIS", display_name="Acne vulgaris", category="inflammatory", support_level="SUPPORTED", image_assessment_supported=True, severity_assessment_supported=True, is_active=True),
            DermatologyCondition(id=2, code="ECZEMATOUS_DERMATITIS", display_name="Eczematous dermatitis", category="inflammatory", support_level="SUPPORTED", image_assessment_supported=True, severity_assessment_supported=False, is_active=True),
            DermatologyCondition(id=3, code="COMMON_WART", display_name="Common wart", category="infectious", support_level="SUPPORTED", image_assessment_supported=True, severity_assessment_supported=False, is_active=True),
            DermatologyCondition(id=4, code="CONTACT_DERMATITIS_PATTERN", display_name="Possible contact dermatitis", category="inflammatory", support_level="LIMITED", image_assessment_supported=True, severity_assessment_supported=False, is_active=True),
        ]
    )
    db.flush()
    db.add_all(
        [
            ConditionServiceMapping(condition_id=1, service_id=1, relationship_type="PRIMARY", priority=10, is_active=True),
            ConditionServiceMapping(condition_id=1, service_id=2, relationship_type="SECONDARY", priority=40, is_active=True),
            ConditionServiceMapping(condition_id=2, service_id=1, relationship_type="PRIMARY", priority=10, is_active=True),
            ConditionServiceMapping(condition_id=3, service_id=1, relationship_type="PRIMARY", priority=10, is_active=True),
            ConditionServiceMapping(condition_id=3, service_id=3, relationship_type="REVIEW_ONLY", priority=50, is_active=True),
            ConditionServiceMapping(condition_id=4, service_id=1, relationship_type="PRIMARY", priority=10, is_active=True),
        ]
    )
    db.commit()
    return db


def _condition(condition_id: int, code: str, name: str, support_level: str = "SUPPORTED", severity_supported: bool = False) -> TaxonomyCondition:
    return TaxonomyCondition(condition_id, code, name, "test", support_level, True, severity_supported)


def test_acne_can_be_compatible_with_booked_chemical_peel():
    outcome = ServiceCompatibilityService().evaluate(db=_db(), analysis_status=AIAnalysisStatus.COMPLETED, condition=_condition(1, "ACNE_VULGARIS", "Acne vulgaris"), booked_service_id=2, booked_service_name="Chemical Peels")
    assert outcome.status == ServiceCompatibilityStatus.COMPATIBLE
    assert any(item.service_name == "Chemical Peels" for item in outcome.recommendations)


def test_eczema_vs_booked_chemical_peel_is_different_concern():
    outcome = ServiceCompatibilityService().evaluate(db=_db(), analysis_status=AIAnalysisStatus.COMPLETED, condition=_condition(2, "ECZEMATOUS_DERMATITIS", "Eczematous dermatitis"), booked_service_id=2, booked_service_name="Chemical Peels")
    assert outcome.status == ServiceCompatibilityStatus.LIKELY_DIFFERENT_CONCERN
    assert outcome.recommendations[0].service_name == "Consultation"


def test_review_only_surgical_mapping_requires_doctor_review():
    outcome = ServiceCompatibilityService().evaluate(db=_db(), analysis_status=AIAnalysisStatus.COMPLETED, condition=_condition(3, "COMMON_WART", "Common wart"), booked_service_id=3, booked_service_name="Surgical")
    assert outcome.status == ServiceCompatibilityStatus.REVIEW_RECOMMENDED


def test_limited_support_finding_never_auto_marks_service_compatible():
    outcome = ServiceCompatibilityService().evaluate(db=_db(), analysis_status=AIAnalysisStatus.COMPLETED, condition=_condition(4, "CONTACT_DERMATITIS_PATTERN", "Possible contact dermatitis", support_level="LIMITED"), booked_service_id=1, booked_service_name="Consultation")
    assert outcome.status == ServiceCompatibilityStatus.REVIEW_RECOMMENDED


def test_out_of_scope_result_routes_toward_consultation():
    outcome = ServiceCompatibilityService().evaluate(db=_db(), analysis_status=AIAnalysisStatus.OUT_OF_SCOPE, condition=None, booked_service_id=2, booked_service_name="Chemical Peels")
    assert outcome.status == ServiceCompatibilityStatus.REVIEW_RECOMMENDED
    assert outcome.recommendations[0].service_name == "Consultation"


def test_acne_medication_options_are_context_aware_and_have_no_dosing():
    outcome = MedicationSuggestionService().suggest(analysis_status=AIAnalysisStatus.COMPLETED, evidence_strength=EvidenceStrength.HIGH, condition=_condition(1, "ACNE_VULGARIS", "Acne vulgaris"), dermatology_context=DermatologyClinicalContext(body_site="face"), medication_context=MedicationClinicalContext(age_years=20), red_flags=[])
    names = {item.name_or_class for item in outcome.suggestions}
    assert {"Benzoyl peroxide", "Topical retinoid", "Azelaic acid"} <= names
    retinoid = next(item for item in outcome.suggestions if item.name_or_class == "Topical retinoid")
    assert retinoid.requires_more_context is True
    assert "No dose" in outcome.guidance


def test_pregnancy_or_breastfeeding_excludes_retinoid_option():
    service = MedicationSuggestionService()
    for pregnancy_status in {PregnancyStatus.PREGNANT, PregnancyStatus.BREASTFEEDING}:
        outcome = service.suggest(analysis_status=AIAnalysisStatus.COMPLETED, evidence_strength=EvidenceStrength.HIGH, condition=_condition(1, "ACNE_VULGARIS", "Acne vulgaris"), dermatology_context=DermatologyClinicalContext(body_site="face"), medication_context=MedicationClinicalContext(age_years=20, pregnancy_status=pregnancy_status, reviewed_by_doctor=True), red_flags=[])
        assert "Topical retinoid" not in {item.name_or_class for item in outcome.suggestions}


def test_low_evidence_and_red_flags_withhold_medication_options():
    service = MedicationSuggestionService()
    low_evidence = service.suggest(analysis_status=AIAnalysisStatus.COMPLETED, evidence_strength=EvidenceStrength.LOW, condition=_condition(1, "ACNE_VULGARIS", "Acne vulgaris"), dermatology_context=DermatologyClinicalContext(), medication_context=MedicationClinicalContext(), red_flags=[])
    with_red_flags = service.suggest(analysis_status=AIAnalysisStatus.COMPLETED, evidence_strength=EvidenceStrength.HIGH, condition=_condition(1, "ACNE_VULGARIS", "Acne vulgaris"), dermatology_context=DermatologyClinicalContext(), medication_context=MedicationClinicalContext(), red_flags=["ulceration"])
    assert low_evidence.suggestions == []
    assert with_red_flags.suggestions == []


def test_limited_condition_withholds_medication_options():
    outcome = MedicationSuggestionService().suggest(analysis_status=AIAnalysisStatus.COMPLETED, evidence_strength=EvidenceStrength.MODERATE, condition=_condition(4, "CONTACT_DERMATITIS_PATTERN", "Possible contact dermatitis", support_level="LIMITED"), dermatology_context=DermatologyClinicalContext(), medication_context=MedicationClinicalContext(), red_flags=[])
    assert outcome.suggestions == []


class _GoodQuality:
    def assess(self, _image_bytes):
        return ImageQualityAssessment(usable=True)


class _FakeTaxonomyService:
    def list_active(self, _db):
        return [_condition(1, "ACNE_VULGARIS", "Acne vulgaris", severity_supported=True)]


class _FakeProvider:
    provider_name = "fake"
    model_id = "fake-model"

    def analyze_dermatology(self, **_kwargs):
        return ProviderDermatologyResult(status=AIAnalysisStatus.COMPLETED, primary_condition_code="ACNE_VULGARIS", primary_condition_display="Acne vulgaris", evidence_strength=EvidenceStrength.HIGH, visual_findings=[VisualFinding(finding="Inflammatory papules")], severity=SeverityAssessment(assessable=True, level=SeverityLevel.MODERATE, reason="Visible inflammatory burden"))


def test_analysis_service_enriches_provider_result_with_m3_intelligence():
    service = DermatologyAnalysisService(provider=_FakeProvider(), image_quality_service=_GoodQuality(), taxonomy_service=_FakeTaxonomyService(), result_validator=ClinicalResultValidator())
    execution = service.analyze(db=_db(), image_bytes=b"test", content_type="image/jpeg", context=DermatologyClinicalContext(body_site="face", booked_service_id=2, booked_service_name="Chemical Peels"), medication_context=MedicationClinicalContext(age_years=20))
    assert execution.result.service_compatibility == ServiceCompatibilityStatus.COMPATIBLE
    assert execution.result.medication_suggestions
    assert execution.result.medication_knowledge_version == "ourskin-medication-support-v1"
