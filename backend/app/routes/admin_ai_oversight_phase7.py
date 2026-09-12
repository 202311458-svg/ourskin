from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.appointment import AppointmentModel
from app.models.dermatology_condition import DermatologyCondition
from app.models.diagnosis_report import DiagnosisReport
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes.admin import require_admin, validate_pagination
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin AI Oversight"])


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _contains(column, term: str):
    return column.ilike(f"%{term}%")


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _serialize_ai_runs(db: Session, runs: list[AIAnalysisRun]) -> list[dict]:
    appointment_ids = {item.appointment_id for item in runs}
    condition_ids = {item.primary_condition_id for item in runs if item.primary_condition_id}
    run_ids = {item.id for item in runs}

    appointments = {
        item.id: item
        for item in db.query(AppointmentModel).filter(AppointmentModel.id.in_(appointment_ids)).all()
    } if appointment_ids else {}
    conditions = {
        item.id: item
        for item in db.query(DermatologyCondition).filter(DermatologyCondition.id.in_(condition_ids)).all()
    } if condition_ids else {}
    evaluations = {
        item.ai_analysis_run_id: item
        for item in db.query(AIClinicalEvaluation).filter(AIClinicalEvaluation.ai_analysis_run_id.in_(run_ids)).all()
    } if run_ids else {}
    reports = {
        item.ai_analysis_run_id: item
        for item in db.query(DiagnosisReport).filter(DiagnosisReport.ai_analysis_run_id.in_(run_ids)).all()
        if item.ai_analysis_run_id is not None
    } if run_ids else {}

    result = []
    for run in runs:
        appointment = appointments.get(run.appointment_id)
        condition = conditions.get(run.primary_condition_id)
        evaluation = evaluations.get(run.id)
        report = reports.get(run.id)
        result.append(
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
                "diagnosis_agreement": evaluation.diagnosis_agreement if evaluation else None,
                "evaluation_basis": evaluation.evaluation_basis if evaluation else None,
                "matched_differential_code": evaluation.matched_differential_code if evaluation else None,
                "matched_differential_display": evaluation.matched_differential_display if evaluation else None,
                "medication_suggestions_present": evaluation.medication_suggestions_present if evaluation else None,
                "medication_suggestion_used": evaluation.medication_suggestion_used if evaluation else None,
                "medication_matches": evaluation.medication_matches if evaluation else [],
            }
        )
    return result


@router.get("/ai-monitor/query")
def query_ai_monitor(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    mode: Optional[str] = Query(default=None, max_length=64),
    review_status: Optional[str] = Query(default=None, max_length=64),
    agreement: Optional[str] = Query(default=None, max_length=64),
    run_status: Optional[str] = Query(default=None, max_length=64),
    model: Optional[str] = Query(default=None, max_length=160),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")

    query = (
        db.query(AIAnalysisRun)
        .outerjoin(AppointmentModel, AppointmentModel.id == AIAnalysisRun.appointment_id)
        .outerjoin(DermatologyCondition, DermatologyCondition.id == AIAnalysisRun.primary_condition_id)
        .outerjoin(AIClinicalEvaluation, AIClinicalEvaluation.ai_analysis_run_id == AIAnalysisRun.id)
        .outerjoin(DiagnosisReport, DiagnosisReport.ai_analysis_run_id == AIAnalysisRun.id)
    )

    mode_value = _clean(mode)
    if mode_value and mode_value != "ALL":
        query = query.filter(AIAnalysisRun.analysis_mode == mode_value)
    review_value = _clean(review_status)
    if review_value and review_value != "ALL":
        query = query.filter(AIAnalysisRun.review_status == review_value)
    agreement_value = _clean(agreement)
    if agreement_value and agreement_value != "ALL":
        query = query.filter(AIClinicalEvaluation.diagnosis_agreement == agreement_value)
    run_status_value = _clean(run_status)
    if run_status_value and run_status_value != "ALL":
        query = query.filter(AIAnalysisRun.status == run_status_value)

    model_value = _clean(model)
    if model_value:
        query = query.filter(
            or_(
                _contains(AIAnalysisRun.model_id, model_value),
                _contains(AIAnalysisRun.model_provider, model_value),
                _contains(AIAnalysisRun.model_version, model_value),
            )
        )

    if date_from:
        query = query.filter(func.date(AIAnalysisRun.created_at) >= date_from.isoformat())
    if date_to:
        query = query.filter(func.date(AIAnalysisRun.created_at) <= date_to.isoformat())

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(AppointmentModel.patient_name, keyword),
                _contains(AppointmentModel.patient_email, keyword),
                _contains(AppointmentModel.doctor_name, keyword),
                _contains(AppointmentModel.services, keyword),
                _contains(DermatologyCondition.display_name, keyword),
                _contains(DermatologyCondition.code, keyword),
                _contains(AIClinicalEvaluation.doctor_final_diagnosis, keyword),
                _contains(DiagnosisReport.doctor_final_diagnosis, keyword),
                _contains(AIAnalysisRun.model_id, keyword),
                _contains(AIAnalysisRun.model_provider, keyword),
                cast(AIAnalysisRun.id, String).ilike(f"%{keyword}%"),
                cast(AIAnalysisRun.appointment_id, String).ilike(f"%{keyword}%"),
            )
        )

    query = query.distinct()
    total = query.count()
    runs = (
        query.order_by(AIAnalysisRun.created_at.desc(), AIAnalysisRun.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "items": _serialize_ai_runs(db, runs),
    }


def _ai_evaluation_summary(db: Session) -> dict:
    run_rows = db.query(
        AIAnalysisRun.analysis_mode,
        AIAnalysisRun.status,
        AIAnalysisRun.evidence_strength,
        AIAnalysisRun.service_compatibility,
        AIAnalysisRun.progress_trend,
        AIAnalysisRun.model_provider,
        AIAnalysisRun.model_id,
        AIAnalysisRun.latency_ms,
        AIAnalysisRun.review_status,
    ).all()
    evaluation_rows = db.query(
        AIClinicalEvaluation.diagnosis_agreement,
        AIClinicalEvaluation.medication_suggestions_present,
        AIClinicalEvaluation.medication_suggestion_used,
    ).all()

    mode_counts = Counter(row.analysis_mode for row in run_rows)
    status_counts = Counter(row.status for row in run_rows)
    evidence_counts = Counter(row.evidence_strength or "NONE" for row in run_rows)
    compatibility_counts = Counter(
        row.service_compatibility or "NOT_ASSESSED"
        for row in run_rows
        if row.analysis_mode == "DERMATOLOGY_ASSESSMENT"
    )
    progress_counts = Counter(
        row.progress_trend or "BASELINE_OR_NOT_COMPARED"
        for row in run_rows
        if row.analysis_mode == "RECOVERY_PROGRESS"
    )
    model_counts = Counter(
        f"{row.model_provider or 'none'}:{row.model_id or 'not_recorded'}"
        for row in run_rows
    )
    agreement_counts = Counter(row.diagnosis_agreement for row in evaluation_rows)
    assessed = sum(agreement_counts.get(key, 0) for key in ("AGREE", "PARTIAL", "DISAGREE"))
    aligned = agreement_counts.get("AGREE", 0)
    top2 = aligned + agreement_counts.get("PARTIAL", 0)
    medication_cases = [
        row for row in evaluation_rows
        if row.medication_suggestions_present and row.medication_suggestion_used is not None
    ]
    medication_used = sum(1 for row in medication_cases if row.medication_suggestion_used)
    latency = [row.latency_ms for row in run_rows if row.latency_ms is not None]

    legacy_total = db.query(SkinAnalysis).count()
    versioned_mirrors = db.query(AIAnalysisRun).filter(AIAnalysisRun.legacy_skin_analysis_id.isnot(None)).count()
    return {
        "total_runs": len(run_rows),
        "reviewed_runs": sum(1 for row in run_rows if row.review_status == "REVIEWED"),
        "pending_runs": sum(1 for row in run_rows if row.review_status == "PENDING_REVIEW"),
        "dermatology_runs": mode_counts.get("DERMATOLOGY_ASSESSMENT", 0),
        "progress_runs": mode_counts.get("RECOVERY_PROGRESS", 0),
        "evaluated_diagnosis_runs": len(evaluation_rows),
        "agreement_counts": dict(sorted(agreement_counts.items())),
        "primary_agreement_rate": _pct(aligned, assessed),
        "primary_or_differential_alignment_rate": _pct(top2, assessed),
        "medication_review_cases": len(medication_cases),
        "medication_option_used_cases": medication_used,
        "medication_option_use_rate": _pct(medication_used, len(medication_cases)),
        "average_latency_ms": round(sum(latency) / len(latency), 1) if latency else None,
        "mode_counts": dict(sorted(mode_counts.items())),
        "status_counts": dict(sorted(status_counts.items())),
        "evidence_counts": dict(sorted(evidence_counts.items())),
        "compatibility_counts": dict(sorted(compatibility_counts.items())),
        "progress_trend_counts": dict(sorted(progress_counts.items())),
        "model_counts": dict(sorted(model_counts.items())),
        "legacy_records_retained": max(0, legacy_total - versioned_mirrors),
        "methodology": {
            "diagnosis_agreement": (
                "Derived deterministic text-match audit signal between the doctor final diagnosis and the AI primary/differential considerations."
            ),
            "medication_use": (
                "Derived literal medication name/class match between physician-review AI options and the doctor-authored prescription."
            ),
            "clinical_validation": (
                "Operational agreement metrics are not clinical accuracy claims. Clinical performance requires a separate de-identified, clinician-reviewed evaluation dataset."
            ),
        },
    }


