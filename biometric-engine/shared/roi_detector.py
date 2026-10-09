"""YOLO-based region-of-interest extraction for biometric images."""
import os
from pathlib import Path

import numpy as np
from PIL import Image


_MODELS = {}


try:
    import cv2
except Exception:
    cv2 = None


def apply_clahe(img_rgb):
    """Apply Contrast Limited Adaptive Histogram Equalization (CLAHE) on L channel in LAB color space."""
    if cv2 is None or img_rgb is None:
        return img_rgb
    try:
        lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        return cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    except Exception:
        return img_rgb


def roi_enabled():
    """ROI is opt-in so the full-frame baseline remains available by default."""
    return os.getenv("ROI_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}


def weights_path(species):
    env_name = f"ROI_{species.upper()}_WEIGHTS"
    configured = os.getenv(env_name)
    if configured:
        return Path(configured).expanduser().resolve()

    root = Path(__file__).resolve().parents[1]
    run_name = "dog_nose" if species == "dog" else "cat_face"
    return root / "roi-annotation" / "work" / "runs" / run_name / "weights" / "best.pt"


def _load_model(species):
    path = weights_path(species)
    if not path.exists():
        return None, f"ROI weights not found: {path}"

    cache_key = (species, str(path))
    if cache_key in _MODELS:
        return _MODELS[cache_key], None

    try:
        from ultralytics import YOLO
        model = YOLO(str(path))
    except Exception as exc:
        return None, f"Unable to load ROI model: {exc}"

    _MODELS[cache_key] = model
    return model, None


def prepare_image(image_path, species, confidence=0.25, padding=0.15, force_roi=False):
    full_frame = np.asarray(Image.open(image_path).convert("RGB"))
    return prepare_array(full_frame, species, confidence, padding, str(image_path), force_roi)


def prepare_array(full_frame, species, confidence=0.25, padding=0.15, source_name="array", force_roi=False):
    """Return an RGB array and metadata for recognition preprocessing.

    If ROI detection is disabled or unavailable, the original full frame is
    returned. The metadata makes fallback behavior visible to API callers.
    """
    full_frame = np.asarray(full_frame).astype("uint8")
    height, width = full_frame.shape[:2]
    info = {
        "mode": "full_frame",
        "confidence": None,
        "box": None,
        "reason": None,
    }

    if not force_roi and not roi_enabled():
        info["reason"] = "ROI_ENABLED is not enabled"
        final_frame = apply_clahe(full_frame) if species == "dog" else full_frame
        return final_frame, info

    model, error = _load_model(species)
    if model is None:
        info["mode"] = "full_frame_fallback"
        info["reason"] = error
        final_frame = apply_clahe(full_frame) if species == "dog" else full_frame
        return final_frame, info

    try:
        results = model.predict(source=full_frame, conf=confidence, verbose=False, device="cpu")
        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            info["mode"] = "full_frame_fallback"
            info["reason"] = "No ROI detected"
            final_frame = apply_clahe(full_frame) if species == "dog" else full_frame
            return final_frame, info

        best_index = int(boxes.conf.argmax().item())
        x1, y1, x2, y2 = boxes.xyxy[best_index].tolist()
        score = float(boxes.conf[best_index].item())
        box_width = max(1.0, x2 - x1)
        box_height = max(1.0, y2 - y1)
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        side = max(box_width, box_height) * (1.0 + padding * 2.0)
        x1 = max(0, int(cx - side / 2.0))
        y1 = max(0, int(cy - side / 2.0))
        x2 = min(width, int(cx + side / 2.0))
        y2 = min(height, int(cy + side / 2.0))

        if x2 <= x1 or y2 <= y1:
            info["mode"] = "full_frame_fallback"
            info["reason"] = "Invalid ROI box"
            final_frame = apply_clahe(full_frame) if species == "dog" else full_frame
            return final_frame, info

        info.update({
            "mode": "roi",
            "confidence": round(score, 4),
            "box": [x1, y1, x2, y2],
            "frame_size": [width, height],
            "clahe_applied": species == "dog",
        })
        roi_crop = full_frame[y1:y2, x1:x2]
        final_frame = apply_clahe(roi_crop) if species == "dog" else roi_crop
        return final_frame, info
    except Exception as exc:
        info["mode"] = "full_frame_fallback"
        info["reason"] = f"ROI inference failed: {exc}"
        final_frame = apply_clahe(full_frame) if species == "dog" else full_frame
        return final_frame, info
