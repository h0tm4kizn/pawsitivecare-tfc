"""
FILE: shared/siamese_model.py
PURPOSE: Siamese Neural Network using EfficientNetV2B0 as backbone.
Learns to directly compare two pet images and output a similarity score.
Inspired by PetNow's approach (DNNet + Siamese) adapted for PawsitiveCare.

Architecture:
    EfficientNetV2B0 (ImageNet) → GAP → Dense(512) → Dense(128) → 128D embedding
    Siamese: two inputs share the same backbone → |emb_a - emb_b| → Dense(1, sigmoid)
"""
import os
import numpy as np
from keras.applications import EfficientNetV2B0
from keras.applications.efficientnet_v2 import preprocess_input
from keras.models import Model
from keras.layers import Input, Lambda, Dense, Dropout, GlobalAveragePooling2D
from keras.preprocessing import image
import tensorflow as tf

from biometric_config import INPUT_SHAPE
from identity_preprocessing import model_input_from_identity

SHARED_DIR = os.path.dirname(__file__)
DEFAULT_SIAMESE_WEIGHTS = os.path.join(SHARED_DIR, 'siamese_weights.weights.h5')
DOG_SIAMESE_WEIGHTS = os.path.join(SHARED_DIR, 'siamese_weights_dog_metric.weights.h5')
CAT_SIAMESE_WEIGHTS = os.path.join(SHARED_DIR, 'siamese_weights_cat_metric.weights.h5')
SIAMESE_WEIGHTS = os.environ.get('SIAMESE_WEIGHTS_PATH', DEFAULT_SIAMESE_WEIGHTS)

# ── Builders ───────────────────────────────────────────────────────────────────

def build_backbone():
    """EfficientNetV2B0 + projection head → 128D embedding."""
    base = EfficientNetV2B0(weights='imagenet', include_top=False, input_shape=INPUT_SHAPE)
    # Keep ImageNet features stable; 200 training images per species is too
    # small for safely fine-tuning the full backbone.
    base.trainable = False
    x = GlobalAveragePooling2D()(base.output)
    x = Dense(512, activation='relu')(x)
    x = Dropout(0.3)(x)
    x = Dense(128, activation='relu')(x)
    return Model(inputs=base.input, outputs=x, name='backbone')

def build_siamese():
    """Build a Siamese metric-learning model that outputs cosine distance."""
    backbone = build_backbone()
    input_a = Input(shape=INPUT_SHAPE, name='input_a')
    input_b = Input(shape=INPUT_SHAPE, name='input_b')
    vec_a = Lambda(lambda x: tf.math.l2_normalize(x, axis=1), name='normalize_a')(backbone(input_a))
    vec_b = Lambda(lambda x: tf.math.l2_normalize(x, axis=1), name='normalize_b')(backbone(input_b))
    output = Lambda(
        lambda t: 1.0 - tf.reduce_sum(t[0] * t[1], axis=1, keepdims=True),
        name='cosine_distance',
    )([vec_a, vec_b])
    return Model(inputs=[input_a, input_b], outputs=output, name='siamese')


def contrastive_loss(y_true, distance, margin=1.0):
    """Minimize distance for same-pet pairs and enforce a margin for different pets."""
    y_true = tf.cast(y_true, distance.dtype)
    distance = tf.squeeze(distance, axis=-1)
    return tf.reduce_mean(
        y_true * tf.square(distance)
        + (1.0 - y_true) * tf.square(tf.maximum(margin - distance, 0.0))
    )


def contrastive_accuracy(y_true, distance, threshold=0.5):
    """Accuracy for labels where 1 means same pet and 0 means different pets."""
    y_true = tf.cast(y_true, distance.dtype)
    predicted_same = tf.cast(tf.squeeze(distance, axis=-1) <= threshold, distance.dtype)
    return tf.reduce_mean(tf.cast(tf.equal(y_true, predicted_same), tf.float32))

# ── Singletons ─────────────────────────────────────────────────────────────────
# Load order matters: get_siamese() first, then get_backbone() reuses its layer.

_siamese_model = None
_backbone_model = None

def get_siamese():
    """Return trained Siamese model (loads weights if available)."""
    global _siamese_model
    if _siamese_model is None:
        _siamese_model = build_siamese()
        if os.path.exists(SIAMESE_WEIGHTS):
            _siamese_model.load_weights(SIAMESE_WEIGHTS)
            print("[Siamese] Trained weights loaded.")
        else:
            print("[Siamese] No trained weights found — using untrained network.")
    return _siamese_model

def get_backbone():
    """
    Return the backbone model for embedding extraction.
    When trained weights exist, reuses the backbone layer FROM the Siamese model
    so that extract_embedding() produces features consistent with Siamese training.
    """
    global _backbone_model
    if _backbone_model is None:
        if os.path.exists(SIAMESE_WEIGHTS):
            # Share the trained backbone from the Siamese — no separate weight load needed
            _backbone_model = get_siamese().get_layer('backbone')
        else:
            _backbone_model = build_backbone()
    return _backbone_model

# ── Image preprocessing ────────────────────────────────────────────────────────

def load_image(img_path):
    img = image.load_img(img_path, target_size=(224, 224))
    arr = image.img_to_array(img)
    return preprocess_input(np.expand_dims(arr, axis=0))

# ── Public API ─────────────────────────────────────────────────────────────────

def extract_embedding(img_path):
    """Extract 128D embedding from backbone. Uses trained weights when available."""
    return get_backbone().predict(load_image(img_path), verbose=0).flatten()

def extract_embedding_from_array(img_array):
    """Extract a 128D embedding from an RGB image array, resizing to (224, 224)."""
    arr = model_input_from_identity(img_array, preprocess_input)
    return get_backbone().predict(arr, verbose=0).flatten()

def siamese_similarity(img_path_a, img_path_b):
    """Compare two images via Siamese network. Returns similarity score 0.0–1.0."""
    img_a = load_image(img_path_a)
    img_b = load_image(img_path_b)
    score = get_siamese().predict([img_a, img_b], verbose=0)[0][0]
    return float(score)
