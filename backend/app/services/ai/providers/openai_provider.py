import base64
from collections.abc import Sequence

from app.schemas.ai_analysis import DermatologyClinicalContext, ProviderDermatologyResult
from app.services.ai.contracts import (
    AIProviderConfigurationError,
    AIProviderError,
    TaxonomyCondition,
)


SYSTEM_INSTRUCTIONS = """You are a dermatology image decision-support component for licensed physicians.
Analyze only visible image evidence plus the limited clinical context supplied by the doctor-facing application.
This is not autonomous diagnosis and you must not prescribe medication or recommend clinic procedures in this stage.
Choose primary and differential condition codes only from the supplied OurSkin taxonomy.
Use OUT_OF_SCOPE when the finding does not fit the supported taxonomy, UNCERTAIN when the image cannot reliably distinguish candidates, and REQUIRES_DIRECT_REVIEW for flag-only findings that need direct physician assessment.
Describe only observable morphology and concise evidence; do not provide hidden reasoning or chain-of-thought.
Do not infer facts that are not visible or supplied. Do not infer patient identity, demographics, pregnancy, allergies, laboratory findings, symptoms, or history.
Severity is assessable only when the supplied taxonomy explicitly marks the primary condition as severity-supported and the image contains enough visible extent to justify it.
Never output a numeric confidence score. Use only HIGH, MODERATE, or LOW evidence strength.
Keep limitations explicit and concise."""


class OpenAIVisionAnalysisProvider:
    provider_name = "openai"

    def __init__(self, *, api_key: str, model_id: str, timeout_seconds: int = 60, client=None):
        if not api_key.strip():
            raise AIProviderConfigurationError("OPENAI_API_KEY is required for the OpenAI AI provider")
        self.model_id = model_id
        if client is not None:
            self._client = client
            return
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise AIProviderConfigurationError("The OpenAI Python SDK is not installed") from exc
        self._client = OpenAI(api_key=api_key, timeout=timeout_seconds)

    @staticmethod
    def _taxonomy_text(taxonomy: Sequence[TaxonomyCondition]) -> str:
        lines = []
        for condition in taxonomy:
            severity = "severity-supported" if condition.severity_assessment_supported else "severity-not-supported"
            lines.append(
                f"- {condition.code}: {condition.display_name} | {condition.support_level} | {severity}"
            )
        return "\n".join(lines)

    @staticmethod
    def _context_text(context: DermatologyClinicalContext) -> str:
        values = {
            "body_site": context.body_site,
            "duration": context.duration,
            "symptoms": ", ".join(context.symptoms) if context.symptoms else None,
            "progression": context.progression,
            "appointment_concern": context.appointment_concern,
            "booked_service": context.booked_service_name,
        }
        return "\n".join(f"{key}: {value or 'not provided'}" for key, value in values.items())

    def analyze_dermatology(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        context: DermatologyClinicalContext,
        taxonomy: Sequence[TaxonomyCondition],
    ) -> ProviderDermatologyResult:
        if content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise AIProviderError("Unsupported image content type for vision inference")
        if not taxonomy:
            raise AIProviderError("Dermatology taxonomy is empty")

        encoded = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{content_type};base64,{encoded}"
        user_text = (
            "Assess this dermatology image using the exact taxonomy below.\n\n"
            f"CLINICAL CONTEXT\n{self._context_text(context)}\n\n"
            f"ALLOWED TAXONOMY\n{self._taxonomy_text(taxonomy)}\n\n"
            "Return structured decision support only. Do not add medication or service recommendations."
        )

        try:
            response = self._client.responses.parse(
                model=self.model_id,
                instructions=SYSTEM_INSTRUCTIONS,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": user_text},
                            {"type": "input_image", "image_url": data_url, "detail": "high"},
                        ],
                    }
                ],
                text_format=ProviderDermatologyResult,
                store=False,
            )
        except Exception as exc:
            raise AIProviderError("Vision analysis provider request failed") from exc

        output_parsed = getattr(response, "output_parsed", None)
        if isinstance(output_parsed, ProviderDermatologyResult):
            return output_parsed

        for output in getattr(response, "output", []):
            if getattr(output, "type", None) != "message":
                continue
            for content in getattr(output, "content", []):
                parsed = getattr(content, "parsed", None)
                if isinstance(parsed, ProviderDermatologyResult):
                    return parsed

        raise AIProviderError("Vision analysis provider returned no structured result")
