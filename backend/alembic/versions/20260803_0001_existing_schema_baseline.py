"""Create the audited application schema baseline.

Revision ID: 20260803_0001
Revises: None

This revision is safe for both an empty database and an existing OurSkin
schema. SQLAlchemy ``create_all(checkfirst=True)`` creates only missing tables;
it does not rewrite or drop existing production tables. Later migrations remain
responsible for database-specific integrity constraints and data transitions.
"""

from typing import Sequence

from alembic import op

from app.db import Base

# Import every model module so Base.metadata contains the complete application
# schema when Alembic is run without importing the FastAPI application first.
from app.models import (  # noqa: F401,E402
    ai_analysis_run,
    ai_image_asset,
    announcement,
    appointment,
    appointment_log,
    audit_log,
    clinic_unavailable_date,
    condition_service_mapping,
    dermatology_condition,
    diagnosis_report,
    doctor_schedule,
    doctor_service,
    follow_up,
    notification,
    service,
    skin_analysis,
    user,
)


revision: str = "20260803_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # The baseline may have been applied to a pre-existing production schema.
    # Never drop the entire application schema from a baseline downgrade.
    pass
