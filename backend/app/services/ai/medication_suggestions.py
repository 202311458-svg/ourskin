"""Conservative physician-facing medication decision support.

The catalog intentionally contains medication classes/options without dose,
frequency, duration, or automatic prescription behavior. It is a capstone
clinical-decision-support layer and should be reviewed by the clinic's physicians
before production use.
"""

from dataclasses import dataclass

from app.schemas.ai_analysis import (
    AIAnalysisStatus,
    DermatologyClinicalContext,
    EvidenceStrength,
    MedicationClinicalContext,
    MedicationSuggestion,
    PregnancyStatus,
)
from app.services.ai.contracts import TaxonomyCondition


MEDICATION_KNOWLEDGE_VERSION = "ourskin-medication-support-v1"


@dataclass(frozen=True)
class MedicationRule:
    name_or_class: str
    role: str
    considerations: tuple[str, ...]
    requires_site_and_age: bool = False
    pregnancy_sensitive: bool = False


@dataclass(frozen=True)
class MedicationSuggestionOutcome:
    suggestions: list[MedicationSuggestion]
    guidance: str


class MedicationSuggestionService:
    CATALOG: dict[str, tuple[MedicationRule, ...]] = {
        "ACNE_VULGARIS": (
            MedicationRule(
                "Benzoyl peroxide",
                "Topical antimicrobial and anti-inflammatory option for acne.",
                ("Verify irritation/tolerability and concurrent topical products.",),
            ),
            MedicationRule(
                "Topical retinoid",
                "Comedolytic and anti-inflammatory option that may be considered across acne severities.",
                (
                    "Avoid in pregnancy; verify reproductive status before selection.",
                    "Introduce based on physician assessment of irritation risk.",
                ),
                pregnancy_sensitive=True,
            ),
            MedicationRule(
                "Azelaic acid",
                "Topical option for inflammatory/comedonal acne and post-inflammatory pigmentation.",
                ("Review skin sensitivity and concurrent topical products.",),
            ),
        ),
        "ECZEMATOUS_DERMATITIS": (
            MedicationRule(
                "Topical corticosteroid",
                "Anti-inflammatory option for an eczematous flare; potency and duration depend on body site, age, and examination.",
                (
                    "Choose potency by body site and patient factors.",
                    "Avoid unsupervised prolonged use.",
                ),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical calcineurin inhibitor",
                "Steroid-sparing anti-inflammatory option for selected sites and patients.",
                ("Verify age, body site, and diagnosis before selection.",),
                requires_site_and_age=True,
            ),
        ),
        "PSORIASIS": (
            MedicationRule(
                "Topical corticosteroid",
                "Common anti-inflammatory option for localized psoriasis.",
                ("Potency and duration depend on site and extent.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Vitamin D analogue",
                "Topical option often considered for plaque psoriasis.",
                ("Review site, extent, and combination regimen.",),
                requires_site_and_age=True,
            ),
        ),
        "VITILIGO": (
            MedicationRule(
                "Topical corticosteroid",
                "May be considered for localized vitiligo in selected sites.",
                ("Body site and duration require physician assessment.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical calcineurin inhibitor",
                "Steroid-sparing option often considered for selected sensitive sites.",
                ("Verify site, age, and treatment goals.",),
                requires_site_and_age=True,
            ),
        ),
        "COMMON_WART": (
            MedicationRule(
                "Salicylic acid",
                "Keratolytic topical option for selected common warts.",
                (
                    "Confirm lesion type and location before use.",
                    "Avoid inappropriate use on sensitive sites.",
                ),
                requires_site_and_age=True,
            ),
        ),
        "ROSACEA": (
            MedicationRule(
                "Azelaic acid",
                "Topical anti-inflammatory option for papulopustular rosacea.",
                ("Confirm phenotype and skin sensitivity.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical metronidazole",
                "Topical anti-inflammatory option for papulopustular rosacea.",
                ("Confirm phenotype and review concurrent products.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical ivermectin",
                "Topical option for inflammatory papulopustular rosacea.",
                ("Confirm phenotype and contraindications before selection.",),
                requires_site_and_age=True,
            ),
        ),
        "SEBORRHEIC_DERMATITIS": (
            MedicationRule(
                "Topical ketoconazole",
                "Antifungal option commonly considered for seborrheic dermatitis.",
                ("Choose formulation for the involved site.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Low-potency topical corticosteroid",
                "Short-course anti-inflammatory option for selected flares.",
                (
                    "Use only after site-specific physician assessment.",
                    "Avoid prolonged unsupervised use.",
                ),
                requires_site_and_age=True,
            ),
        ),
        "SUPERFICIAL_FUNGAL_RASH": (
            MedicationRule(
                "Topical azole antifungal",
                "Antifungal option when a superficial fungal process is clinically supported.",
                (
                    "Confirm fungal diagnosis when uncertain.",
                    "Avoid masking an uncertain eruption with steroid-containing combinations.",
                ),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical allylamine antifungal",
                "Antifungal option for selected superficial dermatophyte infections.",
                ("Confirm site and likely organism pattern clinically.",),
                requires_site_and_age=True,
            ),
        ),
        "MELASMA": (
            MedicationRule(
                "Azelaic acid",
                "Topical pigment-modulating option that may be considered as part of a melasma plan.",
                ("Photoprotection and pigment pattern should be reviewed clinically.",),
                requires_site_and_age=True,
            ),
        ),
        "POST_INFLAMMATORY_HYPERPIGMENTATION": (
            MedicationRule(
                "Azelaic acid",
                "Topical option that may help post-inflammatory pigmentation while addressing some inflammatory triggers.",
                ("Treat the underlying inflammatory cause and review irritation risk.",),
                requires_site_and_age=True,
            ),
            MedicationRule(
                "Topical retinoid",
                "Pigment-normalizing option in selected patients.",
                (
                    "Avoid in pregnancy; verify reproductive status before selection.",
                    "Review irritation risk and the underlying condition.",
                ),
                requires_site_and_age=True,
                pregnancy_sensitive=True,
            ),
        ),
    }

    def suggest(
        self,
        *,
        analysis_status: AIAnalysisStatus,
        evidence_strength: EvidenceStrength | None,
        condition: TaxonomyCondition | None,
        dermatology_context: DermatologyClinicalContext,
        medication_context: MedicationClinicalContext,
        red_flags: list[str],
    ) -> MedicationSuggestionOutcome:
        if analysis_status != AIAnalysisStatus.COMPLETED:
            return MedicationSuggestionOutcome(
                [],
                "Medication options were withheld because the AI assessment is not a completed supported-condition result.",
            )

        if condition is None or condition.support_level != "SUPPORTED":
            return MedicationSuggestionOutcome(
                [],
                "Medication options were withheld because this finding is not in the fully supported medication-suggestion scope.",
            )

        if evidence_strength not in {
            EvidenceStrength.HIGH,
            EvidenceStrength.MODERATE,
        }:
            return MedicationSuggestionOutcome(
                [],
                "Medication options were withheld because evidence strength is too low for medication decision support.",
            )

        if red_flags:
            return MedicationSuggestionOutcome(
                [],
                "Medication options were withheld because visible warning features require direct physician review first.",
            )

        rules = self.CATALOG.get(condition.code, ())
        if not rules:
            return MedicationSuggestionOutcome(
                [],
                "No image-driven medication options are defined for this condition; management should be selected by the physician.",
            )

        suggestions = []
        for rule in rules:
            if (
                rule.pregnancy_sensitive
                and medication_context.pregnancy_status
                in {PregnancyStatus.PREGNANT, PregnancyStatus.BREASTFEEDING}
            ):
                continue

            requires_more_context = not medication_context.reviewed_by_doctor
            if rule.requires_site_and_age and (
                not dermatology_context.body_site
                or medication_context.age_years is None
            ):
                requires_more_context = True
            if (
                rule.pregnancy_sensitive
                and medication_context.pregnancy_status == PregnancyStatus.UNKNOWN
            ):
                requires_more_context = True

            considerations = list(rule.considerations)
            if not medication_context.reviewed_by_doctor:
                considerations.append(
                    "Verify allergies, current medications, age, and other contraindications before prescribing."
                )

            suggestions.append(
                MedicationSuggestion(
                    name_or_class=rule.name_or_class,
                    role=rule.role,
                    considerations=list(dict.fromkeys(considerations)),
                    requires_more_context=requires_more_context,
                )
            )

        guidance = (
            "Physician-review options only. No dose, frequency, duration, or automatic prescription is generated."
        )
        if not medication_context.reviewed_by_doctor:
            guidance += (
                " Medication context has not been confirmed by the doctor, so patient-specific safety checks remain required."
            )

        return MedicationSuggestionOutcome(suggestions, guidance)
