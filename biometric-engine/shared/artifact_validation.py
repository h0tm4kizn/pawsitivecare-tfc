"""Preflight validation for production biometric artifacts and gallery signatures."""

import hashlib
import json
import os
import sqlite3
from pathlib import Path

from biometric_config import (
    EMBEDDING_DIM,
    INPUT_SHAPE,
    PREPROCESSING_VERSION,
    ROI_PADDING,
    production_mode,
)


class ArtifactValidationError(RuntimeError):
    """Raised when production recognition artifacts are not compatible."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def artifact_paths(species: str, shared_dir: Path):
    species = species.lower()
    model_name = f"siamese_weights_{species}_metric.weights.h5"
    detector_run = "dog_nose" if species == "dog" else "cat_face"
    return (
        shared_dir / model_name,
        shared_dir.parent / "roi-annotation" / "work" / "runs" / detector_run / "weights" / "best.pt",
    )


def gallery_signature_path(db_path: Path) -> Path:
    return Path(f"{db_path}.signature.json")


def expected_signature(species: str, model_path: Path, detector_path: Path) -> dict:
    return {
        "species": species,
        "embedding_dim": EMBEDDING_DIM,
        "input_shape": list(INPUT_SHAPE),
        "model_sha256": sha256_file(model_path),
        "detector_sha256": sha256_file(detector_path),
        "preprocessing_version": PREPROCESSING_VERSION,
        "roi_padding": ROI_PADDING,
        "clahe": {
            "enabled": species == "dog",
            "clip_limit": 2.0,
            "tile_grid_size": [8, 8],
        },
        "embedding_normalization": "l2",
    }


def _validate_model(model_path: Path):
    from siamese_model import build_siamese

    model = build_siamese()
    model.load_weights(model_path)
    backbone = model.get_layer("backbone")
    output_shape = tuple(backbone.output_shape[1:])
    if output_shape != (EMBEDDING_DIM,):
        raise ArtifactValidationError(
            f"Model {model_path} outputs {output_shape}, expected {(EMBEDDING_DIM,)}"
        )


def _validate_detector(detector_path: Path):
    from ultralytics import YOLO

    YOLO(str(detector_path))


def _validate_gallery_dimension(db_path: Path):
    if not db_path.exists():
        raise ArtifactValidationError(f"Gallery not found: {db_path}")
    with sqlite3.connect(db_path) as connection:
        row = connection.execute("SELECT value FROM pets LIMIT 1").fetchone()
    if row is None:
        raise ArtifactValidationError(f"Gallery is empty: {db_path}")
    dimension = len(row[0]) // 4
    if len(row[0]) % 4 or dimension != EMBEDDING_DIM:
        raise ArtifactValidationError(
            f"Gallery {db_path} contains {dimension}D values; expected {EMBEDDING_DIM}D"
        )


def validate_species_artifacts(species: str, db_path: Path, shared_dir: Path):
    """Validate model, detector, gallery dimension, and immutable sidecar signature."""
    model_path, detector_path = artifact_paths(species, shared_dir)
    for label, path in (("Siamese model", model_path), ("YOLO detector", detector_path)):
        if not path.exists() or path.stat().st_size == 0:
            raise ArtifactValidationError(f"{label} unavailable: {path}")

    _validate_model(model_path)
    _validate_detector(detector_path)
    _validate_gallery_dimension(db_path)

    sidecar = gallery_signature_path(db_path)
    if not sidecar.exists():
        raise ArtifactValidationError(
            f"Gallery signature unavailable: {sidecar}. Regenerate the gallery explicitly after model lock."
        )
    try:
        recorded = json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ArtifactValidationError(f"Invalid gallery signature: {sidecar}: {exc}") from exc

    expected = expected_signature(species, model_path, detector_path)
    if recorded != expected:
        raise ArtifactValidationError(
            f"Gallery signature mismatch for {species}; explicit gallery regeneration is required"
        )
    return expected


def validate_for_service(species: str, db_path: Path, shared_dir: Path):
    if production_mode():
        return validate_species_artifacts(species, db_path, shared_dir)
    return None
