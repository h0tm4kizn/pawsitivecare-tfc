"""
FILE: shared/augment.py
PURPOSE: Image augmentation for gallery registration.

Generates multiple augmented views of a registration image so the biometric
database covers natural photo variation (lighting, contrast, orientation).
During scanning, group-by-name matching takes the best score across all
augmented views — effectively giving each pet multiple reference points.
"""
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np


def augment_registration_image(img_path):
    """
    Return a list of augmented PIL images from a single registration photo.
    Each variant represents a realistic photo condition the scan might encounter.
    """
    img = Image.open(img_path).convert('RGB').resize((224, 224))

    variants = [
        img,                                                        # original
        ImageEnhance.Brightness(img).enhance(1.30),                # brighter
        ImageEnhance.Brightness(img).enhance(0.70),                # darker
        ImageEnhance.Contrast(img).enhance(1.30),                  # higher contrast
        ImageEnhance.Contrast(img).enhance(0.75),                  # lower contrast
        img.transpose(Image.FLIP_LEFT_RIGHT),                      # horizontal flip
        ImageEnhance.Sharpness(img).enhance(2.0),                  # sharper
        ImageEnhance.Sharpness(img).enhance(0.0),                  # softer / blurred
    ]

    return variants


def pil_to_array(pil_img):
    """Convert PIL image to float32 numpy array (H, W, C)."""
    return np.array(pil_img, dtype=np.float32)
