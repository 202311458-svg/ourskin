import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from pydantic import ValidationError

from app.core.image_security import read_and_validate_image
from app.routes.ai_phase3 import AIReviewUpdate


def _image_bytes(format_name: str = "PNG", size=(128, 128)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size).save(buffer, format=format_name)
    return buffer.getvalue()


def _upload(data: bytes, filename: str, content_type: str) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(data), headers={"content-type": content_type})


def test_valid_png_is_identified_from_contents():
    upload = _upload(_image_bytes("PNG"), "skin.png", "image/png")
    data, extension, content_type = asyncio.run(read_and_validate_image(upload))

    assert data
    assert extension == ".png"
    assert content_type == "image/png"


def test_disguised_image_extension_is_rejected():
    upload = _upload(_image_bytes("PNG"), "skin.jpg", "image/jpeg")

    with pytest.raises(HTTPException) as error:
        asyncio.run(read_and_validate_image(upload))

    assert error.value.status_code == 400
    assert "actual file format" in str(error.value.detail)


def test_non_image_payload_is_rejected():
    upload = _upload(b"not really an image", "skin.jpg", "image/jpeg")

    with pytest.raises(HTTPException) as error:
        asyncio.run(read_and_validate_image(upload))

    assert error.value.status_code == 400
    assert "invalid or corrupted" in str(error.value.detail)


def test_review_payload_forbids_unknown_fields():
    with pytest.raises(ValidationError):
        AIReviewUpdate.model_validate({"review_status": "Reviewed", "is_patient_visible": True})


def test_review_payload_caps_clinical_text():
    with pytest.raises(ValidationError):
        AIReviewUpdate.model_validate({"doctor_note": "x" * 4001})
