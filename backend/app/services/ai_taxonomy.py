from __future__ import annotations

from dataclasses import dataclass


AI_TAXONOMY_VERSION = "ourskin-derm-v1"
AI_PIPELINE_VERSION = "ourskin-ai-m1"


@dataclass(frozen=True)
class ConditionDefinition:
    code: str
    display_name: str
    category: str
    support_level: str
    severity_assessment_supported: bool = False
    description: str | None = None


@dataclass(frozen=True)
class ServiceMappingDefinition:
    condition_code: str
    service_key: str
    relationship_type: str
    priority: int
    notes: str | None = None


CONDITION_DEFINITIONS = (
    ConditionDefinition("ACNE_VULGARIS", "Acne vulgaris", "inflammatory", "SUPPORTED", True),
    ConditionDefinition("ECZEMATOUS_DERMATITIS", "Eczematous dermatitis", "inflammatory", "SUPPORTED"),
    ConditionDefinition("PSORIASIS", "Psoriasis", "inflammatory", "SUPPORTED", True),
    ConditionDefinition("VITILIGO", "Vitiligo", "pigmentary", "SUPPORTED"),
    ConditionDefinition("COMMON_WART", "Common wart", "infectious", "SUPPORTED"),
    ConditionDefinition("ROSACEA", "Rosacea", "inflammatory", "SUPPORTED", True),
    ConditionDefinition("SEBORRHEIC_DERMATITIS", "Seborrheic dermatitis", "inflammatory", "SUPPORTED"),
    ConditionDefinition("SUPERFICIAL_FUNGAL_RASH", "Superficial fungal-appearing rash", "infectious", "SUPPORTED"),
    ConditionDefinition("MELASMA", "Melasma", "pigmentary", "SUPPORTED"),
    ConditionDefinition("POST_INFLAMMATORY_HYPERPIGMENTATION", "Post-inflammatory hyperpigmentation", "pigmentary", "SUPPORTED"),
    ConditionDefinition("ACNE_SCARRING", "Acne scarring", "scar", "SUPPORTED", True),
    ConditionDefinition("KELOID_HYPERTROPHIC_SCAR", "Keloid or hypertrophic scar", "scar", "SUPPORTED", True),
    ConditionDefinition("CONTACT_DERMATITIS_PATTERN", "Possible contact dermatitis", "inflammatory", "LIMITED"),
    ConditionDefinition("SUSPICIOUS_PIGMENTED_LESION", "Pigmented lesion requiring direct review", "lesion_flag", "FLAG_ONLY"),
    ConditionDefinition("BENIGN_APPEARING_GROWTH", "Benign-appearing skin growth", "lesion", "LIMITED"),
    ConditionDefinition("VASCULAR_APPEARING_LESION", "Vascular-appearing lesion", "vascular", "LIMITED"),
    ConditionDefinition("POSSIBLE_INFECTION", "Possible infection or abscess", "safety_flag", "FLAG_ONLY"),
    ConditionDefinition("STRIAE", "Striae or stretch-mark appearance", "structural", "LIMITED"),
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
    "COSMETIC_SURGERY": {"cosmetic surgery"},
}


SERVICE_MAPPING_DEFINITIONS = (
    ServiceMappingDefinition("ACNE_VULGARIS", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("ACNE_VULGARIS", "FACIAL_TREATMENT", "SECONDARY", 40),
    ServiceMappingDefinition("ACNE_VULGARIS", "CHEMICAL_PEELS", "SECONDARY", 50),
    ServiceMappingDefinition("ACNE_VULGARIS", "LASERS_EBDS", "SECONDARY", 60),
    ServiceMappingDefinition("ACNE_VULGARIS", "INJECTABLES", "REVIEW_ONLY", 80),
    ServiceMappingDefinition("ACNE_SCARRING", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("ACNE_SCARRING", "CHEMICAL_PEELS", "SECONDARY", 40),
    ServiceMappingDefinition("ACNE_SCARRING", "LASERS_EBDS", "SECONDARY", 50),
    ServiceMappingDefinition("ACNE_SCARRING", "SURGICAL", "REVIEW_ONLY", 80),
    ServiceMappingDefinition("ECZEMATOUS_DERMATITIS", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("CONTACT_DERMATITIS_PATTERN", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("CONTACT_DERMATITIS_PATTERN", "CONTACT_ALLERGY_TESTING", "SECONDARY", 30),
    ServiceMappingDefinition("PSORIASIS", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("VITILIGO", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("COMMON_WART", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("COMMON_WART", "SURGICAL", "REVIEW_ONLY", 50),
    ServiceMappingDefinition("ROSACEA", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("ROSACEA", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ServiceMappingDefinition("SEBORRHEIC_DERMATITIS", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("SUPERFICIAL_FUNGAL_RASH", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("MELASMA", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("MELASMA", "CHEMICAL_PEELS", "SECONDARY", 40),
    ServiceMappingDefinition("MELASMA", "LASERS_EBDS", "REVIEW_ONLY", 60),
    ServiceMappingDefinition("POST_INFLAMMATORY_HYPERPIGMENTATION", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("POST_INFLAMMATORY_HYPERPIGMENTATION", "FACIAL_TREATMENT", "SECONDARY", 50),
    ServiceMappingDefinition("POST_INFLAMMATORY_HYPERPIGMENTATION", "CHEMICAL_PEELS", "SECONDARY", 40),
    ServiceMappingDefinition("POST_INFLAMMATORY_HYPERPIGMENTATION", "LASERS_EBDS", "REVIEW_ONLY", 60),
    ServiceMappingDefinition("KELOID_HYPERTROPHIC_SCAR", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("KELOID_HYPERTROPHIC_SCAR", "INJECTABLES", "REVIEW_ONLY", 40),
    ServiceMappingDefinition("KELOID_HYPERTROPHIC_SCAR", "SURGICAL", "REVIEW_ONLY", 60),
    ServiceMappingDefinition("STRIAE", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("STRIAE", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ServiceMappingDefinition("VASCULAR_APPEARING_LESION", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("VASCULAR_APPEARING_LESION", "LASERS_EBDS", "REVIEW_ONLY", 50),
    ServiceMappingDefinition("BENIGN_APPEARING_GROWTH", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("BENIGN_APPEARING_GROWTH", "SURGICAL", "REVIEW_ONLY", 50),
    ServiceMappingDefinition("SUSPICIOUS_PIGMENTED_LESION", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("POSSIBLE_INFECTION", "CONSULTATION", "PRIMARY", 10),
    ServiceMappingDefinition("POSSIBLE_INFECTION", "SURGICAL", "REVIEW_ONLY", 70),
)


def normalize_service_name(value: str | None) -> str:
    return " ".join((value or "").strip().lower().replace("&", "and").split())


def service_key_for_name(value: str | None) -> str | None:
    normalized = normalize_service_name(value)
    for key, aliases in SERVICE_ALIASES.items():
        if normalized in aliases:
            return key
    return None


def get_condition_definition(code: str) -> ConditionDefinition | None:
    normalized = (code or "").strip().upper()
    return next((item for item in CONDITION_DEFINITIONS if item.code == normalized), None)


def sync_ai_taxonomy(db) -> None:
    """Idempotently sync canonical conditions and mappings to active clinic services.

    This is intentionally not called at import time. Migrations seed the initial
    snapshot, while future AI services can call this after service-catalog changes.
    """

    from app.models.condition_service_mapping import ConditionServiceMapping
    from app.models.dermatology_condition import DermatologyCondition
    from app.models.service import Service

    existing_conditions = {
        item.code: item for item in db.query(DermatologyCondition).all()
    }
    for definition in CONDITION_DEFINITIONS:
        condition = existing_conditions.get(definition.code)
        if condition is None:
            condition = DermatologyCondition(
                code=definition.code,
                display_name=definition.display_name,
                category=definition.category,
                description=definition.description,
                support_level=definition.support_level,
                image_assessment_supported=True,
                severity_assessment_supported=definition.severity_assessment_supported,
                is_active=True,
            )
            db.add(condition)
            db.flush()
            existing_conditions[definition.code] = condition

    active_services = db.query(Service).filter(Service.is_active == True).all()
    services_by_key = {}
    for service in active_services:
        service_key = service_key_for_name(service.name)
        if service_key and service_key not in services_by_key:
            services_by_key[service_key] = service

    existing_links = {
        (item.condition_id, item.service_id, item.relationship_type)
        for item in db.query(ConditionServiceMapping).all()
    }
    for mapping in SERVICE_MAPPING_DEFINITIONS:
        condition = existing_conditions.get(mapping.condition_code)
        service = services_by_key.get(mapping.service_key)
        if condition is None or service is None:
            continue
        key = (condition.id, service.id, mapping.relationship_type)
        if key in existing_links:
            continue
        db.add(
            ConditionServiceMapping(
                condition_id=condition.id,
                service_id=service.id,
                relationship_type=mapping.relationship_type,
                priority=mapping.priority,
                notes=mapping.notes,
                is_active=True,
            )
        )
        existing_links.add(key)
