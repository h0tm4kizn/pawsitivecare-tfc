"""
FILE: dog-noseprint/src/create_database.py
PURPOSE: Seeds the dog biometric database from dataset/*/train/ folders.

For each training image, 8 augmented variants are stored under the same pet name.
During scanning, group-by-name matching takes the best score across all variants —
giving each pet multiple reference points that cover real-world photo variation.
Pet name defaults to the folder name (e.g., "dog1").
"""
import os, sys, sqlite3, argparse, re

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))
from feature_extract import extract_features_from_array
from augment import augment_registration_image, pil_to_array
from identity_preprocessing import prepare_identity_image
from biometric_config import production_mode
from database import init_db
_species_weights = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'shared', 'siamese_weights_dog_metric.weights.h5'))
os.environ['SIAMESE_WEIGHTS_PATH'] = _species_weights
from siamese_model import SIAMESE_WEIGHTS, extract_embedding_from_array

DB_PATH   = os.path.join(os.path.dirname(__file__), 'Database', 'dog.db')
TRAINED = os.path.exists(SIAMESE_WEIGHTS)
if production_mode() and not TRAINED:
    raise RuntimeError(f"Production gallery generation requires Siamese weights: {_species_weights}")


def numeric_folder_key(folder_name):
    match = re.search(r"(\d+)$", folder_name)
    return int(match.group(1)) if match else float("inf")


def reset_table(cursor):
    cursor.execute("DROP TABLE IF EXISTS pets")
    cursor.execute("CREATE TABLE pets (key INTEGER, value BLOB, image_path TEXT, name TEXT)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        default=os.path.join(os.path.dirname(__file__), '..', 'dataset'),
        help="Dataset root containing dog*/train folders.",
    )
    parser.add_argument("--exclude", nargs="*", default=[], help="Dog folders to skip, e.g. dog1")
    args = parser.parse_args()
    excluded = set(args.exclude)
    data_root = os.path.abspath(args.data)

    init_db(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    reset_table(cursor)

    i = 1
    folders = [
        f for f in os.listdir(data_root)
        if os.path.isdir(os.path.join(data_root, f)) and f.lower().startswith("dog")
    ]
    for folder_name in sorted(folders, key=numeric_folder_key):
        if folder_name in excluded:
            continue

        train_path = os.path.join(data_root, folder_name, 'train')
        if not os.path.isdir(train_path):
            continue

        for image_file in sorted(os.listdir(train_path)):
            if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue

            image_path = os.path.join(train_path, image_file)
            abs_path   = os.path.abspath(image_path)
            variants   = augment_registration_image(image_path)

            for v_idx, variant in enumerate(variants):
                image_array = pil_to_array(variant)
                recognition_array, _ = prepare_identity_image(image_array, 'dog')
                features = (extract_embedding_from_array(recognition_array) if TRAINED
                            else extract_features_from_array(recognition_array))
                label    = 'original' if v_idx == 0 else f'aug{v_idx}'
                cursor.execute(
                    "INSERT INTO pets (key, value, image_path, name) VALUES (?, ?, ?, ?)",
                    (i, sqlite3.Binary(features.tobytes()), abs_path, folder_name),
                )
                if v_idx == 0:
                    print(f"Registered: {folder_name} → {image_file} + {len(variants)-1} augmented views (IDs {i}–{i+len(variants)-1})")
                i += 1

    conn.commit()
    conn.close()
    total_pets = i - 1
    print(f"\nDone! {total_pets} entries stored ({total_pets // len(variants)} dogs × {len(variants)} views).")


if __name__ == "__main__":
    main()
