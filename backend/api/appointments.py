from fastapi import APIRouter

router = APIRouter()

appointments = [
    {
        "id": 1,
        "patient_name": "Maria Santos",
        "date": "2026-03-10",
        "status": "pending"
    },
    {
        "id": 2,
        "patient_name": "Juan Dela Cruz",
        "date": "2026-03-11",
        "status": "approved"
    }
]

@router.get("/appointments")
def get_appointments():
    return appointments