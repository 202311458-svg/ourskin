from app.routes.ai_phase3 import _split_csv
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


def test_diagnosis_report_can_link_versioned_ai_run():
    payload = DiagnosisReportCreate(
        ai_analysis_run_id=17,
        doctor_final_diagnosis="Acne vulgaris",
    )
    assert payload.ai_analysis_run_id == 17
    assert payload.skin_analysis_id is None
