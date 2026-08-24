from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.authorization import doctor_appointments_query, get_doctor_appointment_or_404
from app.core.security import get_current_user
from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.appointment import AppointmentModel
from app.models.diagnosis_report import DiagnosisReport
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes import doctor as doctor_routes
from app.routes.ai_phase3 import serialize_ai_run
from app.routes.doctor_phase1 import ensure_appointment_has_started
from app.schemas.diagnosis_report import DiagnosisReportCreate


router = APIRouter(prefix="/doctor", tags=["Doctor Portal"])


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return current_user


def _serialize_appointment_m4(appt: AppointmentModel) -> dict:
    data = doctor_routes.serialize_appointment(appt)
    data.update(
        {
            "service_id": appt.service_id,
            "concern": appt.concern,
            "patient_age": appt.patient_age,
            "patient_age_label": appt.patient_age_label,
            "appointment_type": appt.appointment_type,
            "consultation_mode": appt.consultation_mode,
            "is_initial_evaluation_request": appt.is_initial_evaluation_request,
        }
    )
    return data


def _serialize_report_m4(report: DiagnosisReport) -> dict:
    data = doctor_routes.serialize_diagnosis_report(report)
    data["ai_analysis_run_id"] = report.ai_analysis_run_id
    return data


def _get_owned_run(
    db: Session,
    *,
    run_id: int,
    appointment_id: int,
    doctor_id: int,
) -> AIAnalysisRun:
    run = (
        db.query(AIAnalysisRun)
        .join(AppointmentModel, AIAnalysisRun.appointment_id == AppointmentModel.id)
        .filter(
            AIAnalysisRun.id == run_id,
            AIAnalysisRun.appointment_id == appointment_id,
            AppointmentModel.doctor_id == doctor_id,
        )
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Selected AI analysis run not found")
    return run


def _get_owned_legacy_analysis(
    db: Session,
    *,
    analysis_id: int,
    appointment_id: int,
    doctor_id: int,
) -> SkinAnalysis:
    analysis = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(
            SkinAnalysis.id == analysis_id,
            SkinAnalysis.appointment_id == appointment_id,
            AppointmentModel.doctor_id == doctor_id,
        )
        .first()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="Selected skin analysis not found")
    return analysis


@router.get("/appointments")
def get_doctor_appointments_m4(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = doctor_appointments_query(db, current_user.id)
    if status and status != "All":
        query = query.filter(AppointmentModel.status == status)

    appointments = (
        query.order_by(AppointmentModel.date.asc(), AppointmentModel.time.asc()).all()
    )
    return [_serialize_appointment_m4(item) for item in appointments]


@router.post("/appointments/{appointment_id}/complete-with-report")
def complete_appointment_with_ai_report_m4(
    appointment_id: int,
    payload: DiagnosisReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, current_user.id)
    ensure_appointment_has_started(appointment)

    if appointment.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved appointments can be completed with a diagnosis report",
        )

    existing_report = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.appointment_id == appointment_id)
        .first()
    )
    if existing_report:
        raise HTTPException(
            status_code=400,
            detail="Diagnosis report already exists for this appointment",
        )

    selected_run: AIAnalysisRun | None = None
    selected_legacy: SkinAnalysis | None = None

    if payload.ai_analysis_run_id is not None:
        selected_run = _get_owned_run(
            db,
            run_id=payload.ai_analysis_run_id,
            appointment_id=appointment_id,
            doctor_id=current_user.id,
        )
        if selected_run.legacy_skin_analysis_id:
            selected_legacy = _get_owned_legacy_analysis(
                db,
                analysis_id=selected_run.legacy_skin_analysis_id,
                appointment_id=appointment_id,
                doctor_id=current_user.id,
            )
    elif payload.skin_analysis_id is not None:
        selected_legacy = _get_owned_legacy_analysis(
            db,
            analysis_id=payload.skin_analysis_id,
            appointment_id=appointment_id,
            doctor_id=current_user.id,
        )
    else:
        selected_run = (
            db.query(AIAnalysisRun)
            .filter(AIAnalysisRun.appointment_id == appointment_id)
            .order_by(AIAnalysisRun.created_at.desc())
            .first()
        )
        if selected_run and selected_run.legacy_skin_analysis_id:
            selected_legacy = (
                db.query(SkinAnalysis)
                .filter(SkinAnalysis.id == selected_run.legacy_skin_analysis_id)
                .first()
            )
        if selected_run is None:
            selected_legacy = (
                db.query(SkinAnalysis)
                .filter(SkinAnalysis.appointment_id == appointment_id)
                .order_by(SkinAnalysis.created_at.desc())
                .first()
            )

    report = DiagnosisReport(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=current_user.id,
        skin_analysis_id=selected_legacy.id if selected_legacy else None,
        ai_analysis_run_id=selected_run.id if selected_run else None,
        doctor_final_diagnosis=payload.doctor_final_diagnosis.strip(),
        doctor_prescription=(payload.doctor_prescription or "").strip() or None,
        after_appointment_notes=(payload.after_appointment_notes or "").strip() or None,
        follow_up_plan=(payload.follow_up_plan or "").strip() or None,
        next_visit_date=payload.next_visit_date,
    )
    if not report.doctor_final_diagnosis:
        raise HTTPException(status_code=400, detail="Doctor final diagnosis is required")

    reviewed_at = datetime.now(timezone.utc)
    appointment.status = "Completed"
    appointment.cancel_reason = None

    if selected_run:
        selected_run.review_status = "REVIEWED"
        selected_run.reviewed_at = reviewed_at
        selected_run.reviewed_by_doctor_id = current_user.id
        selected_run.is_patient_visible = False

    if selected_legacy:
        selected_legacy.review_status = "Doctor Approved"
        selected_legacy.reviewed_at = reviewed_at
        selected_legacy.reviewed_by_doctor_id = current_user.id
        selected_legacy.doctor_signed_off_at = reviewed_at
        # Keep the compatibility mirror visible for legacy patient/history routes.
        selected_legacy.is_patient_visible = True

    db.add(report)
    doctor_routes.create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action="Completed",
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason="Completed with diagnosis report",
    )

    db.commit()
    db.refresh(appointment)
    db.refresh(report)
    if selected_run:
        db.refresh(selected_run)
    if selected_legacy:
        db.refresh(selected_legacy)

    linked_analysis = None
    if selected_run:
        linked_analysis = serialize_ai_run(db, selected_run)
    elif selected_legacy:
        linked_analysis = doctor_routes.serialize_analysis(selected_legacy)
        linked_analysis["kind"] = "legacy"

    return {
        "message": "Appointment completed with diagnosis report successfully",
        "appointment": _serialize_appointment_m4(appointment),
        "report": _serialize_report_m4(report),
        "linked_analysis": linked_analysis,
    }


@router.get("/appointments/{appointment_id}/diagnosis-report")
def get_diagnosis_report_by_appointment_m4(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(db, appointment_id, current_user.id)
    report = (
        db.query(DiagnosisReport)
        .filter(
            DiagnosisReport.appointment_id == appointment_id,
            DiagnosisReport.doctor_id == current_user.id,
        )
        .order_by(DiagnosisReport.created_at.desc())
        .first()
    )
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Diagnosis report not found for this appointment",
        )

    linked_analysis = None
    if report.ai_analysis_run_id:
        run = (
            db.query(AIAnalysisRun)
            .filter(AIAnalysisRun.id == report.ai_analysis_run_id)
            .first()
        )
        if run:
            linked_analysis = serialize_ai_run(db, run)
    elif report.skin_analysis_id:
        legacy = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.id == report.skin_analysis_id)
            .first()
        )
        if legacy:
            linked_analysis = doctor_routes.serialize_analysis(legacy)
            linked_analysis["kind"] = "legacy"

    serialized_report = _serialize_report_m4(report)
    return {
        "appointment_id": appointment.id,
        "appointment": _serialize_appointment_m4(appointment),
        "report": serialized_report,
        "final_diagnosis": report.doctor_final_diagnosis,
        "doctor_final_diagnosis": report.doctor_final_diagnosis,
        "doctor_prescription": report.doctor_prescription,
        "prescription": report.doctor_prescription,
        "after_appointment_notes": report.after_appointment_notes,
        "doctor_notes": report.after_appointment_notes,
        "follow_up_plan": report.follow_up_plan,
        "next_visit_date": str(report.next_visit_date) if report.next_visit_date else None,
        "linked_analysis": linked_analysis,
    }
