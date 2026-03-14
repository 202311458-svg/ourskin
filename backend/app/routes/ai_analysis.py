from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
import shutil
import uuid

from app.db import get_db
from app.models.skin_analysis import SkinAnalysis
from app.core.security import get_current_user
from app.ai.predictor import analyze_skin

router = APIRouter(
    prefix="/ai",
    tags=["AI Analysis"]
)


@router.post("/analyze")
async def analyze_skin_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    file_id = str(uuid.uuid4())

    file_path = f"app/uploads/{file_id}.jpg"      # where file is saved
    public_path = f"/uploads/{file_id}.jpg"       # what browser uses

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_skin(file_path)

    record = SkinAnalysis(
        user_id=user.id,
        image_path=public_path,   # store public URL
        condition=result["condition"],
        confidence=result["confidence"],
        severity=result["severity"],
        recommendation=result["recommendation"]
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "analysis": result
    }
    
@router.get("/history")
def get_analysis_history(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    records = db.query(SkinAnalysis)\
        .filter(SkinAnalysis.user_id == user.id)\
        .order_by(SkinAnalysis.created_at.desc())\
        .all()

    return records