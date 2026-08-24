import base64

from app.schemas.ai_progress import ProgressClinicalContext, ProviderProgressResult
from app.services.ai.contracts import AIProviderConfigurationError, AIProviderError


PROGRESS_SYSTEM_INSTRUCTIONS = """You are a physician-facing dermatology and post-procedure image comparison component.
Compare the REFERENCE image with the CURRENT image using only visible evidence and the supplied limited context.
Your task is longitudinal visual decision support, not diagnosis and not autonomous assessment of surgical success.
Do not provide medication, dosing, procedure instructions, or a healing percentage.
Do not infer pain, warmth, tenderness, infection, internal healing, pathology, or symptoms that are not visible or supplied.
Assess whether the two images are genuinely comparable. Differences in pose, angle, crop, lighting, distance, or image quality can invalidate the comparison.
If comparison is not reliable, set comparison_reliable=false and trend=UNABLE_TO_COMPARE.
When reliable, use only IMPROVING, STABLE, POSSIBLE_WORSENING, or MIXED for the overall visible trend.
Describe concrete visible changes such as swelling, bruising/discoloration, erythema, wound-edge appearance, scar appearance, lesion burden, pigmentation, or other directly observable morphology when relevant.
Red flags must be phrased as visible warning features requiring physician review, not definitive diagnoses.
Keep limitations explicit and concise. Do not provide hidden reasoning or chain-of-thought."""


class OpenAIProgressAnalysisProvider:
    provider_name = "openai"

    def __init__(self, *, api_key: str, model_id: str, timeout_seconds: int = 60, client=None):
        if not api_key.strip():
            raise AIProviderConfigurationError("OPENAI_API_KEY is required for progress analysis")
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
    def _context_text(context: ProgressClinicalContext) -> str:
        values = {
            "procedure_or_treatment": context.procedure_or_treatment,
            "booked_service": context.booked_service_name,
            "current_body_site": context.body_site,
            "reference_body_site": context.reference_body_site,
            "reference_procedure_or_treatment": context.reference_procedure_or_treatment,
            "days_since_procedure": context.days_since_procedure,
            "reference_capture_view": context.reference_capture_view.value,
            "current_capture_view": context.current_capture_view.value,
            "doctor_observation": context.doctor_observation,
        }
        return "\n".join(f"{key}: {value if value not in (None, '') else 'not provided'}" for key, value in values.items())

    def analyze_progress(
        self,
        *,
        reference_image_url: str,
        current_image_bytes: bytes,
        current_content_type: str,
        context: ProgressClinicalContext,
    ) -> ProviderProgressResult:
        if current_content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise AIProviderError("Unsupported current image content type for progress inference")
        if not reference_image_url.startswith("https://"):
            raise AIProviderError("Reference image requires a temporary HTTPS signed URL")

        encoded = base64.b64encode(current_image_bytes).decode("ascii")
        current_data_url = f"data:{current_content_type};base64,{encoded}"
        user_text = (
            "Compare the reference and current images for visible recovery or treatment progress.\n\n"
            f"CONTEXT\n{self._context_text(context)}\n\n"
            "The first image is REFERENCE. The second image is CURRENT. Return structured physician decision support only."
        )

        try:
            response = self._client.responses.parse(
                model=self.model_id,
                instructions=PROGRESS_SYSTEM_INSTRUCTIONS,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": user_text},
                            {"type": "input_image", "image_url": reference_image_url, "detail": "high"},
                            {"type": "input_image", "image_url": current_data_url, "detail": "high"},
                        ],
                    }
                ],
                text_format=ProviderProgressResult,
                store=False,
            )
        except Exception as exc:
            raise AIProviderError("Progress analysis provider request failed") from exc

        parsed = getattr(response, "output_parsed", None)
        if isinstance(parsed, ProviderProgressResult):
            return parsed

        for output in getattr(response, "output", []):
            if getattr(output, "type", None) != "message":
                continue
            for content in getattr(output, "content", []):
                parsed = getattr(content, "parsed", None)
                if isinstance(parsed, ProviderProgressResult):
                    return parsed

        raise AIProviderError("Progress analysis provider returned no structured result")
