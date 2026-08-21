import logging

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db import get_db
from app.routes import auth, users, ai_analysis, appointments, patients, admin, staff_schedules, booking, staff_follow_ups, announcements, notifications
from app.models import user, appointment, skin_analysis, follow_up, diagnosis_report, doctor_schedule, clinic_unavailable_date, service, doctor_service, notification
from app.routes.doctor import router as doctor_router
from app.models.appointment_log import AppointmentLog


logger = logging.getLogger(__name__)

app = FastAPI(title="OurSkin API")


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


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ai_analysis.router)
app.include_router(appointments.router)
app.include_router(patients.router)
app.include_router(announcements.router)
app.include_router(admin.router)
app.include_router(staff_schedules.router)
app.include_router(staff_follow_ups.router)
app.include_router(booking.router)
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