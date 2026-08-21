from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
ALLOWED_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}
ALLOWED_FILENAME_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _bad_image(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


async def read_and_validate_image(file: UploadFile) -> tuple[bytes, str, str]:
    filename = (file.filename or "").strip()
    supplied_extension = Path(filename).suffix.lower()
    supplied_content_type = (file.content_type or "").lower().strip()

    if supplied_extension not in ALLOWED_FILENAME_EXTENSIONS:
        raise _bad_image("Invalid image filename. Please upload JPG, PNG, or WEBP.")

    if supplied_content_type not in ALLOWED_CONTENT_TYPES:
        raise _bad_image("Invalid image content type. Please upload JPG, PNG, or WEBP.")

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image must be 8 MB or smaller.")
        chunks.append(chunk)

    data = b"".join(chunks)
    await file.seek(0)

    if not data:
        raise _bad_image("Uploaded image is empty.")

    try:
        with Image.open(BytesIO(data)) as image:
            detected_format = (image.format or "").upper()
            if detected_format not in ALLOWED_FORMATS:
                raise _bad_image("Image contents are not a supported JPG, PNG, or WEBP file.")

            width, height = image.size
            if width < 32 or height < 32:
                raise _bad_image("Image dimensions are too small for analysis.")
            if width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")

            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise _bad_image("Image file is invalid or corrupted.")

    extension, detected_content_type = ALLOWED_FORMATS[detected_format]
    normalized_supplied_extension = ".jpg" if supplied_extension == ".jpeg" else supplied_extension
    if normalized_supplied_extension != extension:
        raise _bad_image("Image extension does not match its actual file format.")
    if supplied_content_type != detected_content_type:
        raise _bad_image("Image content type does not match its actual file format.")

    return data, extension, detected_content_type
