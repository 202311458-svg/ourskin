"""Add longitudinal AI recovery and progress fields.

Revision ID: 20260824_0009
Revises: 20260824_0008
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260824_0009"
down_revision: str | None = "20260824_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _has_check(table_name: str, constraint_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return any(item.get("name") == constraint_name for item in inspector.get_check_constraints(table_name))


def upgrade() -> None:
    if not _has_column("ai_image_assets", "capture_view"):
        op.add_column("ai_image_assets", sa.Column("capture_view", sa.String(length=24), nullable=True))
        op.create_index("ix_ai_image_assets_capture_view", "ai_image_assets", ["capture_view"], unique=False)

    if not _has_check("ai_image_assets", "ck_ai_image_assets_capture_view"):
        op.create_check_constraint(
            "ck_ai_image_assets_capture_view",
            "ai_image_assets",
            "capture_view IS NULL OR capture_view IN ('FRONT', 'LEFT', 'RIGHT', 'CLOSE_UP', 'OTHER', 'UNSPECIFIED')",
        )

    additions = {
        "progress_trend": sa.Column("progress_trend", sa.String(length=32), nullable=True),
        "progress_summary": sa.Column("progress_summary", sa.Text(), nullable=True),
        "comparison_reliable": sa.Column("comparison_reliable", sa.Boolean(), nullable=True),
        "comparison_findings": sa.Column("comparison_findings", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    }
    for name, column in additions.items():
        if not _has_column("ai_analysis_runs", name):
            op.add_column("ai_analysis_runs", column)

    if not _has_check("ai_analysis_runs", "ck_ai_analysis_runs_progress_trend"):
        op.create_check_constraint(
            "ck_ai_analysis_runs_progress_trend",
            "ai_analysis_runs",
            "progress_trend IS NULL OR progress_trend IN ('IMPROVING', 'STABLE', 'POSSIBLE_WORSENING', 'MIXED', 'UNABLE_TO_COMPARE')",
        )

    inspector = sa.inspect(op.get_bind())
    indexes = {item.get("name") for item in inspector.get_indexes("ai_analysis_runs")}
    if "ix_ai_analysis_runs_progress_trend" not in indexes:
        op.create_index("ix_ai_analysis_runs_progress_trend", "ai_analysis_runs", ["progress_trend"], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {item.get("name") for item in inspector.get_indexes("ai_analysis_runs")}
    if "ix_ai_analysis_runs_progress_trend" in indexes:
        op.drop_index("ix_ai_analysis_runs_progress_trend", table_name="ai_analysis_runs")

    if _has_check("ai_analysis_runs", "ck_ai_analysis_runs_progress_trend"):
        op.drop_constraint("ck_ai_analysis_runs_progress_trend", "ai_analysis_runs", type_="check")

    for name in ["comparison_findings", "comparison_reliable", "progress_summary", "progress_trend"]:
        if _has_column("ai_analysis_runs", name):
            op.drop_column("ai_analysis_runs", name)

    inspector = sa.inspect(op.get_bind())
    image_indexes = {item.get("name") for item in inspector.get_indexes("ai_image_assets")}
    if "ix_ai_image_assets_capture_view" in image_indexes:
        op.drop_index("ix_ai_image_assets_capture_view", table_name="ai_image_assets")
    if _has_check("ai_image_assets", "ck_ai_image_assets_capture_view"):
        op.drop_constraint("ck_ai_image_assets_capture_view", "ai_image_assets", type_="check")
    if _has_column("ai_image_assets", "capture_view"):
        op.drop_column("ai_image_assets", "capture_view")
