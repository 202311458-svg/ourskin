from types import SimpleNamespace

from app.routes.ai_phase3 import _legacy_support_fields, _split_csv
from app.schemas.ai_analysis import DermatologyClinicalContext
from app.schemas.diagnosis_report import DiagnosisReportCreate


def test_split_csv_trims_deduplicates_and_bounds_items():
    assert _split_csv(" itching, pain, itching, burning ", 2) == [
        "itching",
        "pain",
    ]


def test_doctor_observation_is_part_of_clinical_context():
    context = DermatologyClinicalContext(
        body_site="face",
        doctor_observation=(
            "Inflammatory papules concentrated on both cheeks."
        ),
    )
    assert context.doctor_observation.startswith("Inflammatory")


def test_compatibility_projection_does_not_generate_dosing_or_confidence():
    result = SimpleNamespace(
        primary_condition_display="Acne vulgaris",
        differentials=[],
        visual_findings=[],
        service_recommendations=[],
        medication_suggestions=[
            SimpleNamespace(
                name_or_class="Benzoyl peroxide",
                role="Topical acne option for doctor review.",
            )
        ],
        red_flags=[],
        severity=SimpleNamespace(assessable=False, level=None),
        compatibility_reason=None,
        medication_guidance="Physician-review options only.",
    )

    fields = _legacy_support_fields(result)

    assert "Usage: Doctor to determine" in fields["prescription_suggestions"]
    assert "%" not in fields["key_findings"]


def test_diagnosis_report_can_link_versioned_ai_run():
    payload = DiagnosisReportCreate(
        ai_analysis_run_id=17,
        doctor_final_diagnosis="Acne vulgaris",
    )
    assert payload.ai_analysis_run_id == 17
    assert payload.skin_analysis_id is None
