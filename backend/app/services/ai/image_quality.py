from io import BytesIO

import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

from app.schemas.ai_analysis import ImageQualityAssessment


class ImageQualityService:
    MIN_SHORT_SIDE = 224
    DARK_MEAN_THRESHOLD = 25.0
    BRIGHT_MEAN_THRESHOLD = 235.0
    LOW_CONTRAST_STD_THRESHOLD = 10.0
    BLUR_EDGE_VARIANCE_THRESHOLD = 4.0

    def assess(self, image_bytes: bytes) -> ImageQualityAssessment:
        issues: list[str] = []
        blocking_issues: list[str] = []

        try:
            with Image.open(BytesIO(image_bytes)) as source:
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError):
            return ImageQualityAssessment(
                usable=False,
                issues=["unreadable_image"],
                note="The image could not be decoded for clinical assessment.",
            )

        width, height = image.size
        if min(width, height) < self.MIN_SHORT_SIDE:
            blocking_issues.append("low_resolution")

        grayscale = np.asarray(image.convert("L"), dtype=np.float32)
        brightness = float(grayscale.mean())
        contrast = float(grayscale.std())

        if brightness < self.DARK_MEAN_THRESHOLD:
            blocking_issues.append("too_dark")
        elif brightness > self.BRIGHT_MEAN_THRESHOLD:
            blocking_issues.append("too_bright")

        if contrast < self.LOW_CONTRAST_STD_THRESHOLD:
            issues.append("low_contrast")

        edge_image = image.convert("L").filter(ImageFilter.FIND_EDGES)
        edge_values = np.asarray(edge_image, dtype=np.float32)
        edge_variance = float(edge_values.var())
        if edge_variance < self.BLUR_EDGE_VARIANCE_THRESHOLD:
            issues.append("possible_blur")

        all_issues = list(dict.fromkeys(blocking_issues + issues))
        usable = not blocking_issues
        if usable and not all_issues:
            note = "Image passed the deterministic pre-inference quality checks."
        elif usable:
            note = "Image is usable, but one or more non-blocking quality issues were detected."
        else:
            note = "Retake or replace the image before AI dermatology inference."

        return ImageQualityAssessment(usable=usable, issues=all_issues, note=note)
