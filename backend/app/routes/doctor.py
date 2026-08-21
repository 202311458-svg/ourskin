from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.authorization import (
    doctor_appointments_query,
    get_doctor_appointment_or_404,
)
from app.core.clock import clinic_today
from app.core.security import get_current_user
from app.core.storage import create_signed_image_url
from app.db import SessionLocal
from app.models.appointment import AppointmentModel
from app.models.appointment_log import AppointmentLog
from app.models.diagnosis_report import DiagnosisReport
from app.models.follow_up import FollowUp
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.schemas.appointment import AppointmentStatusUpdate
from app.schemas.diagnosis_report import DiagnosisReportCreate
from app.schemas.follow_up import FollowUpCreate, FollowUpUpdate
from app.schemas.user import DoctorProfileUpdate

router = APIRouter(prefix="/doctor", tags=["Doctor Portal"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_doctor(current_user: User = Depends(get_current_user)):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return current_user


def require_doctor_staff_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["doctor", "staff", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Doctor, staff, or admin access only"
        )
    return current_user


def serialize_appointment(appt: AppointmentModel):
    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "doctor_id": appt.doctor_id,
        "patient_name": appt.patient_name,
        "patient_email": appt.patient_email,
        "doctor_name": appt.doctor_name,
        "date": str(appt.date),
        "time": str(appt.time),
        "services": appt.services,
        "status": appt.status,
        "cancel_reason": appt.cancel_reason,
    }


def serialize_analysis(analysis: SkinAnalysis):
    if not analysis:
        return None

    return {
        "id": analysis.id,
        "appointment_id": analysis.appointment_id,
        "uploaded_by_id": analysis.uploaded_by_id,
        "image_path": analysis.image_path,
        "image_url": create_signed_image_url(analysis.image_path),
        "condition": analysis.condition,
        "confidence": analysis.confidence,
        "severity": analysis.severity,
        "recommendation": analysis.recommendation,
        "doctor_note": analysis.doctor_note,
        "review_status": analysis.review_status,
        "reviewed_at": analysis.reviewed_at.isoformat() if analysis.reviewed_at else None,
        "reviewed_by_doctor_id": getattr(analysis, "reviewed_by_doctor_id", None),
        "doctor_signed_off_at": (
            analysis.doctor_signed_off_at.isoformat()
            if getattr(analysis, "doctor_signed_off_at", None)
            else None
        ),
        "is_patient_visible": getattr(analysis, "is_patient_visible", False),
        "possible_conditions": analysis.possible_conditions,
        "key_findings": analysis.key_findings,
        "treatment_suggestions": analysis.treatment_suggestions,
        "prescription_suggestions": analysis.prescription_suggestions,
        "follow_up_suggestions": analysis.follow_up_suggestions,
        "red_flags": analysis.red_flags,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


def serialize_analysis_with_appointment(analysis: SkinAnalysis, db: Session):
    data = serialize_analysis(analysis)

    appointment = None
    if analysis.appointment_id:
        appointment = (
            db.query(AppointmentModel)
            .filter(AppointmentModel.id == analysis.appointment_id)
            .first()
        )

    data["patient_name"] = appointment.patient_name if appointment else None
    data["patient_id"] = appointment.patient_id if appointment else None
    data["patient_email"] = appointment.patient_email if appointment else None
    data["appointment_date"] = str(appointment.date) if appointment else None
    data["appointment_time"] = str(appointment.time) if appointment else None
    data["appointment_service"] = appointment.services if appointment else None
    data["appointment_status"] = appointment.status if appointment else None

    return data


def serialize_follow_up(item: FollowUp, doctor_name: str | None = None):
    return {
        "id": item.id,
        "appointment_id": item.appointment_id,
        "patient_id": item.patient_id,
        "doctor_id": item.doctor_id,
        "doctor_name": doctor_name,
        "follow_up_date": str(item.follow_up_date),
        "reason": item.reason,
        "notes": item.notes,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _users_by_id(db: Session, user_ids: set[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    return {
        user.id: user
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    }


def _appointments_by_id(
    db: Session,
    appointment_ids: set[int],
    doctor_id: int | None = None,
) -> dict[int, AppointmentModel]:
    if not appointment_ids:
        return {}

    query = db.query(AppointmentModel).filter(AppointmentModel.id.in_(appointment_ids))
    if doctor_id is not None:
        query = query.filter(AppointmentModel.doctor_id == doctor_id)

    return {appointment.id: appointment for appointment in query.all()}


def _analyses_by_appointment(
    db: Session,
    appointment_ids: set[int],
) -> tuple[dict[int, list[SkinAnalysis]], dict[int, SkinAnalysis]]:
    grouped: dict[int, list[SkinAnalysis]] = defaultdict(list)
    by_id: dict[int, SkinAnalysis] = {}
    if not appointment_ids:
        return {}, {}

    rows = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.appointment_id.in_(appointment_ids))
        .order_by(SkinAnalysis.appointment_id.asc(), SkinAnalysis.created_at.desc())
        .all()
    )
    for analysis in rows:
        grouped[analysis.appointment_id].append(analysis)
        by_id[analysis.id] = analysis

    return dict(grouped), by_id


def _latest_reports_by_appointment(
    reports: list[DiagnosisReport],
) -> dict[int, DiagnosisReport]:
    latest: dict[int, DiagnosisReport] = {}
    for report in reports:
        latest.setdefault(report.appointment_id, report)
    return latest


def serialize_follow_ups_with_context(
    items: list[FollowUp],
    db: Session,
) -> list[dict]:
    appointment_ids = {item.appointment_id for item in items if item.appointment_id}
    user_ids = {
        user_id
        for item in items
        for user_id in (item.patient_id, item.doctor_id)
        if user_id
    }
    appointments = _appointments_by_id(db, appointment_ids)
    users = _users_by_id(db, user_ids)

    results = []
    for item in items:
        appointment = appointments.get(item.appointment_id)
        patient = users.get(item.patient_id)
        doctor = users.get(item.doctor_id)
        data = serialize_follow_up(item, doctor.name if doctor else None)
        data.update(
            {
                "patient_name": patient.name if patient else appointment.patient_name if appointment else None,
                "patient_email": patient.email if patient else appointment.patient_email if appointment else None,
                "appointment_services": appointment.services if appointment else None,
                "appointment_date": str(appointment.date) if appointment and appointment.date else None,
                "appointment_time": str(appointment.time) if appointment and appointment.time else None,
            }
        )
        results.append(data)

    return results


def serialize_follow_up_with_context(item: FollowUp, db: Session):
    return serialize_follow_ups_with_context([item], db)[0]


def create_appointment_log(
    db: Session,
    appointment_id: int,
    action: str,
    performed_by_id: int | None,
    performed_by_name: str,
    performed_by_role: str,
    reason: str | None = None,
):
    log = AppointmentLog(
        appointment_id=appointment_id,
        action=action,
        performed_by_id=performed_by_id,
        performed_by_name=performed_by_name,
        performed_by_role=performed_by_role,
        reason=reason,
    )
    db.add(log)
    return log


def serialize_diagnosis_report(report: DiagnosisReport):
    return {
        "id": report.id,
        "appointment_id": report.appointment_id,
        "patient_id": report.patient_id,
        "doctor_id": report.doctor_id,
        "skin_analysis_id": report.skin_analysis_id,
        "doctor_final_diagnosis": report.doctor_final_diagnosis,
        "doctor_prescription": report.doctor_prescription,
        "after_appointment_notes": report.after_appointment_notes,
        "follow_up_plan": report.follow_up_plan,
        "next_visit_date": str(report.next_visit_date) if report.next_visit_date else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


def serialize_patient_basic(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "contact": user.contact,
    }


@router.get("/dashboard")
def doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    today = clinic_today()

    todays_appointments = (
        doctor_appointments_query(db, current_user.id)
        .filter(AppointmentModel.date == today)
        .order_by(AppointmentModel.time.asc())
        .all()
    )

    pending_ai_query = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(
            AppointmentModel.doctor_id == current_user.id,
            SkinAnalysis.review_status == "Pending Review",
        )
    )
    pending_ai_reviews = pending_ai_query.count()
    pending_ai = (
        pending_ai_query
        .order_by(SkinAnalysis.created_at.desc())
        .limit(5)
        .all()
    )

    follow_up_base_query = (
        db.query(FollowUp)
        .filter(FollowUp.doctor_id == current_user.id)
        .filter(FollowUp.status == "Scheduled")
    )

    follow_ups_due = (
        follow_up_base_query
        .filter(FollowUp.follow_up_date <= today)
        .count()
    )

    follow_ups_due_items = (
        follow_up_base_query
        .filter(FollowUp.follow_up_date <= today)
        .order_by(FollowUp.follow_up_date.asc())
        .limit(5)
        .all()
    )

    upcoming_follow_ups = (
        follow_up_base_query
        .filter(FollowUp.follow_up_date >= today)
        .order_by(FollowUp.follow_up_date.asc())
        .limit(5)
        .all()
    )

    scheduled_follow_ups = follow_up_base_query.count()

    completed_today = (
        doctor_appointments_query(db, current_user.id)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Completed")
        .count()
    )

    urgent_cases = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(
            AppointmentModel.doctor_id == current_user.id,
            SkinAnalysis.severity.in_(["High", "Severe"]),
        )
        .order_by(SkinAnalysis.created_at.desc())
        .limit(5)
        .all()
    )

    recent_records = (
        doctor_appointments_query(db, current_user.id)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "todays_appointments": len(todays_appointments),
            "pending_ai_reviews": pending_ai_reviews,
            "follow_ups_due": follow_ups_due,
            "follow_ups_scheduled": scheduled_follow_ups,
            "completed_today": completed_today,
        },
        "todays_schedule": [serialize_appointment(a) for a in todays_appointments],
        "ai_queue": [serialize_analysis_with_appointment(a, db) for a in pending_ai],
        "recent_records": [serialize_appointment(a) for a in recent_records],
        "urgent_cases": [serialize_analysis_with_appointment(a, db) for a in urgent_cases],
        "follow_ups_due_items": serialize_follow_ups_with_context(follow_ups_due_items, db),
        "upcoming_follow_ups": serialize_follow_ups_with_context(upcoming_follow_ups, db),
    }


@router.get("/appointments")
def get_doctor_appointments(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = doctor_appointments_query(db, current_user.id)

    if status and status != "All":
        query = query.filter(AppointmentModel.status == status)

    appointments = (
        query
        .order_by(
            AppointmentModel.date.asc(),
            AppointmentModel.time.asc()
        )
        .all()
    )

    return [serialize_appointment(appointment) for appointment in appointments]


@router.put("/appointments/{appointment_id}/status")
def update_doctor_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(
        db, appointment_id, current_user.id
    )

    allowed_statuses = ["Pending", "Approved", "Declined"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    if payload.status == "Declined" and not payload.cancel_reason:
        raise HTTPException(status_code=400, detail="Cancel reason is required")

    appointment.status = payload.status
    appointment.cancel_reason = payload.cancel_reason if payload.status == "Declined" else None

    db.commit()
    db.refresh(appointment)

    return {
        "message": "Appointment updated successfully",
        "appointment": serialize_appointment(appointment),
    }


@router.post("/appointments/{appointment_id}/complete-with-report")
def complete_appointment_with_report(
    appointment_id: int,
    payload: DiagnosisReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(
        db, appointment_id, current_user.id
    )

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

    selected_analysis = None

    if payload.skin_analysis_id is not None:
        selected_analysis = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.id == payload.skin_analysis_id)
            .first()
        )

        if not selected_analysis:
            raise HTTPException(
                status_code=404,
                detail="Selected skin analysis not found",
            )

        if selected_analysis.appointment_id != appointment.id:
            raise HTTPException(
                status_code=400,
                detail="Selected skin analysis does not belong to this appointment",
            )
    else:
        selected_analysis = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.appointment_id == appointment.id)
            .order_by(SkinAnalysis.created_at.desc())
            .first()
        )

    report = DiagnosisReport(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=current_user.id,
        skin_analysis_id=selected_analysis.id if selected_analysis else None,
        doctor_final_diagnosis=payload.doctor_final_diagnosis,
        doctor_prescription=payload.doctor_prescription,
        after_appointment_notes=payload.after_appointment_notes,
        follow_up_plan=payload.follow_up_plan,
        next_visit_date=payload.next_visit_date,
    )

    db.add(report)

    appointment.status = "Completed"
    appointment.cancel_reason = None

    if selected_analysis:
        reviewed_at = datetime.now(timezone.utc)
        selected_analysis.review_status = "Doctor Approved"
        selected_analysis.reviewed_at = reviewed_at
        selected_analysis.reviewed_by_doctor_id = current_user.id
        selected_analysis.doctor_signed_off_at = reviewed_at
        selected_analysis.is_patient_visible = True

    create_appointment_log(
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

    if selected_analysis:
        db.refresh(selected_analysis)

    return {
        "message": "Appointment completed with diagnosis report successfully",
        "appointment": serialize_appointment(appointment),
        "report": serialize_diagnosis_report(report),
        "linked_analysis": serialize_analysis(selected_analysis) if selected_analysis else None,
    }


@router.get("/appointments/{appointment_id}/diagnosis-report")
def get_diagnosis_report_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(
        db, appointment_id, current_user.id
    )

    report = (
        db.query(DiagnosisReport)
        .filter(
            DiagnosisReport.appointment_id == appointment_id,
            DiagnosisReport.doctor_id == current_user.id,
        )
        .order_by(DiagnosisReport.created_at.desc())
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Diagnosis report not found for this appointment"
        )

    linked_analysis = None

    if report.skin_analysis_id:
        linked_analysis = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.id == report.skin_analysis_id)
            .first()
        )

    return {
        "appointment_id": appointment.id,
        "appointment": serialize_appointment(appointment),
        "report": serialize_diagnosis_report(report),
        "final_diagnosis": report.doctor_final_diagnosis,
        "doctor_final_diagnosis": report.doctor_final_diagnosis,
        "doctor_prescription": report.doctor_prescription,
        "prescription": report.doctor_prescription,
        "after_appointment_notes": report.after_appointment_notes,
        "doctor_notes": report.after_appointment_notes,
        "follow_up_plan": report.follow_up_plan,
        "next_visit_date": str(report.next_visit_date) if report.next_visit_date else None,
        "linked_analysis": serialize_analysis(linked_analysis) if linked_analysis else None,
    }


@router.get("/patients")
def get_doctor_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    reports = (
        db.query(DiagnosisReport)
        .join(
            AppointmentModel,
            DiagnosisReport.appointment_id == AppointmentModel.id,
        )
        .filter(
            DiagnosisReport.doctor_id == current_user.id,
            AppointmentModel.doctor_id == current_user.id,
        )
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    patient_ids = {report.patient_id for report in reports if report.patient_id}
    appointment_ids = {report.appointment_id for report in reports if report.appointment_id}
    patients = _users_by_id(db, patient_ids)
    appointments = _appointments_by_id(db, appointment_ids, current_user.id)

    patient_map = {}
    for report in reports:
        if not report.patient_id:
            continue

        if report.patient_id not in patient_map:
            patient = patients.get(report.patient_id)
            appointment = appointments.get(report.appointment_id)
            patient_map[report.patient_id] = {
                "patient": serialize_patient_basic(patient) if patient else {
                    "id": report.patient_id,
                    "name": None,
                    "email": None,
                    "contact": None,
                },
                "latest_report": serialize_diagnosis_report(report),
                "latest_appointment": serialize_appointment(appointment) if appointment else None,
                "total_reports": 1,
            }
        else:
            patient_map[report.patient_id]["total_reports"] += 1

    return list(patient_map.values())


@router.get("/patients/{patient_id}/history")
def get_patient_history_for_doctor(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    care_relationship = (
        doctor_appointments_query(db, current_user.id)
        .filter(AppointmentModel.patient_id == patient_id)
        .first()
    )

    if not care_relationship:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = (
        db.query(User)
        .filter(User.id == patient_id, User.role == "patient")
        .first()
    )

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(DiagnosisReport)
        .join(
            AppointmentModel,
            DiagnosisReport.appointment_id == AppointmentModel.id,
        )
        .filter(
            DiagnosisReport.patient_id == patient_id,
            DiagnosisReport.doctor_id == current_user.id,
            AppointmentModel.doctor_id == current_user.id,
        )
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    appointments = (
        doctor_appointments_query(db, current_user.id)
        .filter(AppointmentModel.patient_id == patient_id)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .all()
    )

    appointment_ids = {appointment.id for appointment in appointments}
    analyses_by_appointment, analyses_by_id = _analyses_by_appointment(db, appointment_ids)
    latest_reports = _latest_reports_by_appointment(reports)

    history = []
    for appointment in appointments:
        report = latest_reports.get(appointment.id)
        linked_analysis = analyses_by_id.get(report.skin_analysis_id) if report and report.skin_analysis_id else None
        history.append(
            {
                "appointment": serialize_appointment(appointment),
                "report": serialize_diagnosis_report(report) if report else None,
                "linked_analysis": serialize_analysis(linked_analysis) if linked_analysis else None,
                "analyses": [
                    serialize_analysis(analysis)
                    for analysis in analyses_by_appointment.get(appointment.id, [])
                ],
                "doctor": {
                    "id": current_user.id,
                    "name": current_user.name,
                    "email": current_user.email,
                } if report else None,
            }
        )

    return {
        "patient": serialize_patient_basic(patient),
        "total_reports": len(reports),
        "total_appointments": len(appointments),
        "history": history,
    }


@router.get("/appointments/{appointment_id}/patient-history")
def get_patient_history_from_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(
        db, appointment_id, current_user.id
    )

    if not appointment.patient_id:
        raise HTTPException(
            status_code=400,
            detail="This appointment has no linked patient_id"
        )

    patient = (
        db.query(User)
        .filter(User.id == appointment.patient_id, User.role == "patient")
        .first()
    )

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(DiagnosisReport)
        .join(
            AppointmentModel,
            DiagnosisReport.appointment_id == AppointmentModel.id,
        )
        .filter(
            DiagnosisReport.patient_id == appointment.patient_id,
            DiagnosisReport.doctor_id == current_user.id,
            AppointmentModel.doctor_id == current_user.id,
        )
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    report_appointment_ids = {report.appointment_id for report in reports if report.appointment_id}
    related_appointments = _appointments_by_id(db, report_appointment_ids, current_user.id)
    linked_analysis_ids = {report.skin_analysis_id for report in reports if report.skin_analysis_id}
    linked_analyses = {
        analysis.id: analysis
        for analysis in (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.id.in_(linked_analysis_ids))
            .all()
            if linked_analysis_ids
            else []
        )
    }

    previous_reports = []
    for report in reports:
        related_appointment = related_appointments.get(report.appointment_id)
        linked_analysis = linked_analyses.get(report.skin_analysis_id)
        previous_reports.append({
            "appointment": serialize_appointment(related_appointment) if related_appointment else None,
            "report": serialize_diagnosis_report(report),
            "linked_analysis": serialize_analysis(linked_analysis) if linked_analysis else None,
            "doctor": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
            },
        })

    return {
        "current_appointment": serialize_appointment(appointment),
        "patient": serialize_patient_basic(patient),
        "previous_reports_count": len(previous_reports),
        "previous_reports": previous_reports,
    }


@router.get("/ai-cases")
def get_doctor_ai_cases(
    review_status: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(AppointmentModel.doctor_id == current_user.id)
    )

    if review_status:
        query = query.filter(SkinAnalysis.review_status == review_status)

    cases = (
        query
        .order_by(SkinAnalysis.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [serialize_analysis(item) for item in cases]


@router.get("/patient-records")
def get_doctor_patient_records(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointments = (
        doctor_appointments_query(db, current_user.id)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    appointment_ids = {appointment.id for appointment in appointments}
    analyses_by_appointment, _ = _analyses_by_appointment(db, appointment_ids)
    reports = (
        db.query(DiagnosisReport)
        .filter(
            DiagnosisReport.doctor_id == current_user.id,
            DiagnosisReport.appointment_id.in_(appointment_ids),
        )
        .order_by(DiagnosisReport.appointment_id.asc(), DiagnosisReport.created_at.desc())
        .all()
        if appointment_ids
        else []
    )
    latest_reports = _latest_reports_by_appointment(reports)

    return [
        {
            "appointment": serialize_appointment(appointment),
            "analyses": [
                serialize_analysis(analysis)
                for analysis in analyses_by_appointment.get(appointment.id, [])
            ],
            "diagnosis_report": (
                serialize_diagnosis_report(latest_reports[appointment.id])
                if appointment.id in latest_reports
                else None
            ),
        }
        for appointment in appointments
    ]


@router.get("/follow-ups")
def get_doctor_follow_ups(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_staff_admin),
):
    query = db.query(FollowUp)

    if current_user.role == "doctor":
        query = query.filter(FollowUp.doctor_id == current_user.id)

    items = (
        query
        .order_by(FollowUp.follow_up_date.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return serialize_follow_ups_with_context(items, db)


@router.post("/follow-ups")
def create_follow_up(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = get_doctor_appointment_or_404(
        db, payload.appointment_id, current_user.id
    )

    if payload.follow_up_date < clinic_today():
        raise HTTPException(
            status_code=400,
            detail="Follow-up date cannot be in the past"
        )

    follow_up = FollowUp(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=current_user.id,
        follow_up_date=payload.follow_up_date,
        reason=payload.reason,
        notes=payload.notes,
        status="Scheduled",
    )

    db.add(follow_up)

    create_appointment_log(
        db=db,
        appointment_id=appointment.id,
        action="Follow-up Scheduled",
        performed_by_id=current_user.id,
        performed_by_name=current_user.name,
        performed_by_role=current_user.role,
        reason=payload.reason,
    )

    db.commit()
    db.refresh(follow_up)

    return {
        "message": "Follow-up created successfully",
        "follow_up": serialize_follow_up_with_context(follow_up, db),
    }


@router.put("/follow-ups/{follow_up_id}")
def update_follow_up(
    follow_up_id: int,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_staff_admin),
):
    query = db.query(FollowUp).filter(FollowUp.id == follow_up_id)
    if current_user.role == "doctor":
        query = query.filter(FollowUp.doctor_id == current_user.id)
    follow_up = query.first()

    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    data = payload.model_dump(exclude_unset=True)

    if current_user.role in ["staff", "admin"]:
        allowed_staff_fields = {"status"}
        data = {
            key: value
            for key, value in data.items()
            if key in allowed_staff_fields
        }

        if not data:
            raise HTTPException(
                status_code=400,
                detail="Staff and admin can only update follow-up status"
            )

    requested_status = data.get("status")

    if (
        requested_status
        and requested_status.strip().lower() == "completed"
        and follow_up.follow_up_date > clinic_today()
    ):
        raise HTTPException(
            status_code=400,
            detail="Future follow-ups cannot be marked completed yet."
        )

    for key, value in data.items():
        setattr(follow_up, key, value)

    db.commit()
    db.refresh(follow_up)

    return {
        "message": "Follow-up updated successfully",
        "follow_up": serialize_follow_up_with_context(follow_up, db),
    }


@router.get("/settings")
def get_doctor_settings(current_user: User = Depends(require_doctor)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "contact": current_user.contact,
        "profile_image": current_user.profile_image,
        "specialty": current_user.specialty,
        "availability": current_user.availability,
        "bio": current_user.bio,
    }


@router.put("/settings")
def update_doctor_settings(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Doctor settings updated successfully",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "contact": current_user.contact,
            "profile_image": current_user.profile_image,
            "specialty": current_user.specialty,
            "availability": current_user.availability,
            "bio": current_user.bio,
        },
    }
