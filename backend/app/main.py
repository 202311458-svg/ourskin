from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.db import engine, Base, SessionLocal
from app.routes import auth, users, ai_analysis, appointments, patients, admin
from app.models import user, appointment, skin_analysis, follow_up
from app.routes.doctor import router as doctor_router

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="OurSkin API")


@app.get("/")
def root():
    return {"message": "Welcome to the OurSkin API!"}


origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ROUTERS
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ai_analysis.router)
app.include_router(appointments.router)
app.include_router(patients.router)
app.include_router(admin.router)
app.include_router(doctor_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OurSkin API"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")


app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")