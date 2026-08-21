"""Add recipient notifications and optional Google account identity.

Revision ID: 20260804_0003
Revises: 20260803_0002
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260804_0003"
down_revision: str | None = "20260803_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    user_columns = _column_names("users")
    if "google_sub" not in user_columns:
        op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))

    if "ix_users_google_sub" not in _index_names("users"):
        op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    inspector = sa.inspect(op.get_bind())
    if "notifications" not in inspector.get_table_names():
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("recipient_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=180), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("notification_type", sa.String(length=80), nullable=False),
            sa.Column("related_entity_type", sa.String(length=80), nullable=True),
            sa.Column("related_entity_id", sa.String(length=120), nullable=True),
            sa.Column("target_url", sa.String(length=500), nullable=True),
            sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = _index_names("notifications")
    indexes = [
        ("ix_notifications_id", ["id"]),
        ("ix_notifications_recipient_id", ["recipient_id"]),
        ("ix_notifications_is_read", ["is_read"]),
        ("ix_notifications_notification_type", ["notification_type"]),
        ("ix_notifications_recipient_read_created", ["recipient_id", "is_read", "created_at"]),
    ]
    for name, columns in indexes:
        if name not in existing_indexes:
            op.create_index(name, "notifications", columns, unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_read_created", table_name="notifications")
    op.drop_index("ix_notifications_notification_type", table_name="notifications")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.drop_index("ix_notifications_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "google_sub")
