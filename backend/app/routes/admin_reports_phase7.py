from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.appointment import AppointmentModel
from app.models.dermatology_condition import DermatologyCondition
from app.models.user import User
from app.routes.admin import require_admin
from app.routes.admin_ai_oversight_phase7 import _ai_evaluation_summary

router = APIRouter(prefix="/admin", tags=["Admin Reports Oversight"])


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _monthly_appointments(db: Session) -> list[dict]:
    grouped: dict[tuple[str, str], dict[str, int]] = defaultdict(
        lambda: {
            "total": 0,
            "pending": 0,
            "approved": 0,
            "completed": 0,
            "cancelled": 0,
            "declined": 0,
            "no_show": 0,
        }
    )
    for appointment_date, status in db.query(AppointmentModel.date, AppointmentModel.status).all():
        if appointment_date:
            key = appointment_date.strftime("%Y-%m")
            label = appointment_date.strftime("%B %Y")
        else:
            key, label = "0000-00", "No Date"
        values = grouped[(key, label)]
        values["total"] += 1
        normalized = _clean(status).lower().replace("-", "_")
        if normalized in values:
            values[normalized] += 1

    result = []
    for (key, label), values in grouped.items():
        result.append({"month": label, "_sort_key": key, **values})
    result.sort(key=lambda item: item["_sort_key"], reverse=True)
    for item in result:
        item.pop("_sort_key", None)
    return result


def _account_distribution(db: Session) -> list[dict]:
    groups: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total": 0, "active": 0, "inactive": 0, "verified": 0, "unverified": 0}
    )
    for role, status, is_verified in db.query(User.role, User.status, User.is_verified).all():
        key = _clean(role).lower() or "unknown"
        group = groups[key]
        group["total"] += 1
        group["active" if _clean(status or "Active").lower() == "active" else "inactive"] += 1
        group["verified" if is_verified else "unverified"] += 1
    return [{"role": role, **values} for role, values in sorted(groups.items())]


def _ai_condition_summary(db: Session) -> list[dict]:
    rows = (
        db.query(
            DermatologyCondition.display_name,
            AIAnalysisRun.evidence_strength,
            AIAnalysisRun.severity_level,
        )
        .outerjoin(DermatologyCondition, DermatologyCondition.id == AIAnalysisRun.primary_condition_id)
        .filter(AIAnalysisRun.analysis_mode == "DERMATOLOGY_ASSESSMENT")
        .all()
    )
    groups: dict[str, dict] = defaultdict(
        lambda: {"cases": 0, "evidence": Counter(), "severity": Counter()}
    )
    for display_name, evidence, severity in rows:
        label = display_name or "No primary condition"
        group = groups[label]
        group["cases"] += 1
        group["evidence"][evidence or "NONE"] += 1
        group["severity"][severity or "NOT_ASSESSED"] += 1

    result = []
    for condition, values in groups.items():
        severity_counts = values["severity"]
        common_severity = severity_counts.most_common(1)[0][0] if severity_counts else "NOT_ASSESSED"
        result.append(
            {
                "condition": condition,
                "cases": values["cases"],
                "evidence_counts": dict(sorted(values["evidence"].items())),
                "severity_counts": dict(sorted(severity_counts.items())),
                "common_severity": common_severity,
                "average_confidence": None,
            }
        )
    result.sort(key=lambda item: (-item["cases"], item["condition"]))
    return result


def _doctor_activity(db: Session) -> list[dict]:
    doctors = db.query(User.id, User.name, User.email).filter(func.lower(User.role) == "doctor").all()
    activity: dict[int, dict] = {
        doctor.id: {
            "doctor_id": doctor.id,
            "doctor_name": doctor.name or doctor.email or f"Doctor #{doctor.id}",
            "assigned_appointments": 0,
            "completed_appointments": 0,
            "versioned_ai_runs": 0,
            "pending_ai_reviews": 0,
            "reviewed_ai_cases": 0,
            "evaluated_ai_cases": 0,
        }
        for doctor in doctors
    }

    for doctor_id, status in db.query(AppointmentModel.doctor_id, AppointmentModel.status).filter(AppointmentModel.doctor_id.isnot(None)).all():
        if doctor_id not in activity:
            continue
        activity[doctor_id]["assigned_appointments"] += 1
        if _clean(status).lower() == "completed":
            activity[doctor_id]["completed_appointments"] += 1

    run_rows = (
        db.query(AppointmentModel.doctor_id, AIAnalysisRun.review_status)
        .join(AIAnalysisRun, AIAnalysisRun.appointment_id == AppointmentModel.id)
        .filter(AppointmentModel.doctor_id.isnot(None))
        .all()
    )
    for doctor_id, review_status in run_rows:
        if doctor_id not in activity:
            continue
        activity[doctor_id]["versioned_ai_runs"] += 1
        if review_status == "REVIEWED":
            activity[doctor_id]["reviewed_ai_cases"] += 1
        else:
            activity[doctor_id]["pending_ai_reviews"] += 1

    for doctor_id, count in (
        db.query(AIClinicalEvaluation.doctor_id, func.count(AIClinicalEvaluation.id))
        .filter(AIClinicalEvaluation.doctor_id.isnot(None))
        .group_by(AIClinicalEvaluation.doctor_id)
        .all()
    ):
        if doctor_id in activity:
            activity[doctor_id]["evaluated_ai_cases"] = int(count)

    result = list(activity.values())
    result.sort(key=lambda item: (-item["assigned_appointments"], item["doctor_name"]))
    return result


@router.get("/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    outcome_counts = Counter(
        _clean(status).lower().replace("-", "_") or "unknown"
        for (status,) in db.query(AppointmentModel.status).all()
    )
    total_appointments = sum(outcome_counts.values())
    total_users = db.query(User).count()
    active_users = db.query(User).filter(func.lower(User.status) == "active").count()
    inactive_users = total_users - active_users
    ai_summary = _ai_evaluation_summary(db)

    completed = outcome_counts.get("completed", 0)
    cancelled = outcome_counts.get("cancelled", 0)
    completed_cancelled = completed + cancelled

    account_distribution = _account_distribution(db)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overview": {
            "total_appointments": total_appointments,
            "pending_appointments": outcome_counts.get("pending", 0),
            "approved_appointments": outcome_counts.get("approved", 0),
            "completed_appointments": completed,
            "cancelled_appointments": cancelled,
            "declined_appointments": outcome_counts.get("declined", 0),
            "no_show_appointments": outcome_counts.get("no_show", 0),
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "total_ai_runs": ai_summary["total_runs"],
            "pending_ai_reviews": ai_summary["pending_runs"],
            "reviewed_ai_runs": ai_summary["reviewed_runs"],
            "evaluated_diagnosis_runs": ai_summary["evaluated_diagnosis_runs"],
        },
        "monthly_appointments": _monthly_appointments(db),
        "appointment_outcomes": dict(sorted(outcome_counts.items())),
        "completed_vs_cancelled": {
            "completed": completed,
            "cancelled": cancelled,
            "total": completed_cancelled,
            "completion_rate": _pct(completed, completed_cancelled) or 0,
            "cancellation_rate": _pct(cancelled, completed_cancelled) or 0,
        },
        "account_distribution": account_distribution,
        "user_growth": account_distribution,
        "ai_condition_summary": _ai_condition_summary(db),
        "ai_evaluation": ai_summary,
        "doctor_activity": _doctor_activity(db),
        "legacy_ai_records_retained": ai_summary["legacy_records_retained"],
        "reporting_notes": {
            "ai_source": "Versioned AIAnalysisRun records are the source of truth for AI oversight reporting.",
            "legacy_ai": "Legacy-only SkinAnalysis rows are retained and counted separately; they are not mixed into versioned AI metrics.",
            "agreement": ai_summary["methodology"]["clinical_validation"],
        },
    }
