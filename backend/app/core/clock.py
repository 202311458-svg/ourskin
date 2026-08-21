from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def get_clinic_timezone() -> ZoneInfo:
    """Return the configured clinic timezone as a ZoneInfo instance."""

    return ZoneInfo(settings.clinic_timezone)


def clinic_now() -> datetime:
    """Return an aware datetime in the clinic's configured local timezone."""

    return datetime.now(get_clinic_timezone())


def clinic_today() -> date:
    """Return the current clinic-local calendar date."""

    return clinic_now().date()
