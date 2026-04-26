from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import User
from app.models.appointment import AppointmentModel
from app.models.skin_analysis import SkinAnalysis
from app.models.follow_up import FollowUp
from app.core.security import get_current_user
from app.schemas.user import DoctorProfileUpdate
from app.schemas.follow_up import FollowUpCreate, FollowUpUpdate
from app.schemas.appointment import AppointmentStatusUpdate
from app.models.diagnosis_report import DiagnosisReport
from app.models.appointment_log import AppointmentLog
from app.schemas.diagnosis_report import DiagnosisReportCreate

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
    return {
        "id": analysis.id,
        "appointment_id": analysis.appointment_id,
        "uploaded_by_id": analysis.uploaded_by_id,
        "image_path": analysis.image_path,
        "condition": analysis.condition,
        "confidence": analysis.confidence,
        "severity": analysis.severity,
        "recommendation": analysis.recommendation,
        "doctor_note": analysis.doctor_note,
        "review_status": analysis.review_status,
        "reviewed_at": analysis.reviewed_at.isoformat() if analysis.reviewed_at else None,
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
    today = date.today()

    todays_appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .order_by(AppointmentModel.time.asc())
        .all()
    )

    pending_ai = (
        db.query(SkinAnalysis)
        .join(AppointmentModel, SkinAnalysis.appointment_id == AppointmentModel.id)
        .filter(SkinAnalysis.review_status == "Pending Review")
        .order_by(SkinAnalysis.created_at.desc())
        .all()
    )

    follow_ups_due = (
        db.query(FollowUp)
        .filter(FollowUp.follow_up_date <= today)
        .filter(FollowUp.status == "Scheduled")
        .count()
    )

    completed_today = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.date == today)
        .filter(AppointmentModel.status == "Completed")
        .count()
    )

    urgent_cases = (
        db.query(SkinAnalysis)
        .filter(SkinAnalysis.severity.in_(["High", "Severe"]))
        .order_by(SkinAnalysis.created_at.desc())
        .limit(5)
        .all()
    )

    recent_records = (
        db.query(AppointmentModel)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "todays_appointments": len(todays_appointments),
            "pending_ai_reviews": len(pending_ai),
            "follow_ups_due": follow_ups_due,
            "completed_today": completed_today,
        },
        "todays_schedule": [serialize_appointment(a) for a in todays_appointments],
        "ai_queue": [serialize_analysis_with_appointment(a, db) for a in pending_ai[:5]],
        "recent_records": [serialize_appointment(a) for a in recent_records],
        "urgent_cases": [serialize_analysis_with_appointment(a, db) for a in urgent_cases],
    }


@router.get("/appointments")
def get_doctor_appointments(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = db.query(AppointmentModel)

    if status:
        query = query.filter(AppointmentModel.status == status)

    appointments = query.order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc()).all()
    return [serialize_appointment(a) for a in appointments]


@router.put("/appointments/{appointment_id}/status")
def update_doctor_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    allowed_statuses = ["Pending", "Approved", "Declined"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    if payload.status == "Declined" and not payload.cancel_reason:
        raise HTTPException(status_code=400, detail="Cancel reason is required")

    appointment.status = payload.status
    appointment.cancel_reason = payload.cancel_reason if payload.status == "Declined" else None

    db.commit()
    db.refresh(appointment)

    return {"message": "Appointment updated successfully", "appointment": serialize_appointment(appointment)}


@router.post("/appointments/{appointment_id}/complete-with-report")
def complete_appointment_with_report(
    appointment_id: int,
    payload: DiagnosisReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # recommended: only the assigned doctor should complete this appointment
   # if appointment.doctor_id and appointment.doctor_id != current_user.id:
      #  raise HTTPException(status_code=403, detail="You can only complete appointments assigned to you")


    if appointment.status != "Approved":
        raise HTTPException(status_code=400, detail="Only approved appointments can be completed with a diagnosis report")

    existing_report = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.appointment_id == appointment_id)
        .first()
    )

    if existing_report:
        raise HTTPException(status_code=400, detail="Diagnosis report already exists for this appointment")

    selected_analysis = None

    if payload.skin_analysis_id is not None:
        selected_analysis = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.id == payload.skin_analysis_id)
            .first()
        )

        if not selected_analysis:
            raise HTTPException(status_code=404, detail="Selected skin analysis not found")

        if selected_analysis.appointment_id != appointment.id:
            raise HTTPException(status_code=400, detail="Selected skin analysis does not belong to this appointment")
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
        selected_analysis.review_status = "Reviewed"
        selected_analysis.reviewed_at = datetime.utcnow()

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
    appointment = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Capstone testing note:
    # Do not block by assigned doctor for now.
    # This lets any logged-in doctor account view saved diagnosis reports.
    #
    # Restore this later when real doctor assignment is required:
    #
    # if appointment.doctor_id and appointment.doctor_id != current_user.id:
    #     raise HTTPException(
    #         status_code=403,
    #         detail="You can only view diagnosis reports for your own appointments"
    #     )

    report = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.appointment_id == appointment_id)
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

        # Keep the original nested report.
        "report": serialize_diagnosis_report(report),

        # Also return flattened fields so the frontend can read them easily.
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
        .filter(DiagnosisReport.doctor_id == current_user.id)
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    patient_map = {}

    for report in reports:
        if not report.patient_id:
            continue

        if report.patient_id not in patient_map:
            patient = db.query(User).filter(User.id == report.patient_id).first()
            appointment = db.query(AppointmentModel).filter(AppointmentModel.id == report.appointment_id).first()

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
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.patient_id == patient_id)
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    history = []

    for report in reports:
        appointment = (
            db.query(AppointmentModel)
            .filter(AppointmentModel.id == report.appointment_id)
            .first()
        )

        linked_analysis = None
        if report.skin_analysis_id:
            linked_analysis = (
                db.query(SkinAnalysis)
                .filter(SkinAnalysis.id == report.skin_analysis_id)
                .first()
            )

        report_doctor = None
        if report.doctor_id:
            report_doctor = db.query(User).filter(User.id == report.doctor_id).first()

        history.append({
            "appointment": serialize_appointment(appointment) if appointment else None,
            "report": serialize_diagnosis_report(report),
            "linked_analysis": serialize_analysis(linked_analysis) if linked_analysis else None,
            "doctor": {
                "id": report_doctor.id,
                "name": report_doctor.name,
                "email": report_doctor.email,
            } if report_doctor else None,
        })

    return {
        "patient": serialize_patient_basic(patient),
        "total_reports": len(history),
        "history": history,
    }
    
    
@router.get("/appointments/{appointment_id}/patient-history")
def get_patient_history_from_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if not appointment.patient_id:
        raise HTTPException(status_code=400, detail="This appointment has no linked patient_id")

    patient = db.query(User).filter(User.id == appointment.patient_id, User.role == "patient").first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(DiagnosisReport)
        .filter(DiagnosisReport.patient_id == appointment.patient_id)
        .order_by(DiagnosisReport.created_at.desc())
        .all()
    )

    previous_reports = []

    for report in reports:
        related_appointment = (
            db.query(AppointmentModel)
            .filter(AppointmentModel.id == report.appointment_id)
            .first()
        )

        linked_analysis = None
        if report.skin_analysis_id:
            linked_analysis = (
                db.query(SkinAnalysis)
                .filter(SkinAnalysis.id == report.skin_analysis_id)
                .first()
            )

        report_doctor = None
        if report.doctor_id:
            report_doctor = db.query(User).filter(User.id == report.doctor_id).first()

        previous_reports.append({
            "appointment": serialize_appointment(related_appointment) if related_appointment else None,
            "report": serialize_diagnosis_report(report),
            "linked_analysis": serialize_analysis(linked_analysis) if linked_analysis else None,
            "doctor": {
                "id": report_doctor.id,
                "name": report_doctor.name,
                "email": report_doctor.email,
            } if report_doctor else None,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    query = db.query(SkinAnalysis)

    if review_status:
        query = query.filter(SkinAnalysis.review_status == review_status)

    cases = query.order_by(SkinAnalysis.created_at.desc()).all()
    return [serialize_analysis(item) for item in cases]


@router.get("/patient-records")
def get_doctor_patient_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointments = (
        db.query(AppointmentModel)
        .order_by(AppointmentModel.date.desc(), AppointmentModel.time.desc())
        .all()
    )

    results = []

    for appt in appointments:
        analyses = (
            db.query(SkinAnalysis)
            .filter(SkinAnalysis.appointment_id == appt.id)
            .order_by(SkinAnalysis.created_at.desc())
            .all()
        )

        results.append({
            "appointment": serialize_appointment(appt),
            "analyses": [serialize_analysis(a) for a in analyses],
        })

    return results


@router.get("/follow-ups")
def get_doctor_follow_ups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    items = (
        db.query(FollowUp)
        .order_by(FollowUp.follow_up_date.asc())
        .all()
    )

    doctor_ids = list({item.doctor_id for item in items if item.doctor_id})
    doctors = db.query(User).filter(User.id.in_(doctor_ids)).all()
    doctor_map = {doctor.id: doctor.name for doctor in doctors}

    return [
        serialize_follow_up(item, doctor_map.get(item.doctor_id))
        for item in items
    ]


@router.post("/follow-ups")
def create_follow_up(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    appointment = db.query(AppointmentModel).filter(AppointmentModel.id == payload.appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    follow_up = FollowUp(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id if appointment.doctor_id else current_user.id,
        follow_up_date=payload.follow_up_date,
        reason=payload.reason,
        notes=payload.notes,
        status="Scheduled",
    )

    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)

    doctor_name = None
    if follow_up.doctor_id:
        doctor = db.query(User).filter(User.id == follow_up.doctor_id).first()
        doctor_name = doctor.name if doctor else None

    return {
        "message": "Follow-up created successfully",
        "follow_up": serialize_follow_up(follow_up, doctor_name),
    }


@router.put("/follow-ups/{follow_up_id}")
def update_follow_up(
    follow_up_id: int,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    follow_up = db.query(FollowUp).filter(FollowUp.id == follow_up_id).first()

    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(follow_up, key, value)

    db.commit()
    db.refresh(follow_up)

    doctor_name = None
    if follow_up.doctor_id:
        doctor = db.query(User).filter(User.id == follow_up.doctor_id).first()
        doctor_name = doctor.name if doctor else None

    return {
        "message": "Follow-up updated successfully",
        "follow_up": serialize_follow_up(follow_up, doctor_name),
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