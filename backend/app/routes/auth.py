from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, ChangePasswordRequest
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check for existing user
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user.name,
        email=user.email,
        contact=user.contact,
        password_hash=hash_password(user.password),
        role="patient"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully", "user_id": new_user.id}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == form_data.username).first()

    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": db_user.email})

    return {
        "access_token": token,
        "token_type": "bearer"
    }
    
@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    user = db.query(User).filter(User.id == current_user.id).first()

    # Step 1: verify current password
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    # Step 2: prevent same password reuse
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the old password"
        )

    # Step 3: update password
    user.password_hash = hash_password(data.new_password)

    db.commit()
    db.refresh(user)

    return {"message": "Password updated successfully"}
