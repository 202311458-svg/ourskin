import logging

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db import get_db
from app.routes import (
    admin,
    ai_analysis,
    ai_phase3,
    ai_progress_phase5,
    announcements,
    appointments,
    appointments_phase9,
    auth,
    auth_phase10,
    auth_phase2,
    booking,
    doctor_ai_phase4,
    doctor_phase1,
    notifications,
    patients,
    staff_follow_ups,
    staff_schedules,
    staff_schedules_phase9,
    users,
)
from app.models import (
    appointment,
    clinic_unavailable_date,
    diagnosis_report,
    doctor_schedule,
    doctor_service,
    follow_up,
    notification,
    service,
    skin_analysis,
    user,
)
from app.routes.doctor import router as doctor_router
from app.models.appointment_log import AppointmentLog


logger = logging.getLogger(__name__)

app = FastAPI(title="OurSkin API")


@app.exception_handler(HTTPException)
async def sanitize_server_http_errors(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.error(
            "Server HTTP error on %s %s: status=%s detail=%s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
        public_detail = (
            "Service is temporarily unavailable."
            if exc.status_code == 503
            else "An internal server error occurred."
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": public_detail},
            headers=exc.headers,
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.get("/")
def root():
    return {"message": "Welcome to the OurSkin API!"}


origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if settings.frontend_url:
    origins.append(settings.frontend_url)

origins.extend(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Hardened auth routes are registered first so cookie-session implementations
# handle duplicate legacy paths. Phase 10 covers the remaining Google routes.
app.include_router(auth_phase2.router)
app.include_router(auth_phase10.router)
app.include_router(auth.router)
app.include_router(users.router)
# M5 progress routes are registered before M4 analysis routes so the shared
# appointment-analysis list can keep recovery runs out of the diagnosis workspace.
app.include_router(ai_progress_phase5.router)
# Phase 4 AI routes expose the structured clinical pipeline while retaining
# legacy route registration behind them for historical compatibility.
app.include_router(ai_phase3.router)
app.include_router(ai_analysis.router)
# Phase 9 appointment guards take precedence over the legacy appointment router
# for clinic-time-sensitive and bounded list endpoints while reusing the legacy
# transactional create/assignment paths through hardened shared helpers.
app.include_router(appointments_phase9.router)
app.include_router(appointments.router)
app.include_router(patients.router)
app.include_router(announcements.router)
app.include_router(admin.router)
# Phase 9 staff schedule guards use the same clinic clock and batch schedule
# display users while the legacy transactional create/update routes are reused.
app.include_router(staff_schedules_phase9.router)
app.include_router(staff_schedules.router)
app.include_router(staff_follow_ups.router)
app.include_router(booking.router)
# M4 doctor AI routes own the enhanced appointment payload and AI-linked report
# completion before the older compatibility guards and doctor router.
app.include_router(doctor_ai_phase4.router)
app.include_router(doctor_phase1.router)
app.include_router(doctor_router)
app.include_router(notifications.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OurSkin API"}


@app.get("/healthz")
def healthz_check():
    return {"status": "ok", "service": "OurSkin API"}


@app.get("/readyz")
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"db": "connected"}
    except Exception:
        logger.exception("Database readiness check failed")
        raise HTTPException(status_code=503, detail="Service is not ready")
