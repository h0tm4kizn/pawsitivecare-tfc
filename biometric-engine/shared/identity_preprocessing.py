"""Shared identity-image preparation used by training, gallery creation, and inference."""

from pathlib import Path

import numpy as np
from PIL import Image

from biometric_config import (
    INPUT_SIZE,
    ROI_CONFIDENCE,
    ROI_PADDING,
)
from roi_detector import prepare_array


class IdentityPreprocessingError(RuntimeError):
    """Raised when an identity ROI cannot be produced."""

    def __init__(self, species: str, reason: str, info: dict | None = None):
        self.species = species
        self.reason = reason
        self.info = info or {}
        super().__init__(f"{species.upper()}_ROI_NOT_DETECTED: {reason}")


def load_rgb(source):
    if isinstance(source, (str, Path)):
        return np.asarray(Image.open(source).convert("RGB"))
    return np.asarray(source).astype("uint8")


def prepare_identity_image(
    source,
    species: str,
    *,
    allow_full_frame: bool = False,
    confidence: float = ROI_CONFIDENCE,
    padding: float = ROI_PADDING,
):
    """Return the identity region and metadata.

    Production callers must leave ``allow_full_frame`` false. Full-frame mode is
    retained only for explicitly named development/evaluation runs.
    """
    species = species.strip().lower()
    full_frame = load_rgb(source)
    prepared, info = prepare_array(
        full_frame,
        species,
        confidence=confidence,
        padding=padding,
        force_roi=True,
    )
    if not allow_full_frame and info.get("mode") != "roi":
        raise IdentityPreprocessingError(
            species,
            info.get("reason") or "No valid identity ROI was detected",
            info,
        )
    return prepared, info


def resize_identity_image(image_array):
    """Resize an identity region to the authoritative 224x224 model input."""
    try:
        import cv2

        return cv2.resize(
            np.asarray(image_array).astype("uint8"),
            INPUT_SIZE,
            interpolation=cv2.INTER_AREA,
        )
    except Exception:
        return np.asarray(Image.fromarray(np.asarray(image_array).astype("uint8")).resize(INPUT_SIZE))


def model_input_from_identity(image_array, preprocess_input):
    resized = resize_identity_image(image_array).astype("float32")
    return preprocess_input(np.expand_dims(resized, axis=0))
