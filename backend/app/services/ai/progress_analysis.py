from dataclasses import dataclass
from time import perf_counter

from app.schemas.ai_analysis import AIAnalysisStatus
from app.schemas.ai_progress import (
    CaptureView,
    ProgressAnalysisResult,
    ProgressClinicalContext,
    ProgressTrend,
)
from app.services.ai.image_quality import ImageQualityService


PROGRESS_PIPELINE_VERSION = "ourskin-ai-progress-v1"


@dataclass(frozen=True)
class ProgressAnalysisExecution:
    result: ProgressAnalysisResult
    provider_name: str | None
    model_id: str | None
    latency_ms: int


class ProgressAnalysisService:
    def __init__(self, *, provider, image_quality_service: ImageQualityService | None = None):
        self.provider = provider
        self.image_quality_service = image_quality_service or ImageQualityService()

    def analyze(
        self,
        *,
        current_image_bytes: bytes,
        current_content_type: str,
        reference_image_url: str,
        reference_image_quality: dict | None,
        context: ProgressClinicalContext,
    ) -> ProgressAnalysisExecution:
        started = perf_counter()
        current_quality = self.image_quality_service.assess(current_image_bytes)
        if not current_quality.usable:
            result = ProgressAnalysisResult(
                status=AIAnalysisStatus.INSUFFICIENT_IMAGE,
                pipeline_version=PROGRESS_PIPELINE_VERSION,
                image_quality=current_quality,
                comparison_reliable=False,
                trend=ProgressTrend.UNABLE_TO_COMPARE,
                summary="The current image did not pass quality checks, so recovery progress was not compared.",
                limitations=["Retake the current image with clearer focus, lighting, and framing before comparing progress."],
            )
            return ProgressAnalysisExecution(result, None, None, max(0, int((perf_counter() - started) * 1000)))

        if reference_image_quality and reference_image_quality.get("usable") is False:
            result = ProgressAnalysisResult(
                status=AIAnalysisStatus.INSUFFICIENT_IMAGE,
                pipeline_version=PROGRESS_PIPELINE_VERSION,
                image_quality=current_quality,
                comparison_reliable=False,
                trend=ProgressTrend.UNABLE_TO_COMPARE,
                summary="The selected reference image was previously marked unsuitable for reliable visual assessment.",
                limitations=["Choose a different reference capture before comparing progress."],
            )
            return ProgressAnalysisExecution(result, None, None, max(0, int((perf_counter() - started) * 1000)))

        if context.reference_body_site and context.body_site:
            reference_site = " ".join(context.reference_body_site.lower().split())
            current_site = " ".join(context.body_site.lower().split())
            if reference_site != current_site:
                result = ProgressAnalysisResult(
                    status=AIAnalysisStatus.UNCERTAIN,
                    pipeline_version=PROGRESS_PIPELINE_VERSION,
                    image_quality=current_quality,
                    comparison_reliable=False,
                    trend=ProgressTrend.UNABLE_TO_COMPARE,
                    summary="The selected reference and current captures identify different body sites, so they were not compared.",
                    limitations=["Choose a reference image from the same anatomical site."],
                )
                return ProgressAnalysisExecution(result, None, None, max(0, int((perf_counter() - started) * 1000)))

        known_views = {CaptureView.FRONT, CaptureView.LEFT, CaptureView.RIGHT, CaptureView.CLOSE_UP, CaptureView.OTHER}
        if (
            context.reference_capture_view in known_views
            and context.current_capture_view in known_views
            and context.reference_capture_view != context.current_capture_view
        ):
            result = ProgressAnalysisResult(
                status=AIAnalysisStatus.UNCERTAIN,
                pipeline_version=PROGRESS_PIPELINE_VERSION,
                image_quality=current_quality,
                comparison_reliable=False,
                trend=ProgressTrend.UNABLE_TO_COMPARE,
                summary="The reference and current images use different standardized views, so a reliable trend was not generated.",
                limitations=["Use the same capture view and similar framing for longitudinal comparison."],
            )
            return ProgressAnalysisExecution(result, None, None, max(0, int((perf_counter() - started) * 1000)))

        provider_result = self.provider.analyze_progress(
            reference_image_url=reference_image_url,
            current_image_bytes=current_image_bytes,
            current_content_type=current_content_type,
            context=context,
        )
        result = ProgressAnalysisResult(
            status=provider_result.status,
            pipeline_version=PROGRESS_PIPELINE_VERSION,
            image_quality=current_quality,
            comparison_reliable=provider_result.comparison_reliable,
            trend=provider_result.trend,
            summary=provider_result.summary,
            findings=provider_result.findings,
            red_flags=provider_result.red_flags,
            limitations=provider_result.limitations,
        )
        return ProgressAnalysisExecution(
            result,
            self.provider.provider_name,
            self.provider.model_id,
            max(0, int((perf_counter() - started) * 1000)),
        )
