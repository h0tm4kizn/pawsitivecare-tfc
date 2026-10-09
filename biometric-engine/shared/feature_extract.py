"""
FILE: shared/feature_extract.py
PURPOSE: Shared EfficientNetV2B0 feature extractor and species detector used by
         both dog-noseprint and cat-facial-recog engines.

Two functions are exposed:
  extract_features(img_path) → legacy 1280D feature vector for explicit
  development/evaluation use only
  detect_species(img_path)   → 'dog' | 'cat' | 'unknown' via ImageNet classification

Both models are lazy-loaded on first use and share the same preprocessing pipeline.
"""
from keras.applications import EfficientNetV2B0
from keras.applications.efficientnet_v2 import preprocess_input
from keras.preprocessing import image
import numpy as np

from identity_preprocessing import model_input_from_identity

try:
    import cv2
except Exception:  # Keep the feature extractor importable without OpenCV.
    cv2 = None

# ── Feature extractor (no classification head → 1280D) ────────────────────────
_feature_model = None

def get_model():
    global _feature_model
    if _feature_model is None:
        _feature_model = EfficientNetV2B0(weights='imagenet', include_top=False, pooling='avg')
    return _feature_model

def extract_features(img_path):
    """Extract 1280D embedding for cosine similarity identification."""
    img = image.load_img(img_path, target_size=(224, 224))
    arr = preprocess_input(np.expand_dims(image.img_to_array(img), axis=0))
    return get_model().predict(arr, verbose=0).flatten()


def extract_features_from_array(img_array):
    """Extract 1280D embedding from numpy array, resizing to (224, 224)."""
    arr = model_input_from_identity(img_array, preprocess_input)
    return get_model().predict(arr, verbose=0).flatten()

# Human guard used before species classification. This prevents a webcam
# operator's face from being sent to the dog/cat recognition models.
_face_cascade = None

def contains_human_face(img_path):
    """Return True when a human face is detected in the uploaded image."""
    global _face_cascade
    if cv2 is None:
        return False

    frame = cv2.imread(img_path)
    if frame is None:
        return False

    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = _face_cascade.detectMultiScale(
        gray,
        # Stricter settings reduce false positives on close-up animal eyes.
        scaleFactor=1.2,
        minNeighbors=10,
        minSize=(80, 80),
    )
    return len(faces) > 0

# ── Species classifier (full ImageNet head → 1000 classes) ────────────────────
_classifier = None

# ImageNet class index ranges for domestic animals
_DOG_CLASSES = set(range(151, 269))   # 151–268: all dog breeds in ImageNet
_CAT_CLASSES = {281, 282, 283, 284, 285}  # tabby, tiger cat, Persian, Siamese, Egyptian cat
_SPECIES_CONFIDENCE = 0.80

def get_classifier():
    global _classifier
    if _classifier is None:
        _classifier = EfficientNetV2B0(weights='imagenet', include_top=True)
    return _classifier

def detect_species(img_path):
    """
    Classify the image using ImageNet and map the top prediction to a species.
    Returns 'dog', 'cat', or 'unknown'.

    Note: close-up noseprint photos often fall outside standard ImageNet classes
    and return 'unknown' — this is expected and allowed by the dog engine.
    Only a clear cat image returns 'cat', which the dog engine rejects (and vice versa).
    """
    img = image.load_img(img_path, target_size=(224, 224))
    arr = preprocess_input(np.expand_dims(image.img_to_array(img), axis=0))
    preds = get_classifier().predict(arr, verbose=0)
    probabilities = preds[0]
    top_idx = int(np.argmax(probabilities))
    if float(probabilities[top_idx]) < _SPECIES_CONFIDENCE:
        return 'unknown'
    if top_idx in _DOG_CLASSES:
        return 'dog'
    if top_idx in _CAT_CLASSES:
        return 'cat'
    return 'unknown'
