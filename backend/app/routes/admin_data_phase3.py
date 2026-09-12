from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session, aliased

from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.appointment import AppointmentModel
from app.models.audit_log import AuditLog
from app.models.dermatology_condition import DermatologyCondition
from app.models.diagnosis_report import DiagnosisReport
from app.models.user import User
from app.routes.admin import (
    require_admin,
    serialize_admin_appointment,
    serialize_admin_user,
    validate_pagination,
)
from app.schemas.pagination import get_total_pages

router = APIRouter(prefix="/admin", tags=["Admin Data"])


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _contains(column, term: str):
    return column.ilike(f"%{term}%")


def _user_summary(db: Session) -> dict[str, int]:
    total = db.query(User).count()
    patients = db.query(User).filter(func.lower(User.role) == "patient").count()
    internal = (
        db.query(User)
        .filter(func.lower(User.role).in_(["admin", "staff", "doctor"]))
        .count()
    )
    verified = db.query(User).filter(User.is_verified.is_(True)).count()
    minors = (
        db.query(User)
        .filter(func.lower(User.role) == "patient", User.is_minor.is_(True))
        .count()
    )
    return {
        "total": total,
        "patients": patients,
        "internal": internal,
        "verified": verified,
        "minors": minors,
    }


@router.get("/users/query")
def query_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    role: Optional[str] = Query(default=None, max_length=32),
    verification: Optional[str] = Query(default=None, max_length=32),
    patient_type: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)
    query = db.query(User)

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(User.name, keyword),
                _contains(User.first_name, keyword),
                _contains(User.last_name, keyword),
                _contains(User.email, keyword),
                _contains(User.contact, keyword),
                _contains(User.address, keyword),
                _contains(User.guardian_first_name, keyword),
                _contains(User.guardian_last_name, keyword),
                _contains(User.guardian_email, keyword),
                _contains(User.guardian_contact, keyword),
                _contains(User.specialty, keyword),
                _contains(User.department, keyword),
            )
        )

    role_value = _clean(role).lower()
    if role_value and role_value != "all":
        query = query.filter(func.lower(User.role) == role_value)

    verification_value = _clean(verification).lower()
    if verification_value == "verified":
        query = query.filter(User.is_verified.is_(True))
    elif verification_value == "unverified":
        query = query.filter(User.is_verified.is_(False))

    patient_type_value = _clean(patient_type).lower()
    if patient_type_value == "minor":
        query = query.filter(
            func.lower(User.role) == "patient",
            User.is_minor.is_(True),
        )
    elif patient_type_value == "adult":
        query = query.filter(
            func.lower(User.role) == "patient",
            User.is_minor.is_(False),
        )
    elif patient_type_value == "internal":
        query = query.filter(func.lower(User.role).in_(["admin", "staff", "doctor"]))

    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _user_summary(db),
        "items": [serialize_admin_user(user) for user in users],
    }


def _appointment_summary(db: Session) -> dict[str, int]:
    total = db.query(AppointmentModel).count()
    pending = (
        db.query(AppointmentModel)
        .filter(func.lower(AppointmentModel.status) == "pending")
        .count()
    )
    initial_evaluation = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.is_initial_evaluation_request.is_(True),
            func.lower(AppointmentModel.status) == "pending",
        )
        .count()
    )
    approved = (
        db.query(AppointmentModel)
        .filter(func.lower(AppointmentModel.status) == "approved")
        .count()
    )
    return {
        "total": total,
        "pending": pending,
        "initial_evaluation": initial_evaluation,
        "approved": approved,
    }


@router.get("/appointments/query")
def query_admin_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    status: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)

    patient = aliased(User)
    query = db.query(AppointmentModel).outerjoin(
        patient, patient.id == AppointmentModel.patient_id
    )

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(AppointmentModel.patient_name, keyword),
                _contains(AppointmentModel.patient_email, keyword),
                _contains(AppointmentModel.patient_contact, keyword),
                _contains(AppointmentModel.doctor_name, keyword),
                _contains(AppointmentModel.services, keyword),
                _contains(AppointmentModel.status, keyword),
                _contains(AppointmentModel.concern, keyword),
                _contains(patient.guardian_first_name, keyword),
                _contains(patient.guardian_last_name, keyword),
                _contains(patient.guardian_email, keyword),
                _contains(patient.guardian_contact, keyword),
                cast(AppointmentModel.id, String).ilike(f"%{keyword}%"),
            )
        )

    status_value = _clean(status).lower()
    if status_value and status_value != "all":
        query = query.filter(func.lower(AppointmentModel.status) == status_value)

    total = query.count()
    appointments = (
        query.order_by(AppointmentModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _appointment_summary(db),
        "items": [serialize_admin_appointment(item, db) for item in appointments],
    }


def _action_has(*terms: str):
    upper_action = func.upper(func.coalesce(AuditLog.action, ""))
    return or_(*(upper_action.like(f"%{term}%") for term in terms))


def _audit_module_conditions():
    account_raw = _action_has("STAFF", "USER", "ACCOUNT", "ROLE")
    appointment_raw = _action_has("APPOINTMENT")
    medical_raw = _action_has("AI", "ANALYSIS", "DOCTOR", "PATIENT", "DIAGNOSIS")
    return {
        "Account Management": account_raw,
        "Appointments": and_(~account_raw, appointment_raw),
        "Medical Records": and_(~account_raw, ~appointment_raw, medical_raw),
        "System": and_(~account_raw, ~appointment_raw, ~medical_raw),
    }


def _audit_action_conditions():
    create_raw = _action_has("CREATE", "PROMOTE")
    update_raw = _action_has("UPDATE", "EDIT")
    status_raw = _action_has("DEACTIVATE", "INACTIVE", "STATUS")
    danger_raw = _action_has("DELETE", "REMOVE")
    return {
        "create": create_raw,
        "update": and_(~create_raw, update_raw),
        "status": and_(~create_raw, ~update_raw, status_raw),
        "danger": and_(~create_raw, ~update_raw, ~status_raw, danger_raw),
        "system": and_(~create_raw, ~update_raw, ~status_raw, ~danger_raw),
    }


def _audit_summary(db: Session) -> dict[str, int]:
    modules = _audit_module_conditions()
    return {
        "total": db.query(AuditLog).count(),
        "account": db.query(AuditLog).filter(modules["Account Management"]).count(),
        "appointment": db.query(AuditLog).filter(modules["Appointments"]).count(),
        "medical": db.query(AuditLog).filter(modules["Medical Records"]).count(),
        "system": db.query(AuditLog).filter(modules["System"]).count(),
    }


@router.get("/audit-logs/query")
def query_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    module: Optional[str] = Query(default=None, max_length=64),
    action_type: Optional[str] = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)

    actor = aliased(User)
    target = aliased(User)
    query = (
        db.query(AuditLog)
        .outerjoin(actor, actor.id == AuditLog.actor_id)
        .outerjoin(target, target.id == AuditLog.target_id)
    )

    keyword = _clean(search)
    if keyword:
        query = query.filter(
            or_(
                _contains(AuditLog.action, keyword),
                _contains(AuditLog.description, keyword),
                _contains(AuditLog.performed_by, keyword),
                _contains(actor.name, keyword),
                _contains(actor.email, keyword),
                _contains(target.name, keyword),
                _contains(target.email, keyword),
                cast(AuditLog.actor_id, String).ilike(f"%{keyword}%"),
                cast(AuditLog.target_id, String).ilike(f"%{keyword}%"),
                cast(AuditLog.target_record_id, String).ilike(f"%{keyword}%"),
            )
        )

    module_conditions = _audit_module_conditions()
    module_value = _clean(module)
    if module_value and module_value.lower() != "all" and module_value in module_conditions:
        query = query.filter(module_conditions[module_value])

    action_conditions = _audit_action_conditions()
    action_value = _clean(action_type).lower()
    if action_value and action_value != "all" and action_value in action_conditions:
        query = query.filter(action_conditions[action_value])

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    actor_ids = {item.actor_id for item in logs if item.actor_id is not None}
    target_ids = {item.target_id for item in logs if item.target_id is not None}
    user_ids = actor_ids | target_ids
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {item.id: item for item in users}

    items = []
    for log in logs:
        actor_user = user_map.get(log.actor_id)
        target_user = user_map.get(log.target_id)
        action_upper = (log.action or "").upper()

        if any(token in action_upper for token in ("STAFF", "USER", "ACCOUNT", "ROLE")):
            module_name = "Account Management"
        elif "APPOINTMENT" in action_upper:
            module_name = "Appointments"
        elif any(token in action_upper for token in ("AI", "ANALYSIS", "DOCTOR", "PATIENT", "DIAGNOSIS")):
            module_name = "Medical Records"
        else:
            module_name = "System"

        if any(token in action_upper for token in ("CREATE", "PROMOTE")):
            action_name = "create"
        elif any(token in action_upper for token in ("UPDATE", "EDIT")):
            action_name = "update"
        elif any(token in action_upper for token in ("DEACTIVATE", "INACTIVE", "STATUS")):
            action_name = "status"
        elif any(token in action_upper for token in ("DELETE", "REMOVE")):
            action_name = "danger"
        else:
            action_name = "system"

        items.append(
            {
                "id": log.id,
                "action": log.action,
                "description": log.description,
                "performed_by": log.performed_by,
                "actor_id": log.actor_id,
                "actor_name": actor_user.name if actor_user else None,
                "actor_role": log.actor_role,
                "target_id": log.target_id,
                "target_name": target_user.name if target_user else None,
                "target_type": log.target_type,
                "target_record_id": log.target_record_id,
                "before_data": log.before_data,
                "after_data": log.after_data,
                "metadata_json": log.metadata_json,
                "module": module_name,
                "action_type": action_name,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "summary": _audit_summary(db),
        "items": items,
    }


@router.get("/ai-monitor/query")
def query_ai_monitor(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=160),
    mode: Optional[str] = Query(default=None, max_length=64),
    review_status: Optional[str] = Query(default=None, max_length=64),
    agreement: Optional[str] = Query(default=None, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    validate_pagination(page, page_size)

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

    appointment_ids = {item.appointment_id for item in runs}
    condition_ids = {item.primary_condition_id for item in runs if item.primary_condition_id}
    run_ids = {item.id for item in runs}

    appointments = {
        item.id: item
        for item in db.query(AppointmentModel)
        .filter(AppointmentModel.id.in_(appointment_ids))
        .all()
    } if appointment_ids else {}
    conditions = {
        item.id: item
        for item in db.query(DermatologyCondition)
        .filter(DermatologyCondition.id.in_(condition_ids))
        .all()
    } if condition_ids else {}
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
                "diagnosis_agreement": evaluation.diagnosis_agreement if evaluation else None,
                "evaluation_basis": evaluation.evaluation_basis if evaluation else None,
                "matched_differential_code": evaluation.matched_differential_code if evaluation else None,
                "matched_differential_display": evaluation.matched_differential_display if evaluation else None,
                "medication_suggestions_present": evaluation.medication_suggestions_present if evaluation else None,
                "medication_suggestion_used": evaluation.medication_suggestion_used if evaluation else None,
                "medication_matches": evaluation.medication_matches if evaluation else [],
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": get_total_pages(total, page_size),
        "items": items,
    }
