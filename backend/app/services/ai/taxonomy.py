from sqlalchemy.orm import Session

from app.models.dermatology_condition import DermatologyCondition
from app.services.ai.contracts import TaxonomyCondition


TAXONOMY_VERSION = "ourskin-derm-v1"


class ConditionTaxonomyService:
    def list_active(self, db: Session) -> list[TaxonomyCondition]:
        rows = (
            db.query(DermatologyCondition)
            .filter(
                DermatologyCondition.is_active.is_(True),
                DermatologyCondition.image_assessment_supported.is_(True),
            )
            .order_by(DermatologyCondition.code.asc())
            .all()
        )
        return [
            TaxonomyCondition(
                id=row.id,
                code=row.code,
                display_name=row.display_name,
                category=row.category,
                support_level=row.support_level,
                image_assessment_supported=row.image_assessment_supported,
                severity_assessment_supported=row.severity_assessment_supported,
            )
            for row in rows
        ]
