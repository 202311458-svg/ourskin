"""Add authentication hardening state to users.

Revision ID: 20260821_0004
Revises: 20260804_0003
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260821_0004"
down_revision: str | None = "20260804_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _column_names() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("users")}


def upgrade() -> None:
    columns = _column_names()
    additions = [
        ("verification_token_expires", sa.Column("verification_token_expires", sa.DateTime(timezone=True), nullable=True)),
        ("failed_login_attempts", sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False)),
        ("login_locked_until", sa.Column("login_locked_until", sa.DateTime(timezone=True), nullable=True)),
        ("auth_invalid_before", sa.Column("auth_invalid_before", sa.DateTime(timezone=True), nullable=True)),
    ]

    for name, column in additions:
        if name not in columns:
            op.add_column("users", column)

    op.execute(
        sa.text(
            """
            UPDATE users
            SET verification_token_expires = CURRENT_TIMESTAMP + INTERVAL '24 hours'
            WHERE verification_token IS NOT NULL
              AND verification_token_expires IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("users", "auth_invalid_before")
    op.drop_column("users", "login_locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "verification_token_expires")
