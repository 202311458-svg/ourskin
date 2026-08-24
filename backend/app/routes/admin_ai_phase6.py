from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.appointment import AppointmentModel
from app.models.dermatology_condition import DermatologyCondition
from app.models.diagnosis_report import DiagnosisReport
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.schemas.pagination import get_total_pages


router = APIRouter(prefix="/admin", tags=["Admin AI Evaluation"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")
    return current_user


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _condition_map(db: Session, condition_ids: set[int]) -> dict[int, DermatologyCondition]:
    if not condition_ids:
        return {}
    return {
        item.id: item
        for item in db.query(DermatologyCondition)
        .filter(DermatologyCondition.id.in_(condition_ids))
        .all()
    }


@router.get("/ai-monitor")
def get_ai_monitor(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    mode: str | None = Query(default=None),
    review_status: str | None = Query(default=None),
    agreement: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(AIAnalysisRun)

    if mode and mode != "ALL":
        query = query.filter(AIAnalysisRun.analysis_mode == mode)
    if review_status and review_status != "ALL":
        query = query.filter(AIAnalysisRun.review_status == review_status)
    if agreement and agreement != "ALL":
        query = query.join(
            AIClinicalEvaluation,
            AIClinicalEvaluation.ai_analysis_run_id == AIAnalysisRun.id,
        ).filter(AIClinicalEvaluation.diagnosis_agreement == agreement)

    total = query.count()
    runs = (
        query.order_by(AIAnalysisRun.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    appointment_ids = {item.appointment_id for item in runs}
    condition_ids = {item.primary_condition_id for item in runs if item.primary_condition_id}
    run_ids = {item.id for item in runs}

    appointments = {
        item.id: item
        for item in db.query(AppointmentModel)
        .filter(AppointmentModel.id.in_(appointment_ids))
        .all()
    } if appointment_ids else {}
    conditions = _condition_map(db, condition_ids)

    evaluations = {
        item.ai_analysis_run_id: item
        for item in db.query(AIClinicalEvaluation)
        .filter(AIClinicalEvaluation.ai_analysis_run_id.in_(run_ids))
        .all()
    } if run_ids else {}
    reports = {
        item.ai_analysis_run_id: item
        for item in db.query(DiagnosisReport)
        .filter(DiagnosisReport.ai_analysis_run_id.in_(run_ids))
        .all()
        if item.ai_analysis_run_id is not None
    } if run_ids else {}

    items = []
    for run in runs:
        appointment = appointments.get(run.appointment_id)
        condition = conditions.get(run.primary_condition_id)
        evaluation = evaluations.get(run.id)
        report = reports.get(run.id)

        items.append(
            {
                "id": run.id,
                "appointment_id": run.appointment_id,
                "patient_name": appointment.patient_name if appointment else "Unknown Patient",
                "patient_email": appointment.patient_email if appointment else "",
                "doctor_name": appointment.doctor_name if appointment else None,
                "booked_service": appointment.services if appointment else None,
                "analysis_mode": run.analysis_mode,
                "status": run.status,
                "primary_condition_code": condition.code if condition else None,
                "primary_condition_display": condition.display_name if condition else None,
                "evidence_strength": run.evidence_strength,
                "severity_level": run.severity_level,
                "service_compatibility": run.service_compatibility,
                "progress_trend": run.progress_trend,
                "comparison_reliable": run.comparison_reliable,
                "review_status": run.review_status,
                "model_provider": run.model_provider,
                "model_id": run.model_id,
                "model_version": run.model_version,
                "pipeline_version": run.pipeline_version,
                "taxonomy_version": run.taxonomy_version,
                "latency_ms": run.latency_ms,
                "red_flags": run.red_flags or [],
                "limitations": run.limitations or [],
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "reviewed_at": run.reviewed_at.isoformat() if run.reviewed_at else None,
                "diagnosis_report_id": report.id if report else None,
                "doctor_final_diagnosis": (
                    evaluation.doctor_final_diagnosis
                    if evaluation
                    else report.doctor_final_diagnosis if report else None
                ),
                "diagnosis_agreement": (
                    evaluation.diagnosis_agreement if evaluation else None
                ),
                "evaluation_basis": evaluation.evaluation_basis if evaluation else None,
                "matched_differential_code": (
                    evaluation.matched_differential_code if evaluation else None
                ),
                "matched_differential_display": (
                    evaluation.matched_differential_display if evaluation else None
                ),
                "medication_suggestions_present": (
                    evaluation.medication_suggestions_present if evaluation else None
                ),
                "medication_suggestion_used": (
                    evaluation.medication_suggestion_used if evaluation else None
                ),
                "medication_matches": (
                    evaluation.medication_matches if evaluation else []
                ),
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "items": items,
    }


@router.get("/ai-evaluation/summary")
def get_ai_evaluation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    runs = db.query(AIAnalysisRun).all()
    evaluations = db.query(AIClinicalEvaluation).all()

    mode_counts = Counter(item.analysis_mode for item in runs)
    status_counts = Counter(item.status for item in runs)
    evidence_counts = Counter(item.evidence_strength or "NONE" for item in runs)
    compatibility_counts = Counter(
        item.service_compatibility or "NOT_ASSESSED"
        for item in runs
        if item.analysis_mode == "DERMATOLOGY_ASSESSMENT"
    )
    progress_counts = Counter(
        item.progress_trend or "BASELINE_OR_NOT_COMPARED"
        for item in runs
        if item.analysis_mode == "RECOVERY_PROGRESS"
    )
    model_counts = Counter(
        f"{item.model_provider or 'none'}:{item.model_id or 'not_recorded'}"
        for item in runs
    )

    agreement_counts = Counter(item.diagnosis_agreement for item in evaluations)
    assessed_agreement = sum(
        agreement_counts.get(key, 0)
        for key in ("AGREE", "PARTIAL", "DISAGREE")
    )
    aligned = agreement_counts.get("AGREE", 0)
    top2_aligned = aligned + agreement_counts.get("PARTIAL", 0)

    med_cases = [
        item
        for item in evaluations
        if item.medication_suggestions_present
        and item.medication_suggestion_used is not None
    ]
    med_used = sum(1 for item in med_cases if item.medication_suggestion_used)

    latency_values = [item.latency_ms for item in runs if item.latency_ms is not None]
    average_latency = (
        round(sum(latency_values) / len(latency_values), 1)
        if latency_values
        else None
    )

    versioned_mirrors = (
        db.query(AIAnalysisRun)
        .filter(AIAnalysisRun.legacy_skin_analysis_id.isnot(None))
        .count()
    )
    legacy_total = db.query(SkinAnalysis).count()

    return {
        "total_runs": len(runs),
        "reviewed_runs": sum(1 for item in runs if item.review_status == "REVIEWED"),
        "pending_runs": sum(
            1 for item in runs if item.review_status == "PENDING_REVIEW"
        ),
        "dermatology_runs": mode_counts.get("DERMATOLOGY_ASSESSMENT", 0),
        "progress_runs": mode_counts.get("RECOVERY_PROGRESS", 0),
        "evaluated_diagnosis_runs": len(evaluations),
        "agreement_counts": dict(sorted(agreement_counts.items())),
        "primary_agreement_rate": _pct(aligned, assessed_agreement),
        "primary_or_differential_alignment_rate": _pct(top2_aligned, assessed_agreement),
        "medication_review_cases": len(med_cases),
        "medication_option_used_cases": med_used,
        "medication_option_use_rate": _pct(med_used, len(med_cases)),
        "average_latency_ms": average_latency,
        "mode_counts": dict(sorted(mode_counts.items())),
        "status_counts": dict(sorted(status_counts.items())),
        "evidence_counts": dict(sorted(evidence_counts.items())),
        "compatibility_counts": dict(sorted(compatibility_counts.items())),
        "progress_trend_counts": dict(sorted(progress_counts.items())),
        "model_counts": dict(sorted(model_counts.items())),
        "legacy_records_retained": max(0, legacy_total - versioned_mirrors),
        "methodology": {
            "diagnosis_agreement": (
                "Derived text-match audit signal: AGREE when the doctor final diagnosis "
                "matches the AI primary consideration, PARTIAL when it matches an AI "
                "differential, DISAGREE otherwise, and NOT_ASSESSABLE for non-completed "
                "or non-diagnostic runs."
            ),
            "medication_use": (
                "Derived literal name/class match between physician-review medication "
                "options and the doctor-authored prescription. It measures uptake, not "
                "appropriateness or treatment efficacy."
            ),
            "clinical_validation": (
                "Operational agreement metrics are not clinical accuracy claims. "
                "Clinical performance requires a separate de-identified, clinician-reviewed "
                "evaluation dataset."
            ),
        },
    }
