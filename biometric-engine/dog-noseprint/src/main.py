"""
FILE: dog-noseprint/src/main.py
PURPOSE: FastAPI server for dog nose print biometric identification.

Architecture (per capstone paper):
    Siamese Neural Network with EfficientNetV2B0 backbone.
    - Species check  : EfficientNetV2B0 ImageNet classifier rejects non-dog images.
    - Registration   : 1280D EfficientNetV2B0 embedding stored in DB with pet name.
    - Identification : Cosine similarity on Siamese-learned embedding space.

Runs on http://127.0.0.1:8000
"""
import os
import sys
import shutil
import uuid
from pathlib import Path
from collections import defaultdict
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from scipy.spatial.distance import cosine
import numpy as np
import uvicorn

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))
from feature_extract import extract_features, extract_features_from_array, detect_species, contains_human_face  # noqa: E402 # type: ignore
_species_weights = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'shared', 'siamese_weights_dog_metric.weights.h5'))
os.environ['SIAMESE_WEIGHTS_PATH'] = _species_weights
from siamese_model import SIAMESE_WEIGHTS, extract_embedding, extract_embedding_from_array  # noqa: E402 # type: ignore
from biometric_config import EMBEDDING_DIM, production_mode, threshold_for  # noqa: E402 # type: ignore
from identity_preprocessing import IdentityPreprocessingError, prepare_identity_image  # noqa: E402 # type: ignore
from artifact_validation import validate_for_service  # noqa: E402 # type: ignore
from database import get_all_features, insert_features  # noqa: E402 # type: ignore
from image_security import save_validated_upload  # noqa: E402 # type: ignore

app = FastAPI()
_allowed_origins = [origin.strip() for origin in os.getenv('BIOMETRIC_ALLOWED_ORIGINS', '').split(',') if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'Accept'])

DB_PATH    = os.path.join(os.path.dirname(__file__), 'Database', 'dog.db')
IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'Database', 'images')
os.makedirs(IMAGES_DIR, exist_ok=True)

TRAINED   = os.path.exists(SIAMESE_WEIGHTS)
THRESHOLD = threshold_for('dog')
EXPECTED_DIM = EMBEDDING_DIM if production_mode() else (128 if TRAINED else 1280)
ARTIFACT_SIGNATURE = validate_for_service('dog', Path(DB_PATH), Path(os.path.dirname(SIAMESE_WEIGHTS)))


def extract_for_recognition(image_path):
    image_array, roi_info = prepare_identity_image(
        image_path, 'dog', allow_full_frame=not production_mode()
    )
    raw_vec = (extract_embedding_from_array(image_array) if TRAINED
                else extract_features_from_array(image_array))
    norm = np.linalg.norm(raw_vec)
    normalized_vec = (raw_vec / norm).tolist() if norm > 0 else raw_vec
    return normalized_vec, roi_info


@app.get('/')
async def welcome():
    mode = 'Siamese Neural Network [EfficientNetV2B0]' if TRAINED else 'Cosine Similarity (untrained)'
    return f'PawsitiveCare — Dog Nose Print Biometric Engine [{mode}]'


@app.post('/reg')
async def register_dog(file: UploadFile = File(...), name: str = Form(''), pet_id: str = Form('')):
    pet_name = (name or pet_id or '').strip()
    saved_path = os.path.join(IMAGES_DIR, f"{uuid.uuid4().hex}.upload")
    await save_validated_upload(file, Path(saved_path))

    # Species validation — reject if clearly a cat
    species = detect_species(saved_path)
    if contains_human_face(saved_path) and species == 'unknown':
        os.remove(saved_path)
        return {'status': 'WRONG_SPECIES', 'error': 'Human detected. This system is for dogs and cats only.'}

    if species == 'cat':
        os.remove(saved_path)
        return {'status': 'WRONG_SPECIES', 'error': 'Cat image detected. Please use the Cat Facial Recognition tab to register cats.'}

    try:
        features, roi_info = extract_for_recognition(saved_path)
    except IdentityPreprocessingError as exc:
        os.remove(saved_path)
        return {'status': 'ROI_NOT_DETECTED', 'error': str(exc), 'preprocessing': exc.info}
    registered = insert_features(DB_PATH, features, saved_path, pet_name)

    if registered:
        return {'status': 'ENROLLED', 'message': 'Dog registered successfully.', 'name': pet_name, 'preprocessing': roi_info}
    return {'status': 'ENROLLED', 'message': 'Dog is already registered in the database.'}


@app.post('/scanning')
async def scan_dog(file: UploadFile = File(...)):
    temp_path = os.path.join(IMAGES_DIR, f"_scan_{uuid.uuid4().hex}.upload")
    await save_validated_upload(file, Path(temp_path))

    try:
        # Species validation — reject if clearly a cat
        species = detect_species(temp_path)
        if contains_human_face(temp_path) and species == 'unknown':
            return {'status': 'WRONG_SPECIES', 'error': 'Human detected. This system is for dogs and cats only.'}

        if species == 'cat':
            return {'status': 'WRONG_SPECIES', 'error': 'Cat image detected. Please use the Cat Facial Recognition tab to scan cats.'}

        dataset = get_all_features(DB_PATH)
        if not dataset:
            return {'status': 'NO_GALLERY', 'message': 'No dogs registered yet.'}

        stored_dim = len(next(iter(dataset.values()))['features'])
        if stored_dim != EXPECTED_DIM:
            return {
                'status': 'GALLERY_INCOMPATIBLE',
                'error': f'Embedding dimension mismatch: database has {stored_dim}D entries but this engine expects {EXPECTED_DIM}D. Rebuild the dog database.'
            }

        try:
            query_features, roi_info = extract_for_recognition(temp_path)
        except IdentityPreprocessingError as exc:
            return {'status': 'ROI_NOT_DETECTED', 'error': str(exc), 'preprocessing': exc.info}
        # Score every registered entry via Cosine Distance matching over L2-normalized embeddings
        raw_matches = []
        q_arr = np.array(query_features, dtype=np.float32)
        q_norm = np.linalg.norm(q_arr)
        q_vec = q_arr / q_norm if q_norm > 0 else q_arr

        for image_id, entry in dataset.items():
            db_arr = np.array(entry['features'], dtype=np.float32)
            db_norm = np.linalg.norm(db_arr)
            db_vec = db_arr / db_norm if db_norm > 0 else db_arr

            # Cosine distance = 1 - cosine similarity.
            c_dist = float(cosine(db_vec, q_vec))
            sim_score = max(0.0, float(1.0 - c_dist))

            raw_matches.append({
                'image_id': int(image_id),
                'image_path': entry['image_path'],
                'name': entry['name'],
                'similarity_score': round(sim_score, 4),
                'cosine_distance': round(c_dist, 4),
            })

        # Group by pet name — take the best score per unique pet
        by_name = defaultdict(list)
        for m in raw_matches:
            key = m['name'].strip() if m['name'] and m['name'].strip() else None
            if key:
                by_name[key].append(m)

        grouped = []
        for pet_name, matches in by_name.items():
            best = max(matches, key=lambda x: x['similarity_score'])
            grouped.append({
                'name': pet_name,
                'similarity_score': best['similarity_score'],
                'image_id': best['image_id'],
                'image_path': best['image_path'],
                'method': 'siamese_cosine' if TRAINED else 'cosine_1280d',
            })

        grouped.sort(key=lambda x: x['similarity_score'], reverse=True)
        high_matches = [m for m in grouped if m['similarity_score'] >= THRESHOLD]
        best_match = high_matches[0] if high_matches else None

        return {
            'status': 'IDENTIFIED' if best_match else 'UNKNOWN',
            'species': 'dog',
            'mode': 'siamese_cosine' if TRAINED else 'cosine_1280d',
            'best_match': best_match,
            'all_high_matches': high_matches,
            'total_matches_above_threshold': len(high_matches),
            'threshold': THRESHOLD,
            'preprocessing': roi_info,
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8000)
