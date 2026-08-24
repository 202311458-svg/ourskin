from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class EvaluationMetrics:
    total_cases: int
    condition_cases: int
    primary_accuracy: float | None
    top_k_recall: float | None
    abstention_cases: int
    correct_abstention_rate: float | None
    out_of_scope_recall: float | None
    direct_review_recall: float | None
    image_quality_rejection_recall: float | None
    service_mapping_accuracy: float | None
    status_counts: dict[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "total_cases": self.total_cases,
            "condition_cases": self.condition_cases,
            "primary_accuracy": self.primary_accuracy,
            "top_k_recall": self.top_k_recall,
            "abstention_cases": self.abstention_cases,
            "correct_abstention_rate": self.correct_abstention_rate,
            "out_of_scope_recall": self.out_of_scope_recall,
            "direct_review_recall": self.direct_review_recall,
            "image_quality_rejection_recall": self.image_quality_rejection_recall,
            "service_mapping_accuracy": self.service_mapping_accuracy,
            "status_counts": self.status_counts,
        }


def _ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def _normalize_set(values: Iterable[str] | None) -> set[str]:
    return {str(item).strip().upper() for item in (values or []) if str(item).strip()}


def evaluate_predictions(cases: list[dict[str, Any]]) -> EvaluationMetrics:
    primary_hits = 0
    top_k_hits = 0
    condition_cases = 0

    abstention_cases = 0
    correct_abstentions = 0

    expected_out_of_scope = 0
    correct_out_of_scope = 0
    expected_direct_review = 0
    correct_direct_review = 0
    expected_bad_image = 0
    correct_bad_image = 0

    service_cases = 0
    service_hits = 0
    status_counts: Counter[str] = Counter()

    abstention_statuses = {
        "UNCERTAIN",
        "INSUFFICIENT_IMAGE",
        "OUT_OF_SCOPE",
        "REQUIRES_DIRECT_REVIEW",
        "FAILED",
    }

    for case in cases:
        prediction = case.get("prediction") or {}
        predicted_status = str(prediction.get("status") or "UNKNOWN").upper()
        status_counts[predicted_status] += 1

        expected_status = str(case.get("expected_status") or "COMPLETED").upper()
        expected_codes = _normalize_set(case.get("expected_condition_codes"))
        predicted_primary = str(
            prediction.get("primary_condition_code") or ""
        ).strip().upper()
        predicted_differentials = _normalize_set(
            item.get("condition_code")
            for item in (prediction.get("differentials") or [])
            if isinstance(item, dict)
        )

        if expected_codes:
            condition_cases += 1
            if predicted_primary in expected_codes:
                primary_hits += 1
            if predicted_primary in expected_codes or predicted_differentials & expected_codes:
                top_k_hits += 1

        expected_abstain = expected_status in abstention_statuses
        if expected_abstain:
            abstention_cases += 1
            if predicted_status == expected_status:
                correct_abstentions += 1

        if expected_status == "OUT_OF_SCOPE":
            expected_out_of_scope += 1
            if predicted_status == "OUT_OF_SCOPE":
                correct_out_of_scope += 1

        if expected_status == "REQUIRES_DIRECT_REVIEW":
            expected_direct_review += 1
            if predicted_status == "REQUIRES_DIRECT_REVIEW":
                correct_direct_review += 1

        if expected_status == "INSUFFICIENT_IMAGE":
            expected_bad_image += 1
            if predicted_status == "INSUFFICIENT_IMAGE":
                correct_bad_image += 1

        expected_services = {
            str(item).strip().lower()
            for item in (case.get("expected_service_names") or [])
            if str(item).strip()
        }
        if expected_services:
            service_cases += 1
            predicted_services = {
                str(item.get("service_name") or "").strip().lower()
                for item in (prediction.get("service_recommendations") or [])
                if isinstance(item, dict)
            }
            if predicted_services & expected_services:
                service_hits += 1

    return EvaluationMetrics(
        total_cases=len(cases),
        condition_cases=condition_cases,
        primary_accuracy=_ratio(primary_hits, condition_cases),
        top_k_recall=_ratio(top_k_hits, condition_cases),
        abstention_cases=abstention_cases,
        correct_abstention_rate=_ratio(correct_abstentions, abstention_cases),
        out_of_scope_recall=_ratio(correct_out_of_scope, expected_out_of_scope),
        direct_review_recall=_ratio(correct_direct_review, expected_direct_review),
        image_quality_rejection_recall=_ratio(correct_bad_image, expected_bad_image),
        service_mapping_accuracy=_ratio(service_hits, service_cases),
        status_counts=dict(sorted(status_counts.items())),
    )
