"""Authoritative runtime configuration for the biometric services."""

import os


INPUT_SIZE = (224, 224)
INPUT_SHAPE = (224, 224, 3)
EMBEDDING_DIM = 128
ROI_PADDING = 0.15
ROI_CONFIDENCE = 0.25
PREPROCESSING_VERSION = "identity-roi-v1"

PROVISIONAL_THRESHOLDS = {
    "dog": 0.50,
    "cat": 0.55,
}


def threshold_for(species: str) -> float:
    """Return the single authoritative provisional threshold for a species."""
    species = species.strip().lower()
    if species not in PROVISIONAL_THRESHOLDS:
        raise ValueError(f"Unsupported species: {species}")
    env_name = f"BIOMETRIC_{species.upper()}_THRESHOLD"
    raw = os.environ.get(env_name)
    return float(raw) if raw is not None else PROVISIONAL_THRESHOLDS[species]


def production_mode() -> bool:
    """Production is the default; development fallback must be explicit."""
    raw = os.environ.get("BIOMETRIC_PRODUCTION", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}
