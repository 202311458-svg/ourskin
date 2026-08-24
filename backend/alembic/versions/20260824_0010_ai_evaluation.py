"""Add doctor-linked AI evaluation snapshots.

Revision ID: 20260824_0010
Revises: 20260824_0009
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260824_0010"
down_revision: str | None = "20260824_0009"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("ai_clinical_evaluations"):
        return

    op.create_table(
        "ai_clinical_evaluations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ai_analysis_run_id", sa.Integer(), nullable=False),
        sa.Column("appointment_id", sa.Integer(), nullable=False),
        sa.Column("diagnosis_report_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column(
            "evaluation_basis",
            sa.String(length=80),
            nullable=False,
            server_default="DERIVED_TEXT_MATCH_V1",
        ),
        sa.Column("diagnosis_agreement", sa.String(length=24), nullable=False),
        sa.Column("ai_status", sa.String(length=40), nullable=False),
        sa.Column("ai_evidence_strength", sa.String(length=16), nullable=True),
        sa.Column("ai_primary_condition_code", sa.String(length=64), nullable=True),
        sa.Column("ai_primary_condition_display", sa.String(length=160), nullable=True),
        sa.Column("doctor_final_diagnosis", sa.Text(), nullable=False),
        sa.Column("matched_differential_code", sa.String(length=64), nullable=True),
        sa.Column("matched_differential_display", sa.String(length=160), nullable=True),
        sa.Column(
            "medication_suggestions_present",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("medication_suggestion_used", sa.Boolean(), nullable=True),
        sa.Column(
            "medication_matches",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "diagnosis_agreement IN ('AGREE', 'PARTIAL', 'DISAGREE', 'NOT_ASSESSABLE')",
            name="ck_ai_clinical_evaluations_agreement",
        ),
        sa.ForeignKeyConstraint(
            ["ai_analysis_run_id"],
            ["ai_analysis_runs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["diagnosis_report_id"],
            ["diagnosis_reports.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["doctor_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ai_analysis_run_id"),
        sa.UniqueConstraint("diagnosis_report_id"),
    )
    op.create_index(
        "ix_ai_clinical_evaluations_ai_analysis_run_id",
        "ai_clinical_evaluations",
        ["ai_analysis_run_id"],
        unique=True,
    )
    op.create_index(
        "ix_ai_clinical_evaluations_appointment_id",
        "ai_clinical_evaluations",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_clinical_evaluations_diagnosis_report_id",
        "ai_clinical_evaluations",
        ["diagnosis_report_id"],
        unique=True,
    )
    op.create_index(
        "ix_ai_clinical_evaluations_doctor_id",
        "ai_clinical_evaluations",
        ["doctor_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_clinical_evaluations_diagnosis_agreement",
        "ai_clinical_evaluations",
        ["diagnosis_agreement"],
        unique=False,
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("ai_clinical_evaluations"):
        return

    for index_name in [
        "ix_ai_clinical_evaluations_diagnosis_agreement",
        "ix_ai_clinical_evaluations_doctor_id",
        "ix_ai_clinical_evaluations_diagnosis_report_id",
        "ix_ai_clinical_evaluations_appointment_id",
        "ix_ai_clinical_evaluations_ai_analysis_run_id",
    ]:
        indexes = {
            item.get("name")
            for item in sa.inspect(op.get_bind()).get_indexes("ai_clinical_evaluations")
        }
        if index_name in indexes:
            op.drop_index(index_name, table_name="ai_clinical_evaluations")

    op.drop_table("ai_clinical_evaluations")
