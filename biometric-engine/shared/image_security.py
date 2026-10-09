"""Bounded, decoded-image validation shared by the biometric APIs."""

import os
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = int(os.getenv("BIOMETRIC_MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("BIOMETRIC_MAX_IMAGE_PIXELS", str(25_000_000)))
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


async def save_validated_upload(file: UploadFile, destination: Path) -> None:
    """Save an upload only after enforcing byte, format, and pixel limits."""
    if file.content_type and file.content_type.lower() not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Unsupported image type.")

    total = 0
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(64 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Image is too large.")
                output.write(chunk)

        with Image.open(destination) as image:
            image.verify()
        with Image.open(destination) as image:
            if image.format not in ALLOWED_FORMATS:
                raise HTTPException(status_code=415, detail="Unsupported image type.")
            width, height = image.size
            if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Invalid image.")
    except Exception:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Invalid image.")
