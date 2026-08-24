import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.dermatology_condition import DermatologyCondition
from app.models.diagnosis_report import DiagnosisReport


EVALUATION_BASIS = "DERIVED_TEXT_MATCH_V1"


@dataclass(frozen=True)
class AgreementOutcome:
    status: str
    matched_differential_code: str | None = None
    matched_differential_display: str | None = None


def normalize_clinical_label(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _meaningful_match(left: str | None, right: str | None) -> bool:
    a = normalize_clinical_label(left)
    b = normalize_clinical_label(right)
    if not a or not b:
        return False
    if a == b:
        return True
    if min(len(a), len(b)) < 5:
        return False
    return a in b or b in a


def derive_diagnosis_agreement(
    *,
    ai_status: str | None,
    primary_code: str | None,
    primary_display: str | None,
    differentials: list[dict] | None,
    doctor_final_diagnosis: str | None,
) -> AgreementOutcome:
    doctor_label = normalize_clinical_label(doctor_final_diagnosis)
    if not doctor_label or ai_status != "COMPLETED" or not primary_display:
        return AgreementOutcome("NOT_ASSESSABLE")

    if _meaningful_match(primary_display, doctor_final_diagnosis) or _meaningful_match(
        (primary_code or "").replace("_", " "),
        doctor_final_diagnosis,
    ):
        return AgreementOutcome("AGREE")

    for item in differentials or []:
        display = str(item.get("display_name") or "")
        code = str(item.get("condition_code") or "")
        if _meaningful_match(display, doctor_final_diagnosis) or _meaningful_match(
            code.replace("_", " "),
            doctor_final_diagnosis,
        ):
            return AgreementOutcome(
                "PARTIAL",
                matched_differential_code=code or None,
                matched_differential_display=display or None,
            )

    return AgreementOutcome("DISAGREE")


def derive_medication_matches(
    *,
    medication_suggestions: list[dict] | None,
    doctor_prescription: str | None,
) -> tuple[bool, bool | None, list[str]]:
    suggestions = medication_suggestions or []
    if not suggestions:
        return False, None, []

    prescription = normalize_clinical_label(doctor_prescription)
    matches: list[str] = []
    if prescription:
        for item in suggestions:
            name = str(item.get("name_or_class") or "").strip()
            normalized = normalize_clinical_label(name)
            if normalized and normalized in prescription:
                matches.append(name)

    return True, bool(matches), list(dict.fromkeys(matches))


def create_evaluation_snapshot(
    db: Session,
    *,
    run: AIAnalysisRun,
    report: DiagnosisReport,
    doctor_id: int | None,
) -> AIClinicalEvaluation | None:
    if run.analysis_mode != "DERMATOLOGY_ASSESSMENT":
        return None

    condition = None
    if run.primary_condition_id:
        condition = (
            db.query(DermatologyCondition)
            .filter(DermatologyCondition.id == run.primary_condition_id)
            .first()
        )

    primary_code = condition.code if condition else None
    primary_display = condition.display_name if condition else None
    agreement = derive_diagnosis_agreement(
        ai_status=run.status,
        primary_code=primary_code,
        primary_display=primary_display,
        differentials=run.differentials or [],
        doctor_final_diagnosis=report.doctor_final_diagnosis,
    )
    meds_present, med_used, med_matches = derive_medication_matches(
        medication_suggestions=run.medication_suggestions or [],
        doctor_prescription=report.doctor_prescription,
    )

    evaluation = AIClinicalEvaluation(
        ai_analysis_run_id=run.id,
        appointment_id=run.appointment_id,
        diagnosis_report_id=report.id,
        doctor_id=doctor_id,
        evaluation_basis=EVALUATION_BASIS,
        diagnosis_agreement=agreement.status,
        ai_status=run.status,
        ai_evidence_strength=run.evidence_strength,
        ai_primary_condition_code=primary_code,
        ai_primary_condition_display=primary_display,
        doctor_final_diagnosis=report.doctor_final_diagnosis,
        matched_differential_code=agreement.matched_differential_code,
        matched_differential_display=agreement.matched_differential_display,
        medication_suggestions_present=meds_present,
        medication_suggestion_used=med_used,
        medication_matches=med_matches,
    )
    db.add(evaluation)
    return evaluation
