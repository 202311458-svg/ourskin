from fastapi import APIRouter

from app.routes import (
    admin_integrity_phase9,
    admin_performance_phase9,
    announcement_integrity_phase9,
)

router = APIRouter()
router.include_router(announcement_integrity_phase9.router)
router.include_router(admin_integrity_phase9.router)
router.include_router(admin_performance_phase9.router)
