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


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("verification_token_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("login_locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("auth_invalid_before", sa.DateTime(timezone=True), nullable=True),
    )

    # Existing unverified accounts may still have pre-Phase-2 plaintext
    # verification tokens. Keep those links usable only for a bounded window;
    # new tokens are stored as keyed hashes by the application model.
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
