import logging

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db import get_db
from app.routes import auth, auth_phase2, users, ai_analysis, ai_phase3, appointments, patients, admin, staff_schedules, booking, staff_follow_ups, announcements, notifications, doctor_phase1
from app.models import user, appointment, skin_analysis, follow_up, diagnosis_report, doctor_schedule, clinic_unavailable_date, service, doctor_service, notification
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


# Phase 2 auth routes are registered first so hardened implementations handle
# paths that still exist in the legacy auth router during the migration.
app.include_router(auth_phase2.router)
app.include_router(auth.router)
app.include_router(users.router)
# Phase 3 AI routes take precedence over legacy upload/review implementations.
app.include_router(ai_phase3.router)
app.include_router(ai_analysis.router)
app.include_router(appointments.router)
app.include_router(patients.router)
app.include_router(announcements.router)
app.include_router(admin.router)
app.include_router(staff_schedules.router)
app.include_router(staff_follow_ups.router)
app.include_router(booking.router)
# Register the phase-1 compatibility guards before the legacy doctor router so
# duplicate paths resolve to the guarded implementations.
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