"""Add audit fields for AI medication decision support.

Revision ID: 20260824_0008
Revises: 20260824_0007
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260824_0008"
down_revision: str | None = "20260824_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return any(
        column["name"] == column_name
        for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    if not _has_column("ai_analysis_runs", "medication_knowledge_version"):
        op.add_column(
            "ai_analysis_runs",
            sa.Column("medication_knowledge_version", sa.String(length=80), nullable=True),
        )
    if not _has_column("ai_analysis_runs", "medication_guidance"):
        op.add_column(
            "ai_analysis_runs",
            sa.Column("medication_guidance", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("ai_analysis_runs", "medication_guidance"):
        op.drop_column("ai_analysis_runs", "medication_guidance")
    if _has_column("ai_analysis_runs", "medication_knowledge_version"):
        op.drop_column("ai_analysis_runs", "medication_knowledge_version")
