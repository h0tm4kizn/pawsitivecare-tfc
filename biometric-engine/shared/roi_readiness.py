"""Dataset ROI preflight used before metric-learning retraining."""

import json
import os
from collections import defaultdict
from pathlib import Path

from identity_preprocessing import IdentityPreprocessingError, prepare_identity_image


IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")


def inspect_images(paths, species: str):
    successes = []
    failures = []
    for raw_path in sorted(paths):
        path = Path(raw_path)
        try:
            prepare_identity_image(path, species)
            successes.append(str(path))
        except (IdentityPreprocessingError, OSError, ValueError) as exc:
            failures.append({"path": str(path), "pet": path.parent.parent.name, "reason": str(exc)})
    return successes, failures


def write_readiness_report(data_dir, species: str, split: str, paths, successes, failures):
    os.makedirs(Path(__file__).resolve().parents[1] / "logs", exist_ok=True)
    report_path = Path(__file__).resolve().parents[1] / "logs" / f"{species}_{split}_roi_readiness.json"
    by_pet = defaultdict(lambda: {"total": 0, "success": 0, "failed": 0})
    for path in paths:
        by_pet[Path(path).parent.parent.name]["total"] += 1
    for path in successes:
        by_pet[Path(path).parent.parent.name]["success"] += 1
    for failure in failures:
        by_pet[failure["pet"]]["failed"] += 1
    payload = {
        "species": species,
        "split": split,
        "data_dir": str(Path(data_dir).resolve()),
        "total_images": len(paths),
        "roi_success": len(successes),
        "roi_failed": len(failures),
        "success_rate": (len(successes) / len(paths)) if paths else 0.0,
        "pets": dict(sorted(by_pet.items())),
        "failures": failures,
    }
    report_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return report_path


def roi_ready_paths(data_dir, species: str, split: str, paths):
    successes, failures = inspect_images(paths, species)
    write_readiness_report(data_dir, species, split, paths, successes, failures)
    return successes
