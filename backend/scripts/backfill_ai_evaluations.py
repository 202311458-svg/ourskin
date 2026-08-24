"""Backfill deterministic M6 evaluation snapshots for existing linked reports."""

from app.db import SessionLocal
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_clinical_evaluation import AIClinicalEvaluation
from app.models.diagnosis_report import DiagnosisReport
from app.services.ai.clinical_evaluation import create_evaluation_snapshot


def main() -> None:
    db = SessionLocal()
    created = 0
    try:
        reports = (
            db.query(DiagnosisReport)
            .filter(DiagnosisReport.ai_analysis_run_id.isnot(None))
            .all()
        )
        existing_run_ids = {
            item.ai_analysis_run_id for item in db.query(AIClinicalEvaluation).all()
        }

        for report in reports:
            if not report.ai_analysis_run_id or report.ai_analysis_run_id in existing_run_ids:
                continue
            run = (
                db.query(AIAnalysisRun)
                .filter(AIAnalysisRun.id == report.ai_analysis_run_id)
                .first()
            )
            if run is None or run.analysis_mode != "DERMATOLOGY_ASSESSMENT":
                continue
            item = create_evaluation_snapshot(
                db,
                run=run,
                report=report,
                doctor_id=report.doctor_id,
            )
            if item is not None:
                created += 1

        db.commit()
        print(f"created {created} ai evaluation snapshot(s)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
