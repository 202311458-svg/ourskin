import os
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import Optional, Any

from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from supabase import create_client, Client
from storage3.exceptions import StorageApiError


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "ourskin-images")


def validate_supabase_config():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is missing in your backend .env file.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing in your backend .env file.")

    key = SUPABASE_SERVICE_ROLE_KEY.strip()

    is_legacy_jwt_key = key.count(".") == 2
    is_new_secret_key = key.startswith("sb_secret_")

    if not is_legacy_jwt_key and not is_new_secret_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is invalid. Use either the legacy service_role JWT key or the new sb_secret_ key."
        )

    if not SUPABASE_STORAGE_BUCKET:
        raise RuntimeError("SUPABASE_STORAGE_BUCKET is missing in your backend .env file.")


validate_supabase_config()

supabase: Client = create_client(
    SUPABASE_URL.strip(),
    SUPABASE_SERVICE_ROLE_KEY.strip(),
)


def get_safe_extension(filename: str | None, content_type: str | None) -> str:
    if filename:
        extension = Path(filename).suffix.lower()

        if extension in [".jpg", ".jpeg", ".png", ".webp"]:
            return extension

    if content_type == "image/png":
        return ".png"

    if content_type == "image/webp":
        return ".webp"

    return ".jpg"


def normalize_extension(extension: str | None) -> str:
    if not extension:
        return ".jpg"

    extension = extension.strip().lower()

    if not extension.startswith("."):
        extension = f".{extension}"

    if extension not in [".jpg", ".jpeg", ".png", ".webp"]:
        return ".jpg"

    return extension


def clean_storage_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None

    cleaned = path.strip()

    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        marker = f"/{SUPABASE_STORAGE_BUCKET}/"

        if marker in cleaned:
            cleaned = cleaned.split(marker, 1)[1]
        else:
            return cleaned

    cleaned = cleaned.lstrip("/")

    return cleaned


def save_temp_image(file_or_bytes: Any, extension: str | None = None) -> str:
    """
    Saves an uploaded image temporarily so the AI model can read it locally.

    Supports:
    save_temp_image(file)
    save_temp_image(file_bytes, extension)
    """

    try:
        if isinstance(file_or_bytes, bytes):
            safe_extension = normalize_extension(extension)

            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=safe_extension,
            )

            with temp_file as buffer:
                buffer.write(file_or_bytes)

            return temp_file.name

        if isinstance(file_or_bytes, UploadFile) or hasattr(file_or_bytes, "file"):
            file = file_or_bytes
            safe_extension = get_safe_extension(file.filename, file.content_type)

            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=safe_extension,
            )

            file.file.seek(0)

            with temp_file as buffer:
                shutil.copyfileobj(file.file, buffer)

            file.file.seek(0)

            return temp_file.name

        raise ValueError("Unsupported file type passed to save_temp_image.")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save temporary image: {str(e)}",
        )


def delete_temp_file(file_path: str | None) -> None:
    if not file_path:
        return

    try:
        if os.path.exists(file_path):
            os.remove(file_path)

    except Exception:
        pass


async def upload_skin_image_to_supabase(
    file: UploadFile,
    appointment_id: int,
    patient_id: int | None = None,
) -> str:
    try:
        file.file.seek(0)
        file_bytes = await file.read()
        file.file.seek(0)

        extension = get_safe_extension(file.filename, file.content_type)
        file_name = f"{uuid.uuid4().hex}{extension}"

        folder = f"skin-analyses/appointment-{appointment_id}"

        if patient_id:
            folder = f"skin-analyses/patient-{patient_id}/appointment-{appointment_id}"

        storage_path = f"{folder}/{file_name}"

        supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type or "image/jpeg",
                "cache-control": "3600",
                "upsert": "false",
            },
        )

        return storage_path

    except StorageApiError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase image upload failed: {str(e)}",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected image upload error: {str(e)}",
        )


def upload_skin_bytes_to_supabase(
    file_bytes: bytes,
    content_type: str,
    patient_id: int,
    appointment_id: int,
    original_filename: str | None = None,
    filename: str | None = None,
) -> str:
    """
    Uploads raw image bytes to Supabase.

    Supports both:
    original_filename=...
    filename=...

    This prevents errors when ai_analysis.py uses filename as the keyword.
    """

    try:
        final_filename = original_filename or filename

        extension = get_safe_extension(final_filename, content_type)
        file_name = f"{uuid.uuid4().hex}{extension}"

        storage_path = (
            f"skin-analyses/patient-{patient_id}/"
            f"appointment-{appointment_id}/{file_name}"
        )

        supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": content_type or "image/jpeg",
                "cache-control": "3600",
                "upsert": "false",
            },
        )

        return storage_path

    except StorageApiError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase image upload failed: {str(e)}",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected image upload error: {str(e)}",
        )


def create_signed_image_url(storage_path: str | None, expires_in: int = 3600) -> str:
    try:
        if not storage_path:
            return ""

        cleaned_path = clean_storage_path(storage_path)

        if not cleaned_path:
            return ""

        if cleaned_path.startswith("http://") or cleaned_path.startswith("https://"):
            return cleaned_path

        response = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).create_signed_url(
            cleaned_path,
            expires_in,
        )

        if isinstance(response, dict):
            return (
                response.get("signedURL")
                or response.get("signedUrl")
                or response.get("signed_url")
                or ""
            )

        signed_url = getattr(response, "signed_url", None)
        if signed_url:
            return signed_url

        signed_url = getattr(response, "signedURL", None)
        if signed_url:
            return signed_url

        return ""

    except StorageApiError as e:
        error_text = str(e)

        if "Object not found" in error_text or "not_found" in error_text:
            return ""

        raise HTTPException(
            status_code=500,
            detail=f"Supabase signed image URL failed: {str(e)}",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected signed image URL error: {str(e)}",
        )