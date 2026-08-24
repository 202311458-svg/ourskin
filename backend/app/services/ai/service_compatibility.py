from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.condition_service_mapping import ConditionServiceMapping
from app.models.service import Service
from app.schemas.ai_analysis import (
    AIAnalysisStatus,
    ServiceCompatibilityStatus,
    ServiceRecommendation,
)
from app.services.ai.contracts import TaxonomyCondition


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


@dataclass(frozen=True)
class ServiceCompatibilityOutcome:
    status: ServiceCompatibilityStatus | None
    reason: str | None
    recommendations: list[ServiceRecommendation]


class ServiceCompatibilityService:
    def evaluate(
        self,
        *,
        db: Session,
        analysis_status: AIAnalysisStatus,
        condition: TaxonomyCondition | None,
        booked_service_id: int | None,
        booked_service_name: str | None,
    ) -> ServiceCompatibilityOutcome:
        has_booked_service = bool(booked_service_id or booked_service_name)
        recommendations = self._recommendations(db, condition)

        if analysis_status == AIAnalysisStatus.REQUIRES_DIRECT_REVIEW:
            recommendations = recommendations or self._consultation_recommendation(db)
            return ServiceCompatibilityOutcome(
                status=(
                    ServiceCompatibilityStatus.DIRECT_REVIEW_REQUIRED
                    if has_booked_service
                    else None
                ),
                reason=(
                    "Direct physician assessment should take priority before the booked service is confirmed."
                    if has_booked_service
                    else None
                ),
                recommendations=recommendations,
            )

        if analysis_status == AIAnalysisStatus.OUT_OF_SCOPE:
            recommendations = self._consultation_recommendation(db)
            return ServiceCompatibilityOutcome(
                status=(
                    ServiceCompatibilityStatus.REVIEW_RECOMMENDED
                    if has_booked_service
                    else None
                ),
                reason=(
                    "The visible finding is outside the supported AI taxonomy; consultation is recommended before proceeding with the booked service."
                    if has_booked_service
                    else None
                ),
                recommendations=recommendations,
            )

        if analysis_status in {
            AIAnalysisStatus.INSUFFICIENT_IMAGE,
            AIAnalysisStatus.FAILED,
        }:
            return ServiceCompatibilityOutcome(
                status=(
                    ServiceCompatibilityStatus.UNABLE_TO_ASSESS
                    if has_booked_service
                    else None
                ),
                reason=(
                    "The AI result is not sufficient to judge compatibility with the booked service."
                    if has_booked_service
                    else None
                ),
                recommendations=[],
            )

        if condition is None:
            recommendations = self._consultation_recommendation(db)
            return ServiceCompatibilityOutcome(
                status=(
                    ServiceCompatibilityStatus.REVIEW_RECOMMENDED
                    if has_booked_service
                    else None
                ),
                reason=(
                    "No supported primary condition was established, so the booked service should be reviewed clinically before proceeding."
                    if has_booked_service
                    else None
                ),
                recommendations=recommendations,
            )

        if not has_booked_service:
            return ServiceCompatibilityOutcome(
                status=None,
                reason=None,
                recommendations=recommendations,
            )

        booked_service = self._find_booked_service(
            db,
            booked_service_id,
            booked_service_name,
        )
        if booked_service is None:
            return ServiceCompatibilityOutcome(
                status=ServiceCompatibilityStatus.UNABLE_TO_ASSESS,
                reason="The booked service could not be matched to an active clinic service.",
                recommendations=recommendations,
            )

        mapped_service = next(
            (
                recommendation
                for recommendation in recommendations
                if recommendation.service_id == booked_service.id
            ),
            None,
        )

        if (
            analysis_status == AIAnalysisStatus.UNCERTAIN
            or condition.support_level != "SUPPORTED"
        ):
            return ServiceCompatibilityOutcome(
                status=ServiceCompatibilityStatus.REVIEW_RECOMMENDED,
                reason=(
                    "The image finding is uncertain or limited-support, so the doctor should review treatment suitability before proceeding."
                ),
                recommendations=recommendations,
            )

        if mapped_service is None:
            return ServiceCompatibilityOutcome(
                status=ServiceCompatibilityStatus.LIKELY_DIFFERENT_CONCERN,
                reason=(
                    f"The finding is not mapped to {booked_service.name}; clinical reassessment is recommended before proceeding."
                ),
                recommendations=recommendations,
            )

        if mapped_service.relationship_type == "REVIEW_ONLY":
            return ServiceCompatibilityOutcome(
                status=ServiceCompatibilityStatus.REVIEW_RECOMMENDED,
                reason=(
                    f"{booked_service.name} can be relevant only after physician assessment for this finding."
                ),
                recommendations=recommendations,
            )

        return ServiceCompatibilityOutcome(
            status=ServiceCompatibilityStatus.COMPATIBLE,
            reason=(
                f"{booked_service.name} is mapped as a clinically relevant service for this finding, subject to physician confirmation."
            ),
            recommendations=recommendations,
        )

    def _recommendations(
        self,
        db: Session,
        condition: TaxonomyCondition | None,
    ) -> list[ServiceRecommendation]:
        if condition is None:
            return []

        rows = (
            db.query(ConditionServiceMapping, Service)
            .join(Service, Service.id == ConditionServiceMapping.service_id)
            .filter(
                ConditionServiceMapping.condition_id == condition.id,
                ConditionServiceMapping.is_active.is_(True),
                Service.is_active.is_(True),
            )
            .order_by(
                ConditionServiceMapping.priority.asc(),
                Service.name.asc(),
            )
            .all()
        )

        return [
            ServiceRecommendation(
                service_id=service.id,
                service_name=service.name,
                relationship_type=mapping.relationship_type,
                reason=mapping.notes or self._relationship_reason(mapping.relationship_type),
            )
            for mapping, service in rows
        ]

    def _consultation_recommendation(
        self,
        db: Session,
    ) -> list[ServiceRecommendation]:
        service = self._find_service_by_key(db, "CONSULTATION")
        if service is None:
            return []
        return [
            ServiceRecommendation(
                service_id=service.id,
                service_name=service.name,
                relationship_type="PRIMARY",
                reason="Direct dermatology consultation is the safest clinic pathway for this result.",
            )
        ]

    def _find_booked_service(
        self,
        db: Session,
        service_id: int | None,
        service_name: str | None,
    ) -> Service | None:
        if service_id:
            service = (
                db.query(Service)
                .filter(
                    Service.id == service_id,
                    Service.is_active.is_(True),
                )
                .first()
            )
            if service is not None:
                return service

        target_key = self._service_key(service_name)
        if target_key:
            return self._find_service_by_key(db, target_key)

        normalized = self._normalize_service_name(service_name)
        if not normalized:
            return None

        for service in db.query(Service).filter(Service.is_active.is_(True)).all():
            if self._normalize_service_name(service.name) == normalized:
                return service
        return None

    def _find_service_by_key(
        self,
        db: Session,
        service_key: str,
    ) -> Service | None:
        for service in db.query(Service).filter(Service.is_active.is_(True)).all():
            if self._service_key(service.name) == service_key:
                return service
        return None

    @staticmethod
    def _normalize_service_name(value: str | None) -> str:
        return " ".join(
            (value or "").strip().lower().replace("&", "and").split()
        )

    @classmethod
    def _service_key(cls, value: str | None) -> str | None:
        normalized = cls._normalize_service_name(value)
        for key, aliases in SERVICE_ALIASES.items():
            if normalized in aliases:
                return key
        return None

    @staticmethod
    def _relationship_reason(relationship_type: str) -> str:
        reasons = {
            "PRIMARY": "Primary clinic pathway for this finding.",
            "SECONDARY": "Potentially relevant treatment category after physician assessment.",
            "REVIEW_ONLY": "May be relevant, but only after direct physician assessment.",
        }
        return reasons[relationship_type]
