"""
FILE: shared/quality_assessment.py
PURPOSE: Image quality gate for biometric pipeline.
         Must run before feature extraction on both /reg and /scanning routes.

Pipeline position: quality gate -> species gate -> embedding -> 1:N match -> decision
"""
import os

import cv2
import numpy as np


def _env_float(name, default):
    raw = os.getenv(name)
    if raw is None:
        return float(default)
    try:
        return float(raw)
    except Exception:
        return float(default)


def detect_blur(image_path, threshold=None):
    """Laplacian variance - high variance = sharp, low = blurry."""
    if threshold is None:
        threshold = _env_float("QUALITY_BLUR_THRESHOLD", 45.0)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {'is_blurry': True, 'blur_score': 0.0, 'confidence': 0.0}
    laplacian_var = float(cv2.Laplacian(img, cv2.CV_64F).var())
    return {
        'is_blurry': laplacian_var < threshold,
        'blur_score': round(laplacian_var, 2),
        'confidence': round(min(laplacian_var / threshold, 1.0), 4),
    }


def detect_edge_clarity(image_path):
    """Canny edge density - fewer edges = lower detail clarity."""
    min_edge_density = _env_float("QUALITY_MIN_EDGE_DENSITY", 0.025)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {'edge_density': 0.0, 'has_sufficient_detail': False}
    edges = cv2.Canny(img, 100, 200)
    edge_density = float(cv2.countNonZero(edges)) / (img.shape[0] * img.shape[1])
    return {
        'edge_density': round(edge_density, 4),
        'has_sufficient_detail': edge_density > min_edge_density,
    }


def detect_dirt_occlusion(image_path):
    """Histogram contrast - flat histogram / bright patches suggest dirt or occlusion."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {'contrast_score': 0.0, 'likely_occluded': True, 'brightness': 0.0}
    hist = cv2.calcHist([img], [0], None, [256], [0, 256])
    contrast = float(np.std(hist))
    return {
        'contrast_score': round(contrast, 2),
        'likely_occluded': contrast < 50,
        'brightness': round(float(np.mean(img)), 2),
    }


def detect_exposure(image_path):
    """Exposure gate to catch very dark / very bright / clipped scenes."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {
            'brightness_mean': 0.0,
            'pct_dark': 1.0,
            'pct_bright': 0.0,
            'is_too_dark': True,
            'is_too_bright': False,
            'is_clipped': True,
        }

    mean_brightness = float(np.mean(img))
    dark_pixels = float(np.mean(img <= 25))
    bright_pixels = float(np.mean(img >= 230))

    is_too_dark = mean_brightness < 55
    is_too_bright = mean_brightness > 205
    is_clipped = dark_pixels > 0.55 or bright_pixels > 0.55

    return {
        'brightness_mean': round(mean_brightness, 2),
        'pct_dark': round(dark_pixels, 4),
        'pct_bright': round(bright_pixels, 4),
        'is_too_dark': is_too_dark,
        'is_too_bright': is_too_bright,
        'is_clipped': is_clipped,
    }


def assess_image_quality(image_path, weights=None):
    """
    Composite quality score (0.0 - 1.0) combining blur, clarity, and occlusion checks.
    """
    if weights is None:
        weights = {'blur': 0.4, 'clarity': 0.3, 'occlusion': 0.3}

    blur = detect_blur(image_path)
    clarity = detect_edge_clarity(image_path)
    occlusion = detect_dirt_occlusion(image_path)
    exposure = detect_exposure(image_path)

    blur_component = min(blur['blur_score'] / 500.0, 1.0)
    clarity_component = min(clarity['edge_density'] / 0.20, 1.0)
    occlusion_component = min(occlusion['contrast_score'] / 100.0, 1.0)

    quality_score = (
        blur_component * weights['blur'] +
        clarity_component * weights['clarity'] +
        occlusion_component * weights['occlusion']
    )

    exposure_bad = exposure['is_too_dark'] or exposure['is_too_bright'] or exposure['is_clipped']

    reasons = [
        f"Blurry (Laplacian: {blur['blur_score']:.1f}, threshold: {int(_env_float('QUALITY_BLUR_THRESHOLD', 45.0))})" if blur['is_blurry'] else None,
        'Low detail (insufficient edges)' if not clarity['has_sufficient_detail'] else None,
        f"Possible dirt/occlusion (contrast: {occlusion['contrast_score']:.1f})" if occlusion['likely_occluded'] else None,
        f"Underexposed (brightness: {exposure['brightness_mean']:.1f})" if exposure['is_too_dark'] else None,
        f"Overexposed (brightness: {exposure['brightness_mean']:.1f})" if exposure['is_too_bright'] else None,
        'Extreme clipping detected (too many very dark/bright pixels)' if exposure['is_clipped'] else None,
    ]

    min_quality = _env_float("QUALITY_MIN_SCORE", 0.28)
    is_acceptable = quality_score > min_quality and not exposure_bad

    return {
        'overall_score': round(float(quality_score), 4),
        'is_acceptable': is_acceptable,
        'blur': blur,
        'clarity': clarity,
        'occlusion': occlusion,
        'exposure': exposure,
        'reasons_for_rejection': [r for r in reasons if r],
        'retry_advice': 'Hold phone steady, ensure balanced lighting (not too dark/bright), and clean the camera lens.' if not is_acceptable else None,
    }
