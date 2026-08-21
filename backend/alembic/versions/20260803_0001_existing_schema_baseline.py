"""Mark the audited pre-Alembic schema as the existing-schema baseline.

Revision ID: 20260803_0001
Revises: None

This revision is intentionally empty. It must only be stamped on an existing
database after the staging schema has been compared with SQLAlchemy metadata.
It is not a fresh-database bootstrap migration.
"""

from typing import Sequence


revision: str = "20260803_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass