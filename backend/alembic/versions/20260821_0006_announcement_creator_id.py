"""Align announcement creator IDs with integer user primary keys.

Revision ID: 20260821_0006
Revises: 20260821_0005
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "20260821_0006"
down_revision: str | None = "20260821_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

CREATOR_FK_NAME = "fk_announcements_created_by_users"


def _column_type(table_name: str, column_name: str):
    inspector = sa.inspect(op.get_bind())
    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return column["type"]
    return None


def _creator_fk_name() -> str | None:
    inspector = sa.inspect(op.get_bind())
    for foreign_key in inspector.get_foreign_keys("announcements"):
        if (
            foreign_key.get("constrained_columns") == ["created_by"]
            and foreign_key.get("referred_table") == "users"
            and foreign_key.get("referred_columns") == ["id"]
        ):
            return foreign_key.get("name")
    return None


def upgrade() -> None:
    current_type = _column_type("announcements", "created_by")

    if current_type is not None and not isinstance(current_type, sa.Integer):
        # Historical rows could not contain a valid User.id because the column
        # was UUID while users.id is integer. Clear unusable values before the
        # type conversion rather than inventing an actor mapping.
        op.execute(sa.text("UPDATE announcements SET created_by = NULL WHERE created_by IS NOT NULL"))
        op.alter_column(
            "announcements",
            "created_by",
            existing_type=current_type,
            type_=sa.Integer(),
            postgresql_using="NULL::integer",
            existing_nullable=True,
        )

    if _creator_fk_name() is None:
        op.create_foreign_key(
            CREATOR_FK_NAME,
            "announcements",
            "users",
            ["created_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # Only remove the FK if this revision created the named constraint. A fresh
    # Phase-4 bootstrap may already have an equivalent metadata-created FK.
    if _creator_fk_name() == CREATOR_FK_NAME:
        op.drop_constraint(
            CREATOR_FK_NAME,
            "announcements",
            type_="foreignkey",
        )

    current_type = _column_type("announcements", "created_by")
    if isinstance(current_type, sa.Integer):
        op.alter_column(
            "announcements",
            "created_by",
            existing_type=sa.Integer(),
            type_=UUID(as_uuid=True),
            postgresql_using="NULL::uuid",
            existing_nullable=True,
        )
