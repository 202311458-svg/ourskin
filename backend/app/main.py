from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import test_db

app = FastAPI(title="OurSkin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OurSkin API"}

@app.get("/db-check")
def db_check():
    value = test_db()
    return {"db": "connected", "result": value}