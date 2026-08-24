"""Add versioned AI analysis foundation and canonical dermatology taxonomy.

Revision ID: 20260824_0007
Revises: 20260821_0006
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

from app.db import Base
from app.models import (  # noqa: F401,E402
    ai_analysis_run,
    ai_image_asset,
    condition_service_mapping,
    dermatology_condition,
)


revision: str = "20260824_0007"
down_revision: str | None = "20260821_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

DIAGNOSIS_RUN_FK = "fk_diagnosis_reports_ai_analysis_run"
DIAGNOSIS_RUN_INDEX = "ix_diagnosis_reports_ai_analysis_run_id"

CONDITIONS = (
    ("ACNE_VULGARIS", "Acne vulgaris", "inflammatory", "SUPPORTED", True),
    ("ECZEMATOUS_DERMATITIS", "Eczematous dermatitis", "inflammatory", "SUPPORTED", False),
    ("PSORIASIS", "Psoriasis", "inflammatory", "SUPPORTED", True),
    ("VITILIGO", "Vitiligo", "pigmentary", "SUPPORTED", False),
    ("COMMON_WART", "Common wart", "infectious", "SUPPORTED", False),
    ("ROSACEA", "Rosacea", "inflammatory", "SUPPORTED", True),
    ("SEBORRHEIC_DERMATITIS", "Seborrheic dermatitis", "inflammatory", "SUPPORTED", False),
    ("SUPERFICIAL_FUNGAL_RASH", "Superficial fungal-appearing rash", "infectious", "SUPPORTED", False),
    ("MELASMA", "Melasma", "pigmentary", "SUPPORTED", False),
    ("POST_INFLAMMATORY_HYPERPIGMENTATION", "Post-inflammatory hyperpigmentation", "pigmentary", "SUPPORTED", False),
    ("ACNE_SCARRING", "Acne scarring", "scar", "SUPPORTED", True),
    ("KELOID_HYPERTROPHIC_SCAR", "Keloid or hypertrophic scar", "scar", "SUPPORTED", True),
    ("CONTACT_DERMATITIS_PATTERN", "Possible contact dermatitis", "inflammatory", "LIMITED", False),
    ("SUSPICIOUS_PIGMENTED_LESION", "Pigmented lesion requiring direct review", "lesion_flag", "FLAG_ONLY", False),
    ("BENIGN_APPEARING_GROWTH", "Benign-appearing skin growth", "lesion", "LIMITED", False),
    ("VASCULAR_APPEARING_LESION", "Vascular-appearing lesion", "vascular", "LIMITED", False),
    ("POSSIBLE_INFECTION", "Possible infection or abscess", "safety_flag", "FLAG_ONLY", False),
    ("STRIAE", "Striae or stretch-mark appearance", "structural", "LIMITED", False),
)

SERVICE_ALIASES = {
    "CONSULTATION": {"consultation", "consultation and assessment"},
    "CONTACT_ALLERGY_TESTING": {"contact allergy testing"},
    "FACIAL_TREATMENT": {"facial treatment", "ourskin signature facials"},
    "SURGICAL": {"surgical", "surgical procedures"},
    "CHEMICAL_PEELS": {"chemical peels"},
    "LASERS_EBDS": {
        "lasers and ebds",
        "lasers and ebd",
        "lasers and energy-based devices",
    },
    "INJECTABLES": {"injectables", "injectibles"},
}

MAPPINGS = (
    ("ACNE_VULGARIS", "CONSULTATION", "PRIMARY", 10),
    ("ACNE_VULGARIS", "FACIAL_TREATMENT", "SECONDARY", 40),
    ("ACNE_VULGARIS", "CHEMICAL_PEELS", "SECONDARY", 50),
    ("ACNE_VULGARIS", "LASERS_EBDS", "SECONDARY", 60),
    ("ACNE_VULGARIS", "INJECTABLES", "REVIEW_ONLY", 80),
    ("ACNE_SCARRING", "CONSULTATION", "PRIMARY", 10),
    ("ACNE_SCARRING", "CHEMICAL_PEELS", "SECONDARY", 40),
    ("ACNE_SCARRING", "LASERS_EBDS", "SECONDARY", 50),
    ("ACNE_SCARRING", "SURGICAL", "REVIEW_ONLY", 80),
    ("ECZEMATOUS_DERMATITIS", "CONSULTATION", "PRIMARY", 10),
    ("CONTACT_DERMATITIS_PATTERN", "CONSULTATION", "PRIMARY", 10),
    ("CONTACT_DERMATITIS_PATTERN", "CONTACT_ALLERGY_TESTING", "SECONDARY", 30),
    ("PSORIASIS", "CONSULTATION", "PRIMARY", 10),
    ("VITILIGO", "CONSULTATION", "PRIMARY", 10),
    ("COMMON_WART", "CONSULTATION", "PRIMARY", 10),
    ("COMMON_WART", "SURGICAL", "REVIEW_ONLY", 50),
    ("ROSACEA", "CONSULTATION", "PRIMARY", 10),
    ("ROSACEA", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ("SEBORRHEIC_DERMATITIS", "CONSULTATION", "PRIMARY", 10),
    ("SUPERFICIAL_FUNGAL_RASH", "CONSULTATION", "PRIMARY", 10),
    ("MELASMA", "CONSULTATION", "PRIMARY", 10),
    ("MELASMA", "CHEMICAL_PEELS", "SECONDARY", 40),
    ("MELASMA", "LASERS_EBDS", "REVIEW_ONLY", 60),
    ("POST_INFLAMMATORY_HYPERPIGMENTATION", "CONSULTATION", "PRIMARY", 10),
    ("POST_INFLAMMATORY_HYPERPIGMENTATION", "FACIAL_TREATMENT", "SECONDARY", 50),
    ("POST_INFLAMMATORY_HYPERPIGMENTATION", "CHEMICAL_PEELS", "SECONDARY", 40),
    ("POST_INFLAMMATORY_HYPERPIGMENTATION", "LASERS_EBDS", "REVIEW_ONLY", 60),
    ("KELOID_HYPERTROPHIC_SCAR", "CONSULTATION", "PRIMARY", 10),
    ("KELOID_HYPERTROPHIC_SCAR", "INJECTABLES", "REVIEW_ONLY", 40),
    ("KELOID_HYPERTROPHIC_SCAR", "SURGICAL", "REVIEW_ONLY", 60),
    ("STRIAE", "CONSULTATION", "PRIMARY", 10),
    ("STRIAE", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ("VASCULAR_APPEARING_LESION", "CONSULTATION", "PRIMARY", 10),
    ("VASCULAR_APPEARING_LESION", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ("BENIGN_APPEARING_GROWTH", "CONSULTATION", "PRIMARY", 10),
    ("BENIGN_APPEARING_GROWTH", "SURGICAL", "REVIEW_ONLY", 50),
    ("SUSPICIOUS_PIGMENTED_LESION", "CONSULTATION", "PRIMARY", 10),
    ("POSSIBLE_INFECTION", "CONSULTATION", "PRIMARY", 10),
    ("POSSIBLE_INFECTION", "SURGICAL", "REVIEW_ONLY", 70),
)


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        column["name"] == column_name
        for column in _inspector().get_columns(table_name)
    )


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        index.get("name") == index_name
        for index in _inspector().get_indexes(table_name)
    )


def _fk_name(table_name: str, constrained_column: str, referred_table: str):
    if not _has_table(table_name):
        return None
    for foreign_key in _inspector().get_foreign_keys(table_name):
        if (
            foreign_key.get("constrained_columns") == [constrained_column]
            and foreign_key.get("referred_table") == referred_table
        ):
            return foreign_key.get("name")
    return None


def _normalize_service_name(value: str | None) -> str:
    return " ".join((value or "").strip().lower().replace("&", "and").split())


def _service_key(value: str | None) -> str | None:
    normalized = _normalize_service_name(value)
    for key, aliases in SERVICE_ALIASES.items():
        if normalized in aliases:
            return key
    return None


def _seed_conditions() -> None:
    bind = op.get_bind()
    table = sa.table(
        "dermatology_conditions",
        sa.column("code", sa.String),
        sa.column("display_name", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.Text),
        sa.column("support_level", sa.String),
        sa.column("image_assessment_supported", sa.Boolean),
        sa.column("severity_assessment_supported", sa.Boolean),
        sa.column("is_active", sa.Boolean),
    )
    existing_codes = set(bind.execute(sa.select(table.c.code)).scalars().all())
    rows = [
        {
            "code": code,
            "display_name": display_name,
            "category": category,
            "description": None,
            "support_level": support_level,
            "image_assessment_supported": True,
            "severity_assessment_supported": severity_supported,
            "is_active": True,
        }
        for code, display_name, category, support_level, severity_supported in CONDITIONS
        if code not in existing_codes
    ]
    if rows:
        bind.execute(table.insert(), rows)


def _seed_service_mappings() -> None:
    if not _has_table("services"):
        return

    bind = op.get_bind()
    conditions = sa.table(
        "dermatology_conditions",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
    )
    services = sa.table(
        "services",
        sa.column("id", sa.Integer),
        sa.column("name", sa.Text),
        sa.column("is_active", sa.Boolean),
    )
    mappings = sa.table(
        "condition_service_mappings",
        sa.column("condition_id", sa.Integer),
        sa.column("service_id", sa.Integer),
        sa.column("relationship_type", sa.String),
        sa.column("priority", sa.Integer),
        sa.column("notes", sa.Text),
        sa.column("is_active", sa.Boolean),
    )

    condition_ids = dict(bind.execute(sa.select(conditions.c.code, conditions.c.id)).all())
    service_rows = bind.execute(
        sa.select(services.c.id, services.c.name).where(services.c.is_active == sa.true())
    ).all()
    service_ids = {}
    for service_id, service_name in service_rows:
        key = _service_key(service_name)
        if key and key not in service_ids:
            service_ids[key] = service_id

    existing = set(
        bind.execute(
            sa.select(
                mappings.c.condition_id,
                mappings.c.service_id,
                mappings.c.relationship_type,
            )
        ).all()
    )
    rows = []
    for condition_code, service_key, relationship_type, priority in MAPPINGS:
        condition_id = condition_ids.get(condition_code)
        service_id = service_ids.get(service_key)
        if condition_id is None or service_id is None:
            continue
        key = (condition_id, service_id, relationship_type)
        if key in existing:
            continue
        rows.append(
            {
                "condition_id": condition_id,
                "service_id": service_id,
                "relationship_type": relationship_type,
                "priority": priority,
                "notes": None,
                "is_active": True,
            }
        )
        existing.add(key)
    if rows:
        bind.execute(mappings.insert(), rows)


def upgrade() -> None:
    bind = op.get_bind()

    # The baseline creates these on a fresh database. Existing deployments reach
    # this revision with the legacy schema, so create each new table check-first.
    for table_name in (
        "dermatology_conditions",
        "ai_image_assets",
        "ai_analysis_runs",
        "condition_service_mappings",
    ):
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)

    if not _has_column("diagnosis_reports", "ai_analysis_run_id"):
        op.add_column(
            "diagnosis_reports",
            sa.Column("ai_analysis_run_id", sa.Integer(), nullable=True),
        )

    if not _has_index("diagnosis_reports", DIAGNOSIS_RUN_INDEX):
        op.create_index(
            DIAGNOSIS_RUN_INDEX,
            "diagnosis_reports",
            ["ai_analysis_run_id"],
            unique=False,
        )

    if _fk_name("diagnosis_reports", "ai_analysis_run_id", "ai_analysis_runs") is None:
        op.create_foreign_key(
            DIAGNOSIS_RUN_FK,
            "diagnosis_reports",
            "ai_analysis_runs",
            ["ai_analysis_run_id"],
            ["id"],
            ondelete="SET NULL",
        )

    _seed_conditions()
    _seed_service_mappings()


def downgrade() -> None:
    fk_name = _fk_name("diagnosis_reports", "ai_analysis_run_id", "ai_analysis_runs")
    if fk_name:
        op.drop_constraint(fk_name, "diagnosis_reports", type_="foreignkey")

    if _has_index("diagnosis_reports", DIAGNOSIS_RUN_INDEX):
        op.drop_index(DIAGNOSIS_RUN_INDEX, table_name="diagnosis_reports")

    if _has_column("diagnosis_reports", "ai_analysis_run_id"):
        op.drop_column("diagnosis_reports", "ai_analysis_run_id")

    for table_name in (
        "condition_service_mappings",
        "ai_analysis_runs",
        "ai_image_assets",
        "dermatology_conditions",
    ):
        if _has_table(table_name):
            op.drop_table(table_name)
