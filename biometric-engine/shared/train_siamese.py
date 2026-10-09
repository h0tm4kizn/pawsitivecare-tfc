"""
FILE: shared/train_siamese.py
PURPOSE: Trains the Siamese network on pet image pairs.
Run this script once you have enough training data (minimum 10 pets, 2+ images each).

Usage:
    python shared/train_siamese.py --data dog-noseprint/dataset --epochs 20
"""
import os, sys, argparse, json
from datetime import datetime
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from keras.callbacks import ModelCheckpoint, EarlyStopping, CSVLogger
from keras.utils import Sequence
from keras.applications.efficientnet_v2 import preprocess_input
import tensorflow as tf

sys.path.append(os.path.dirname(__file__))
from siamese_model import (
    build_siamese,
    contrastive_accuracy,
    contrastive_loss,
)
from roi_readiness import inspect_images, write_readiness_report
from identity_preprocessing import prepare_identity_image, model_input_from_identity
from dataset_audit import write_dataset_audit

LOGS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))


def _infer_species_token(data_dir):
    path = str(data_dir).lower().replace('\\', '/')
    if 'dog-noseprint' in path:
        return 'dog_training'
    if 'cat-facial-recog' in path:
        return 'cat_training'
    return 'siamese_training'


def _infer_species(data_dir):
    path = str(data_dir).lower().replace('\\', '/')
    if 'dog-noseprint' in path:
        return 'dog'
    if 'cat-facial-recog' in path:
        return 'cat'
    raise ValueError('Training data path must identify dog-noseprint or cat-facial-recog')

def generate_pairs(data_dir, split="train", augment_factor=5, negative_ratio=9):
    """
    Generate balanced positive/negative pairs with data augmentation.
    Target: 10% positive, 90% negative pairs (realistic distribution)
    """
    pairs_a, pairs_b, labels = [], [], []
    
    species = _infer_species(data_dir)
    # Collect all images per pet before performing one complete ROI preflight.
    pets = {}
    all_paths = []
    for pet_folder in os.listdir(data_dir):
        pet_path = os.path.join(data_dir, pet_folder)
        if not os.path.isdir(pet_path):
            continue
        images = []
        split_path = os.path.join(pet_path, split)
        if os.path.isdir(split_path):
            for f in os.listdir(split_path):
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    images.append(os.path.join(split_path, f))
        all_paths.extend(images)
        if len(images) >= 2:  # Need at least 2 images per pet
            pets[pet_folder] = images

    ready, failures = inspect_images(all_paths, species)
    write_readiness_report(data_dir, species, split, all_paths, ready, failures)
    ready_set = set(ready)
    pets = {pet: [path for path in paths if path in ready_set] for pet, paths in pets.items()}
    pets = {pet: paths for pet, paths in pets.items() if len(paths) >= 2}
    
    if len(pets) < 3:
        raise ValueError(f"Need at least 3 pets with 2+ images each. Found {len(pets)} pets.")
    
    pet_names = list(pets.keys())
    
    # Generate positive pairs (same pet) with augmentation
    positive_pairs = []
    for pet, images in pets.items():
        for i in range(len(images)):
            for j in range(i + 1, len(images)):
                positive_pairs.append((images[i], images[j]))
    
    # Augment positive pairs
    for _ in range(augment_factor):
        for img_a, img_b in positive_pairs:
            pairs_a.append(img_a)
            pairs_b.append(img_b)
            labels.append(1.0)
    
    # Generate negative pairs (different pets) - 9x more than positive
    target_negative = len(pairs_a) * negative_ratio
    np.random.seed(42)
    
    for _ in range(target_negative):
        pet_a, pet_b = np.random.choice(pet_names, 2, replace=False)
        img_a = np.random.choice(pets[pet_a])
        img_b = np.random.choice(pets[pet_b])
        pairs_a.append(img_a)
        pairs_b.append(img_b)
        labels.append(0.0)
    
    # Shuffle all pairs without requiring scikit-learn.
    rng = np.random.default_rng(42)
    order = rng.permutation(len(labels))
    pairs_a = [pairs_a[i] for i in order]
    pairs_b = [pairs_b[i] for i in order]
    labels = np.asarray(labels, dtype=np.float32)[order]
    return pairs_a, pairs_b, labels


def generate_gallery_pairs(data_dir, query_split="val", reference_split="train", negative_ratio=3):
    """Build validation pairs from held-out queries and training references."""
    pets = {}
    query_paths, reference_paths = [], []
    for pet_folder in os.listdir(data_dir):
        pet_path = os.path.join(data_dir, pet_folder)
        query_path = os.path.join(pet_path, query_split)
        reference_path = os.path.join(pet_path, reference_split)
        if not os.path.isdir(query_path) or not os.path.isdir(reference_path):
            continue
        query = [os.path.join(query_path, f) for f in os.listdir(query_path)
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        reference = [os.path.join(reference_path, f) for f in os.listdir(reference_path)
                     if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        query_paths.extend(query)
        reference_paths.extend(reference)
        if query and reference:
            pets[pet_folder] = (query, reference)

    all_paths = query_paths + reference_paths
    ready, failures = inspect_images(all_paths, _infer_species(data_dir))
    write_readiness_report(data_dir, _infer_species(data_dir), f"{query_split}_{reference_split}", all_paths, ready, failures)
    ready_set = set(ready)
    pets = {
        pet: ([path for path in query if path in ready_set], [path for path in reference if path in ready_set])
        for pet, (query, reference) in pets.items()
    }
    pets = {pet: pair for pet, pair in pets.items() if pair[0] and pair[1]}

    if len(pets) < 3:
        raise ValueError(f"Need at least 3 pets with query and reference images. Found {len(pets)} pets.")

    pairs_a, pairs_b, labels = [], [], []
    pet_names = sorted(pets)
    rng = np.random.default_rng(43)

    for pet_name, (queries, references) in pets.items():
        for query_path in queries:
            for reference_path in references:
                pairs_a.append(query_path)
                pairs_b.append(reference_path)
                labels.append(1.0)

                other_pet = rng.choice([name for name in pet_names if name != pet_name])
                other_reference = rng.choice(pets[other_pet][1])
                pairs_a.append(query_path)
                pairs_b.append(other_reference)
                labels.append(0.0)

    order = rng.permutation(len(labels))
    return (
        [pairs_a[i] for i in order],
        [pairs_b[i] for i in order],
        np.asarray(labels, dtype=np.float32)[order],
    )

def load_training_image(path, rng, species):
    """Create one realistic view from the same detected identity ROI as inference."""
    identity_array, _ = prepare_identity_image(path, species)
    img = Image.fromarray(identity_array).convert('RGB')
    width, height = img.size

    # Simulate close-up framing while keeping the centered nose region intact.
    if rng.random() < 0.75:
        scale = float(rng.uniform(0.88, 1.0))
        crop_w = max(1, int(width * scale))
        crop_h = max(1, int(height * scale))
        left = max(0, (width - crop_w) // 2 + int(rng.integers(-8, 9)))
        top = max(0, (height - crop_h) // 2 + int(rng.integers(-8, 9)))
        left = min(left, width - crop_w)
        top = min(top, height - crop_h)
        img = img.crop((left, top, left + crop_w, top + crop_h))

    if rng.random() < 0.8:
        img = ImageEnhance.Brightness(img).enhance(float(rng.uniform(0.80, 1.20)))
    if rng.random() < 0.7:
        img = ImageEnhance.Contrast(img).enhance(float(rng.uniform(0.85, 1.15)))
    if rng.random() < 0.15:
        img = img.filter(ImageFilter.GaussianBlur(radius=float(rng.uniform(0.1, 0.5))))

    return model_input_from_identity(np.asarray(img), preprocess_input)


def load_identity_training_image(path, species):
    """Load an unaugmented training/validation sample exactly as inference does."""
    identity_array, _ = prepare_identity_image(path, species)
    return model_input_from_identity(identity_array, preprocess_input)


def load_pairs(pairs_a, pairs_b, labels, species, augment=False, seed=42):
    rng = np.random.default_rng(seed)
    loader = lambda path: load_training_image(path, rng, species) if augment else load_identity_training_image(path, species)
    X_a = np.vstack([loader(p) for p in pairs_a])
    X_b = np.vstack([loader(p) for p in pairs_b])
    return X_a, X_b, labels


class PairSequence(Sequence):
    """Load only one training batch at a time to keep expanded runs practical."""

    def __init__(self, pairs_a, pairs_b, labels, batch_size, species, augment=False, seed=42):
        super().__init__()
        self.pairs_a = pairs_a
        self.pairs_b = pairs_b
        self.labels = np.asarray(labels, dtype=np.float32)
        self.batch_size = int(batch_size)
        self.species = species
        self.augment = augment
        self.seed = seed
        self.epoch = 0
        self.order = np.arange(len(self.labels))

    def __len__(self):
        return int(np.ceil(len(self.labels) / self.batch_size))

    def __getitem__(self, index):
        start = index * self.batch_size
        selected = self.order[start:start + self.batch_size]
        rng = np.random.default_rng(self.seed + self.epoch * 1009 + index)
        loader = lambda path: load_training_image(path, rng, self.species) if self.augment else load_identity_training_image(path, self.species)
        xa = np.vstack([loader(self.pairs_a[i]) for i in selected])
        xb = np.vstack([loader(self.pairs_b[i]) for i in selected])
        return (xa, xb), self.labels[selected]

    def on_epoch_end(self):
        self.epoch += 1
        rng = np.random.default_rng(self.seed + self.epoch)
        rng.shuffle(self.order)

def train(data_dir, split="train", epochs=50, batch_size=16, augment_factor=5,
          negative_ratio=9, image_augmentation=False):
    print(f"Generating pairs from: {data_dir} ({split} split only)")
    species = _infer_species(data_dir)
    dataset_audit = write_dataset_audit(data_dir, species)
    if dataset_audit['status'] == 'FAIL':
        raise ValueError(
            f"Exact image duplicates cross train/validation/test splits: "
            f"{dataset_audit['duplicate_group_count']} groups. Clean the split before training."
        )
    try:
        pairs_a, pairs_b, labels = generate_pairs(
            data_dir,
            split=split,
            augment_factor=augment_factor,
            negative_ratio=negative_ratio,
        )
    except ValueError as e:
        print(f"Error: {e}")
        return
    
    pos_count = int(labels.sum())
    neg_count = int((1-labels).sum())
    print(f"Total pairs: {len(labels)} ({pos_count} positive, {neg_count} negative)")
    print(f"Positive ratio: {pos_count/len(labels):.1%}")
    
    if len(labels) < 100:
        print("Warning: Very small dataset. Consider adding more pets/images.")
    
    print("Preparing streaming training batches...")
    train_sequence = PairSequence(
        pairs_a, pairs_b, labels, batch_size=batch_size,
        species=species,
        augment=image_augmentation, seed=42,
    )
    
    model = build_siamese()
    weights_path = os.path.join(
        os.path.dirname(__file__), f"siamese_weights_{species}_metric.weights.h5"
    )
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
        loss=contrastive_loss,
        metrics=[contrastive_accuracy]
    )

    print("Building official validation pairs from val queries and train references...")
    val_pairs_a, val_pairs_b, val_y = generate_gallery_pairs(data_dir)
    val_sequence = PairSequence(
        val_pairs_a, val_pairs_b, val_y, batch_size=batch_size,
        species=species,
        augment=False, seed=43,
    )
    
    os.makedirs(LOGS_DIR, exist_ok=True)
    run_id = f"{_infer_species_token(data_dir)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    metrics_csv = os.path.join(LOGS_DIR, f"{run_id}_metrics.csv")
    metrics_json = os.path.join(LOGS_DIR, f"{run_id}_metrics.json")

    callbacks = [
        ModelCheckpoint(weights_path, save_best_only=True, save_weights_only=True,
                       monitor='val_contrastive_accuracy', mode='max'),
        EarlyStopping(patience=10, restore_best_weights=True, monitor='val_contrastive_accuracy', mode='max'),
        tf.keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5, min_lr=1e-7),
        CSVLogger(metrics_csv)
    ]
    
    history = model.fit(
        train_sequence,
        epochs=epochs,
        validation_data=val_sequence,
        callbacks=callbacks,
        verbose=1
    )
    
    # Print final metrics
    final_acc = max(history.history['val_contrastive_accuracy'])
    print(f"\nTraining complete. Best validation accuracy: {final_acc:.3f}")
    print(f"Weights saved to: {weights_path}")
    with open(metrics_json, 'w', encoding='utf-8') as handle:
        json.dump({
            'run_id': run_id,
            'dataset': os.path.abspath(data_dir),
            'split': split,
            'epochs_completed': len(history.history['loss']),
            'best_val_contrastive_accuracy': float(final_acc),
            'weights': os.path.abspath(weights_path),
            'metrics_csv': os.path.abspath(metrics_csv),
        }, handle, indent=2)
    print(f"Metrics saved to: {metrics_csv}")
    print(f"Run summary saved to: {metrics_json}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True, help='Path to the species dataset folder')
    parser.add_argument('--split', default='train', choices=['train'],
                        help='Dataset split used for training (default: train)')
    parser.add_argument('--epochs', type=int, default=20)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--augment-factor', type=int, default=5)
    parser.add_argument('--negative-ratio', type=int, default=9)
    parser.add_argument('--image-augmentation', action='store_true',
                        help='Apply geometry-preserving pixel augmentation to training images')
    args = parser.parse_args()
    train(
        args.data,
        split=args.split,
        epochs=args.epochs,
        batch_size=args.batch_size,
        augment_factor=args.augment_factor,
        negative_ratio=args.negative_ratio,
        image_augmentation=args.image_augmentation,
    )
