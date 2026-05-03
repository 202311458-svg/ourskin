from sqlalchemy import Column, Integer, String, DateTime, Boolean, Date, Text
from sqlalchemy.sql import func
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Keep this because existing pages still use user.name.
    name = Column(String, nullable=False)

    # New structured name fields for registration.
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    contact = Column(String, nullable=True)

    role = Column(String, default="patient", nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)

    # Patient age support.
    date_of_birth = Column(Date, nullable=True)
    is_minor = Column(Boolean, default=False, nullable=False)
    address = Column(Text, nullable=True)

    # Guardian details for minor patients.
    guardian_first_name = Column(String, nullable=True)
    guardian_last_name = Column(String, nullable=True)
    guardian_relationship = Column(String, nullable=True)
    guardian_contact = Column(String, nullable=True)
    guardian_email = Column(String, nullable=True)
    guardian_consent = Column(Boolean, default=False, nullable=False)
    guardian_consent_at = Column(DateTime(timezone=True), nullable=True)

    terms_accepted = Column(Boolean, default=False, nullable=False)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)

    privacy_accepted = Column(Boolean, default=False, nullable=False)
    privacy_accepted_at = Column(DateTime(timezone=True), nullable=True)

    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_requested_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    status = Column(String, default="Active", nullable=False)
    department = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)

    specialty = Column(String, nullable=True)
    availability = Column(String, nullable=True)
    bio = Column(String, nullable=True)