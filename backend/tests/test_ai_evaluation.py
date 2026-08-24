from app.services.ai.clinical_evaluation import (
    derive_diagnosis_agreement,
    derive_medication_matches,
)
from app.services.ai.evaluation import evaluate_predictions


def test_primary_diagnosis_agreement_is_derived_without_model_confidence():
    outcome = derive_diagnosis_agreement(
        ai_status="COMPLETED",
        primary_code="ACNE_VULGARIS",
        primary_display="Acne vulgaris",
        differentials=[],
        doctor_final_diagnosis="Inflammatory acne vulgaris",
    )
    assert outcome.status == "AGREE"


def test_differential_match_is_partial_agreement():
    outcome = derive_diagnosis_agreement(
        ai_status="COMPLETED",
        primary_code="ECZEMATOUS_DERMATITIS",
        primary_display="Eczematous dermatitis",
        differentials=[
            {
                "condition_code": "CONTACT_DERMATITIS_PATTERN",
                "display_name": "Contact dermatitis pattern",
            }
        ],
        doctor_final_diagnosis="Contact dermatitis pattern",
    )
    assert outcome.status == "PARTIAL"
    assert outcome.matched_differential_code == "CONTACT_DERMATITIS_PATTERN"


def test_medication_use_is_literal_audit_signal_not_prescribing_logic():
    present, used, matches = derive_medication_matches(
        medication_suggestions=[
            {"name_or_class": "Benzoyl peroxide"},
            {"name_or_class": "Topical retinoid"},
        ],
        doctor_prescription="Medication: Benzoyl peroxide | Usage: physician instructions",
    )
    assert present is True
    assert used is True
    assert matches == ["Benzoyl peroxide"]


def test_evaluation_harness_scores_accuracy_abstention_and_services():
    metrics = evaluate_predictions(
        [
            {
                "expected_status": "COMPLETED",
                "expected_condition_codes": ["ACNE_VULGARIS"],
                "expected_service_names": ["Consultation"],
                "prediction": {
                    "status": "COMPLETED",
                    "primary_condition_code": "ACNE_VULGARIS",
                    "differentials": [],
                    "service_recommendations": [{"service_name": "Consultation"}],
                },
            },
            {
                "expected_status": "OUT_OF_SCOPE",
                "expected_condition_codes": [],
                "prediction": {
                    "status": "OUT_OF_SCOPE",
                    "primary_condition_code": None,
                    "differentials": [],
                    "service_recommendations": [],
                },
            },
            {
                "expected_status": "COMPLETED",
                "expected_condition_codes": ["PSORIASIS"],
                "prediction": {
                    "status": "COMPLETED",
                    "primary_condition_code": "ECZEMATOUS_DERMATITIS",
                    "differentials": [
                        {"condition_code": "PSORIASIS"},
                    ],
                    "service_recommendations": [],
                },
            },
        ]
    )

    assert metrics.total_cases == 3
    assert metrics.primary_accuracy == 0.5
    assert metrics.top_k_recall == 1.0
    assert metrics.correct_abstention_rate == 1.0
    assert metrics.out_of_scope_recall == 1.0
    assert metrics.service_mapping_accuracy == 1.0
