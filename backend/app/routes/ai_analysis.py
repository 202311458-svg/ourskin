from fastapi import APIRouter, UploadFile, File
import shutil
import uuid
from app.ai.predictor import analyze_skin

router = APIRouter(
    prefix="/ai",
    tags=["AI Analysis"]
)

@router.post("/analyze")
async def analyze_skin_image(file: UploadFile = File(...)):

    filename = f"app/uploads/{uuid.uuid4()}.jpg"

    with open(filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_skin(filename)

    return {
        "status": "success",
        "analysis": result
    }