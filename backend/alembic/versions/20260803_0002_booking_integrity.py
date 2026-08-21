"""Enforce active request uniqueness and doctor schedule non-overlap.

Revision ID: 20260803_0002
Revises: 20260803_0001
"""

from typing import Sequence

from alembic import op


revision: str = "20260803_0002"
down_revision: str | None = "20260803_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Fail before adding constraints if historical records violate the intended
    # invariants. Operations must resolve these records through an approved
    # clinical-data correction process rather than deleting them in migration.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM appointments
            WHERE status IN ('Pending', 'Approved')
              AND patient_id IS NOT NULL
              AND service_id IS NOT NULL
            GROUP BY patient_id, service_id
            HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION
              'Cannot enforce appointment uniqueness: duplicate active patient/service requests exist';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM appointments
            WHERE date IS NOT NULL
              AND time IS NOT NULL
              AND end_time IS NOT NULL
              AND end_time <= time
          ) THEN
            RAISE EXCEPTION
              'Cannot enforce appointment time validity: non-positive appointment intervals exist';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM appointments a
            JOIN appointments b
              ON a.id < b.id
             AND a.doctor_id = b.doctor_id
             AND a.date = b.date
             AND a.time < b.end_time
             AND a.end_time > b.time
            WHERE a.doctor_id IS NOT NULL
              AND a.date IS NOT NULL
              AND a.time IS NOT NULL
              AND a.end_time IS NOT NULL
              AND b.time IS NOT NULL
              AND b.end_time IS NOT NULL
              AND (
                a.status = 'Approved'
                OR (a.status = 'Pending' AND a.is_initial_evaluation_request)
              )
              AND (
                b.status = 'Approved'
                OR (b.status = 'Pending' AND b.is_initial_evaluation_request)
              )
          ) THEN
            RAISE EXCEPTION
              'Cannot enforce doctor schedule exclusion: overlapping active appointments exist';
          END IF;
        END $$;
        """
    )

    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        """
        ALTER TABLE appointments
        ADD CONSTRAINT ck_appointments_positive_interval
        CHECK (
          time IS NULL
          OR end_time IS NULL
          OR end_time > time
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_appointments_active_patient_service
        ON appointments (patient_id, service_id)
        WHERE status IN ('Pending', 'Approved')
          AND patient_id IS NOT NULL
          AND service_id IS NOT NULL
        """
    )
    op.execute(
        """
        ALTER TABLE appointments
        ADD CONSTRAINT ex_appointments_doctor_active_overlap
        EXCLUDE USING gist (
          doctor_id WITH =,
          tsrange(date + time, date + end_time, '[)') WITH &&
        )
        WHERE (
          doctor_id IS NOT NULL
          AND date IS NOT NULL
          AND time IS NOT NULL
          AND end_time IS NOT NULL
          AND (
            status = 'Approved'
            OR (status = 'Pending' AND is_initial_evaluation_request)
          )
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS "
        "ex_appointments_doctor_active_overlap"
    )
    op.execute("DROP INDEX IF EXISTS uq_appointments_active_patient_service")
    op.execute(
        "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS "
        "ck_appointments_positive_interval"
    )
    # btree_gist may be shared by other schemas; do not remove the extension.