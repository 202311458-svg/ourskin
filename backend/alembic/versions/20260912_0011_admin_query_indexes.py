"""Add indexes for Admin operational queries.

Revision ID: 20260912_0011
Revises: 20260824_0010
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260912_0011"
down_revision: str | None = "20260824_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


INDEXES = {
    "appointments": [
        ("ix_appointments_status_id", ["status", "id"]),
        ("ix_appointments_date_status", ["date", "status"]),
    ],
    "doctor_schedules": [
        ("ix_doctor_schedules_date_available", ["schedule_date", "is_available"]),
        ("ix_doctor_schedules_doctor_date", ["doctor_id", "schedule_date"]),
    ],
    "announcements": [
        ("ix_announcements_status_created", ["status", "created_at"]),
        (
            "ix_announcements_visibility_window",
            ["status", "starts_at", "expires_at"],
        ),
    ],
    "users": [
        ("ix_users_role_status_created", ["role", "status", "created_at"]),
    ],
}


def _existing_indexes(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return set()
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table_name, indexes in INDEXES.items():
        if not inspector.has_table(table_name):
            continue
        existing = _existing_indexes(table_name)
        for name, columns in indexes:
            if name not in existing:
                op.create_index(name, table_name, columns, unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table_name, indexes in reversed(list(INDEXES.items())):
        if not inspector.has_table(table_name):
            continue
        existing = _existing_indexes(table_name)
        for name, _columns in reversed(indexes):
            if name in existing:
                op.drop_index(name, table_name=table_name)
