from app.core.config import Settings
from app.services.ai.dermatology_analysis_service import DermatologyAnalysisService
from app.services.ai.progress_analysis import ProgressAnalysisService
from app.services.ai.providers.openai_progress_provider import OpenAIProgressAnalysisProvider
from app.services.ai.providers.openai_provider import OpenAIVisionAnalysisProvider


def _openai_key(settings: Settings) -> str:
    if settings.ai_provider != "openai":
        raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")
    if settings.openai_api_key is None:
        raise RuntimeError("OPENAI_API_KEY is required before the AI pipeline can run")
    return settings.openai_api_key.get_secret_value()


def build_dermatology_analysis_service(settings: Settings) -> DermatologyAnalysisService:
    provider = OpenAIVisionAnalysisProvider(
        api_key=_openai_key(settings),
        model_id=settings.ai_model_id,
        timeout_seconds=settings.ai_request_timeout_seconds,
    )
    return DermatologyAnalysisService(provider=provider)


def build_progress_analysis_service(settings: Settings) -> ProgressAnalysisService:
    provider = OpenAIProgressAnalysisProvider(
        api_key=_openai_key(settings),
        model_id=settings.ai_model_id,
        timeout_seconds=settings.ai_request_timeout_seconds,
    )
    return ProgressAnalysisService(provider=provider)
