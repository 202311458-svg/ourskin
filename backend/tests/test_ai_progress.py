from io import BytesIO

from PIL import Image, ImageDraw

from app.schemas.ai_analysis import AIAnalysisStatus
from app.schemas.ai_progress import (
    CaptureView,
    ProgressChange,
    ProgressClinicalContext,
    ProgressFinding,
    ProgressTrend,
    ProviderProgressResult,
)
from app.services.ai.progress_analysis import ProgressAnalysisService
from app.services.ai.providers.openai_progress_provider import OpenAIProgressAnalysisProvider


def _image_bytes():
    image = Image.new("RGB", (512, 512), "white")
    draw = ImageDraw.Draw(image)
    for offset in range(0, 512, 24):
        draw.line((0, offset, 511, 511 - offset), fill="black", width=4)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


class _FakeProvider:
    provider_name = "fake"
    model_id = "fake-progress"

    def __init__(self):
        self.calls = 0

    def analyze_progress(self, **kwargs):
        self.calls += 1
        return ProviderProgressResult(
            status=AIAnalysisStatus.COMPLETED,
            comparison_reliable=True,
            trend=ProgressTrend.IMPROVING,
            summary="Visible swelling and discoloration are reduced compared with the reference image.",
            findings=[
                ProgressFinding(
                    feature="Swelling",
                    change=ProgressChange.IMPROVED,
                    description="Visible soft-tissue fullness appears reduced.",
                )
            ],
            limitations=["Image comparison cannot assess pain, warmth, tenderness, or internal healing."],
        )


def _context(**updates):
    values = dict(
        procedure_or_treatment="Cosmetic surgery follow-up",
        body_site="face",
        reference_body_site="face",
        current_capture_view=CaptureView.FRONT,
        reference_capture_view=CaptureView.FRONT,
        booked_service_name="Cosmetic Surgery",
    )
    values.update(updates)
    return ProgressClinicalContext(**values)


def test_progress_service_returns_structured_visible_trend():
    provider = _FakeProvider()
    execution = ProgressAnalysisService(provider=provider).analyze(
        current_image_bytes=_image_bytes(),
        current_content_type="image/jpeg",
        reference_image_url="https://example.test/reference.jpg?token=short-lived",
        reference_image_quality={"usable": True},
        context=_context(),
    )
    assert provider.calls == 1
    assert execution.result.comparison_reliable is True
    assert execution.result.trend == ProgressTrend.IMPROVING
    assert execution.result.findings[0].change == ProgressChange.IMPROVED
    assert "healing_percentage" not in type(execution.result).model_fields


def test_progress_service_blocks_mismatched_capture_views_before_provider():
    provider = _FakeProvider()
    execution = ProgressAnalysisService(provider=provider).analyze(
        current_image_bytes=_image_bytes(),
        current_content_type="image/jpeg",
        reference_image_url="https://example.test/reference.jpg",
        reference_image_quality={"usable": True},
        context=_context(current_capture_view=CaptureView.LEFT),
    )
    assert provider.calls == 0
    assert execution.result.comparison_reliable is False
    assert execution.result.trend == ProgressTrend.UNABLE_TO_COMPARE


def test_progress_service_blocks_different_body_sites():
    provider = _FakeProvider()
    execution = ProgressAnalysisService(provider=provider).analyze(
        current_image_bytes=_image_bytes(),
        current_content_type="image/jpeg",
        reference_image_url="https://example.test/reference.jpg",
        reference_image_quality={"usable": True},
        context=_context(body_site="left cheek", reference_body_site="right forearm"),
    )
    assert provider.calls == 0
    assert execution.result.trend == ProgressTrend.UNABLE_TO_COMPARE


class _ParsedContent:
    def __init__(self, parsed):
        self.parsed = parsed


class _Message:
    type = "message"

    def __init__(self, parsed):
        self.content = [_ParsedContent(parsed)]


class _Response:
    def __init__(self, parsed):
        self.output = [_Message(parsed)]


class _Responses:
    def __init__(self, parsed):
        self.parsed = parsed
        self.kwargs = None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        return _Response(self.parsed)


class _Client:
    def __init__(self, parsed):
        self.responses = _Responses(parsed)


def test_openai_progress_provider_sends_reference_and_current_images_stateless():
    parsed = ProviderProgressResult(
        status=AIAnalysisStatus.COMPLETED,
        comparison_reliable=True,
        trend=ProgressTrend.STABLE,
        summary="No material visible change is apparent.",
    )
    client = _Client(parsed)
    provider = OpenAIProgressAnalysisProvider(
        api_key="test-key",
        model_id="gpt-5.6-sol",
        client=client,
    )
    result = provider.analyze_progress(
        reference_image_url="https://example.test/reference.jpg?sig=abc",
        current_image_bytes=_image_bytes(),
        current_content_type="image/jpeg",
        context=_context(),
    )
    assert result.trend == ProgressTrend.STABLE
    assert client.responses.kwargs["store"] is False
    content = client.responses.kwargs["input"][0]["content"]
    images = [item for item in content if item["type"] == "input_image"]
    assert len(images) == 2
    assert images[0]["image_url"].startswith("https://")
    assert images[1]["image_url"].startswith("data:image/jpeg;base64,")
    assert all(item["detail"] == "high" for item in images)
