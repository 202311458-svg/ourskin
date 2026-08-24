from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
ALLOWED_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}
ALLOWED_FILENAME_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@dataclass(frozen=True)
class NormalizedImage:
    data: bytes
    extension: str
    content_type: str
    width: int
    height: int
    source_format: str
    metadata_stripped: bool = True


def _bad_image(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def _rgb_image(image: Image.Image) -> Image.Image:
    if image.mode in {"RGBA", "LA"} or (
        image.mode == "P" and "transparency" in image.info
    ):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def normalize_image_for_analysis(data: bytes, extension: str) -> NormalizedImage:
    """Apply EXIF orientation and re-encode without source metadata.

    The image keeps its original dimensions/aspect ratio. This helper is not a
    clinical image-quality classifier; it prepares a privacy-safe image asset for
    storage and later inference stages.
    """

    normalized_extension = ".jpg" if extension.lower() == ".jpeg" else extension.lower()
    expected = {
        ".jpg": ("JPEG", "image/jpeg"),
        ".png": ("PNG", "image/png"),
        ".webp": ("WEBP", "image/webp"),
    }.get(normalized_extension)
    if expected is None:
        raise _bad_image("Unsupported image format for analysis.")

    try:
        with Image.open(BytesIO(data)) as source:
            source_format = (source.format or "").upper()
            if source_format != expected[0]:
                raise _bad_image("Image format changed after validation.")

            source.load()
            oriented = ImageOps.exif_transpose(source)
            prepared = _rgb_image(oriented)
            width, height = prepared.size

            output = BytesIO()
            if source_format == "JPEG":
                prepared.save(output, format="JPEG", quality=95, subsampling=0)
            elif source_format == "PNG":
                prepared.save(output, format="PNG", compress_level=6)
            else:
                prepared.save(output, format="WEBP", quality=95, method=4)

            normalized_bytes = output.getvalue()
            if not normalized_bytes:
                raise _bad_image("Image could not be prepared for analysis.")

            return NormalizedImage(
                data=normalized_bytes,
                extension=normalized_extension,
                content_type=expected[1],
                width=width,
                height=height,
                source_format=source_format,
            )
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise _bad_image("Image file is invalid or corrupted.")


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
