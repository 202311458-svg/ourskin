from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.skin_analysis import SkinAnalysis
from app.models.user import User
from app.routes.admin import require_admin
from app.routes.admin_ai_oversight_phase7 import _ai_evaluation_summary

router = APIRouter(prefix="/admin", tags=["Admin AI Oversight"])


@router.get("/ai-evaluation/summary")
def get_ai_evaluation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    summary = _ai_evaluation_summary(db)
    mirrored_legacy_ids = (
        db.query(AIAnalysisRun.legacy_skin_analysis_id)
        .filter(AIAnalysisRun.legacy_skin_analysis_id.isnot(None))
        .distinct()
        .count()
    )
    summary["legacy_records_retained"] = max(
        0,
        db.query(SkinAnalysis).count() - mirrored_legacy_ids,
    )
    return summary
