from datetime import date, datetime
from typing import Any

from app.core.storage import create_signed_image_url


def safe_datetime(value: Any):
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return value


def serialize_analysis(analysis):
    if not analysis:
        return None

    return {
        "id": analysis.id,
        "user_id": getattr(analysis, "user_id", None),
        "appointment_id": getattr(analysis, "appointment_id", None),

        "image_path": getattr(analysis, "image_path", None),
        "image_url": create_signed_image_url(
            getattr(analysis, "image_path", None)
        ),

        "condition": getattr(analysis, "condition", None),
        "confidence": getattr(analysis, "confidence", None),
        "severity": getattr(analysis, "severity", None),
        "recommendation": getattr(analysis, "recommendation", None),

        "possible_conditions": getattr(analysis, "possible_conditions", None),
        "key_findings": getattr(analysis, "key_findings", None),
        "prescription_suggestions": getattr(analysis, "prescription_suggestions", None),
        "follow_up_suggestions": getattr(analysis, "follow_up_suggestions", None),
        "red_flags": getattr(analysis, "red_flags", None),

        "created_at": safe_datetime(getattr(analysis, "created_at", None)),
    }