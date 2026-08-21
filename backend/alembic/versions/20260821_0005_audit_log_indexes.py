"""Add query indexes for the centralized audit trail.

Revision ID: 20260821_0005
Revises: 20260821_0004
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260821_0005"
down_revision: str | None = "20260821_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _index_names() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes("audit_logs")}


def upgrade() -> None:
    existing = _index_names()

    indexes = [
        ("ix_audit_logs_created_at", ["created_at"]),
        ("ix_audit_logs_actor_created", ["actor_id", "created_at"]),
        (
            "ix_audit_logs_target_created",
            ["target_type", "target_record_id", "created_at"],
        ),
    ]

    for name, columns in indexes:
        if name not in existing:
            op.create_index(name, "audit_logs", columns, unique=False)


def downgrade() -> None:
    for name in [
        "ix_audit_logs_target_created",
        "ix_audit_logs_actor_created",
        "ix_audit_logs_created_at",
    ]:
        op.drop_index(name, table_name="audit_logs")
