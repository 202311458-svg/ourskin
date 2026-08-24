import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException
from storage3.exceptions import StorageApiError
from supabase import Client, create_client


logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "ourskin-images")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_supabase_client: Client | None = None


def validate_supabase_config() -> None:
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is missing in the backend environment.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is missing in the backend environment."
        )

    key = SUPABASE_SERVICE_ROLE_KEY.strip()
    is_legacy_jwt_key = key.count(".") == 2
    is_new_secret_key = key.startswith("sb_secret_")

    if not is_legacy_jwt_key and not is_new_secret_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is invalid.")

    if not SUPABASE_STORAGE_BUCKET:
        raise RuntimeError(
            "SUPABASE_STORAGE_BUCKET is missing in the backend environment."
        )


def get_supabase_client() -> Client:
    global _supabase_client

    if _supabase_client is None:
        validate_supabase_config()
        _supabase_client = create_client(
            SUPABASE_URL.strip(),
            SUPABASE_SERVICE_ROLE_KEY.strip(),
        )

    return _supabase_client


def get_safe_extension(
    filename: str | None,
    content_type: str | None,
) -> str:
    supplied_content_type = (content_type or "").strip().lower()
    expected_extension = CONTENT_TYPE_EXTENSIONS.get(supplied_content_type)

    if not expected_extension:
        raise ValueError("Unsupported image content type")

    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Unsupported image filename extension")

    normalized_extension = ".jpg" if extension == ".jpeg" else extension
    if normalized_extension != expected_extension:
        raise ValueError(
            "Image filename extension does not match content type"
        )

    return expected_extension


def normalize_extension(extension: str | None) -> str:
    normalized = (extension or "").strip().lower()
    if not normalized.startswith("."):
        normalized = f".{normalized}" if normalized else ""
    if normalized == ".jpeg":
        normalized = ".jpg"
    if normalized not in {".jpg", ".png", ".webp"}:
        raise ValueError("Unsupported image extension")
    return normalized


def clean_storage_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None

    cleaned = path.replace("\\", "/").strip()
    if not cleaned:
        return None

    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        from urllib.parse import unquote, urlparse

        parsed = urlparse(cleaned)
        decoded_path = unquote(parsed.path)

        markers = [
            f"/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/",
            f"/storage/v1/object/sign/{SUPABASE_STORAGE_BUCKET}/",
            f"/storage/v1/object/authenticated/{SUPABASE_STORAGE_BUCKET}/",
            f"/{SUPABASE_STORAGE_BUCKET}/",
        ]

        for marker in markers:
            if marker in decoded_path:
                return decoded_path.split(marker, 1)[1].lstrip("/")

        # Historical records may store an already-resolved external URL.
        return cleaned

    bucket_prefix = f"{SUPABASE_STORAGE_BUCKET}/"
    if cleaned.startswith(bucket_prefix):
        cleaned = cleaned[len(bucket_prefix):]

    return cleaned.lstrip("/")


def upload_skin_bytes_to_supabase(
    file_bytes: bytes,
    content_type: str,
    patient_id: int,
    appointment_id: int,
    original_filename: str | None = None,
    filename: str | None = None,
) -> str:
    """Upload validated, sanitized image bytes to private Supabase storage."""

    try:
        final_filename = original_filename or filename
        extension = get_safe_extension(final_filename, content_type)
        file_name = f"{uuid.uuid4().hex}{extension}"

        storage_path = (
            f"skin-analyses/patient-{patient_id}/"
            f"appointment-{appointment_id}/{file_name}"
        )

        get_supabase_client().storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false",
            },
        )

        return storage_path

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except StorageApiError:
        logger.exception("Supabase image upload failed")
        raise HTTPException(
            status_code=503,
            detail="Image storage is temporarily unavailable.",
        )
    except HTTPException:
        raise
    except RuntimeError:
        logger.exception("Supabase image storage is not configured")
        raise HTTPException(
            status_code=503,
            detail="Image storage is temporarily unavailable.",
        )
    except Exception:
        logger.exception("Unexpected image upload failure")
        raise HTTPException(status_code=500, detail="Image upload failed.")


def delete_storage_object(storage_path: str | None) -> bool:
    """Best-effort deletion used for rollback compensation and maintenance.

    Returns True when the object is deleted, already missing, or there is no
    usable internal path. It never raises over the original clinical workflow
    failure; storage errors are logged for later maintenance.
    """

    cleaned_path = clean_storage_path(storage_path)
    if not cleaned_path:
        return True
    if cleaned_path.startswith("http://") or cleaned_path.startswith("https://"):
        return True

    try:
        get_supabase_client().storage.from_(SUPABASE_STORAGE_BUCKET).remove(
            [cleaned_path]
        )
        return True
    except StorageApiError as exc:
        error_text = str(exc).lower()
        if "object not found" in error_text or "not_found" in error_text:
            return True
        logger.warning(
            "Failed to delete Supabase object %s",
            cleaned_path,
            exc_info=True,
        )
        return False
    except Exception:
        logger.warning(
            "Unexpected failure deleting Supabase object %s",
            cleaned_path,
            exc_info=True,
        )
        return False


def create_signed_image_url(
    storage_path: str | None,
    expires_in: int = 3600,
) -> str:
    try:
        if not storage_path:
            return ""

        cleaned_path = clean_storage_path(storage_path)
        if not cleaned_path:
            return ""
        if cleaned_path.startswith("http://") or cleaned_path.startswith("https://"):
            return cleaned_path

        response = (
            get_supabase_client()
            .storage.from_(SUPABASE_STORAGE_BUCKET)
            .create_signed_url(
                cleaned_path,
                expires_in,
            )
        )

        signed_url = ""

        if isinstance(response, dict):
            signed_url = (
                response.get("signedURL")
                or response.get("signedUrl")
                or response.get("signed_url")
                or ""
            )

            data = response.get("data")
            if isinstance(data, dict):
                signed_url = (
                    signed_url
                    or data.get("signedURL")
                    or data.get("signedUrl")
                    or data.get("signed_url")
                    or ""
                )

        if not signed_url:
            signed_url = (
                getattr(response, "signed_url", None)
                or getattr(response, "signedURL", None)
                or getattr(response, "signedUrl", None)
                or ""
            )

        if signed_url and signed_url.startswith("/"):
            return f"{SUPABASE_URL.strip()}{signed_url}"

        return signed_url or ""

    except StorageApiError as exc:
        error_text = str(exc)

        if "Object not found" in error_text or "not_found" in error_text:
            return ""

        logger.exception("Supabase signed image URL failed")
        raise HTTPException(
            status_code=503,
            detail="Image storage is temporarily unavailable.",
        )

    except RuntimeError:
        logger.exception("Supabase image storage is not configured")
        raise HTTPException(
            status_code=503,
            detail="Image storage is temporarily unavailable.",
        )
    except Exception:
        logger.exception("Unexpected signed image URL failure")
        raise HTTPException(
            status_code=500,
            detail="Unable to load image.",
        )
