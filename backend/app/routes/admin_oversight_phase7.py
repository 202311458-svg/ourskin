from fastapi import APIRouter

from app.routes import (
    admin_ai_oversight_phase7,
    admin_ai_summary_phase7,
    admin_audit_phase7,
    admin_reports_phase7,
)

router = APIRouter()
router.include_router(admin_ai_summary_phase7.router)
router.include_router(admin_ai_oversight_phase7.router)
router.include_router(admin_audit_phase7.router)
router.include_router(admin_reports_phase7.router)
