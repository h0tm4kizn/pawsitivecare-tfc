"""
FILE: shared/evaluate_pairs.py
PURPOSE: Pair-level evaluation for Siamese biometric model.

Outputs:
- CSV with every evaluated pair and prediction score
- JSON summary with confusion metrics + hardest/easiest pairs
- Optional threshold comparison CSV/JSON when --thresholds is provided

Example:
    python shared/evaluate_pairs.py --data dog-noseprint/dataset --split val
"""
import argparse
import csv
import json
import os
import random
from datetime import datetime
import numpy as np

from siamese_model import (
    build_siamese,
    DOG_SIAMESE_WEIGHTS,
    CAT_SIAMESE_WEIGHTS,
    DEFAULT_SIAMESE_WEIGHTS,
)
from train_siamese import _infer_species, _infer_species_token, LOGS_DIR, generate_gallery_pairs
from identity_preprocessing import prepare_identity_image, model_input_from_identity
from keras.applications.efficientnet_v2 import preprocess_input
from biometric_config import threshold_for
from update_training_journal import update_journal


VALID_IMAGE_EXT = (".jpg", ".jpeg", ".png")


def collect_images(data_dir, split):
    pets = {}
    for pet_folder in os.listdir(data_dir):
        pet_path = os.path.join(data_dir, pet_folder)
        if not os.path.isdir(pet_path):
            continue

        splits = [split] if split != "all" else ["train", "val", "test"]
        images = []
        for s in splits:
            split_path = os.path.join(pet_path, s)
            if not os.path.isdir(split_path):
                continue
            for name in os.listdir(split_path):
                if name.lower().endswith(VALID_IMAGE_EXT):
                    images.append(os.path.join(split_path, name))

        if len(images) >= 2:
            pets[pet_folder] = sorted(images)
    return pets


def build_pairs(pets, positive_repeat=1, negative_ratio=1, seed=42):
    rng = random.Random(seed)
    pet_names = list(pets.keys())

    positives = []
    for pet_name, imgs in pets.items():
        for i in range(len(imgs)):
            for j in range(i + 1, len(imgs)):
                positives.append((pet_name, img_a := imgs[i], pet_name, img_b := imgs[j], 1))

    pairs = positives * max(1, int(positive_repeat))
    target_neg = int(len(pairs) * float(negative_ratio))

    negatives = []
    for _ in range(target_neg):
        a, b = rng.sample(pet_names, 2)
        img_a = rng.choice(pets[a])
        img_b = rng.choice(pets[b])
        negatives.append((a, img_a, b, img_b, 0))

    pairs.extend(negatives)
    rng.shuffle(pairs)
    return pairs


def _predict_scores(model, pairs, species, image_size, backbone_name):
    if tuple((image_size, image_size)) != (224, 224):
        raise ValueError('Production pair evaluation requires the authoritative 224x224 input.')
    scored = []
    batch_size = 32
    for offset in range(0, len(pairs), batch_size):
        batch = pairs[offset:offset + batch_size]
        xa = np.vstack([
            model_input_from_identity(prepare_identity_image(row[1], species)[0], preprocess_input)
            for row in batch
        ])
        xb = np.vstack([
            model_input_from_identity(prepare_identity_image(row[3], species)[0], preprocess_input)
            for row in batch
        ])
        # The metric-learning model outputs cosine distance. Convert it to the
        # same cosine similarity score used by the production API.
        distances = model.predict([xa, xb], verbose=0).reshape(-1)
        for local, ((pet_a, img_a, pet_b, img_b, label), distance) in enumerate(zip(batch, distances)):
            score = max(-1.0, min(1.0, 1.0 - float(distance)))
            scored.append({
                "pair_index": offset + local + 1,
                "pet_a": pet_a, "image_a": img_a,
                "pet_b": pet_b, "image_b": img_b,
                "label": label, "score": score,
            })
    return scored


def evaluate_pairs(scored_pairs, threshold):
    rows = []
    tp = tn = fp = fn = 0

    for row_in in scored_pairs:
        idx = row_in["pair_index"]
        pet_a = row_in["pet_a"]
        img_a = row_in["image_a"]
        pet_b = row_in["pet_b"]
        img_b = row_in["image_b"]
        label = row_in["label"]
        score = row_in["score"]
        pred = 1 if score >= threshold else 0

        if label == 1 and pred == 1:
            tp += 1
            err_type = "true_positive"
        elif label == 0 and pred == 0:
            tn += 1
            err_type = "true_negative"
        elif label == 0 and pred == 1:
            fp += 1
            err_type = "false_positive"
        else:
            fn += 1
            err_type = "false_negative"

        margin = abs(score - threshold)
        rows.append(
            {
                "pair_index": idx,
                "pet_a": pet_a,
                "image_a": img_a,
                "pet_b": pet_b,
                "image_b": img_b,
                "label": label,
                "score": score,
                "threshold": threshold,
                "predicted_label": pred,
                "outcome": err_type,
                "margin_to_threshold": margin,
            }
        )

    total = len(rows)
    accuracy = (tp + tn) / total if total else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    return rows, {
        "pairs_total": total,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def write_csv(path, rows):
    fieldnames = [
        "pair_index",
        "pet_a",
        "image_a",
        "pet_b",
        "image_b",
        "label",
        "score",
        "threshold",
        "predicted_label",
        "outcome",
        "margin_to_threshold",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def summarize_hard_cases(rows, take=25):
    misclassified = [r for r in rows if r["outcome"] in ("false_positive", "false_negative")]
    hardest = sorted(rows, key=lambda r: r["margin_to_threshold"])[:take]
    easiest = sorted(rows, key=lambda r: r["margin_to_threshold"], reverse=True)[:take]
    return misclassified[:take], hardest, easiest


def parse_thresholds(raw):
    if not raw:
        return []
    vals = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        vals.append(float(part))
    return vals


def choose_recommended_threshold(compare_rows, min_precision=0.95):
    """
    Pick a practical operational threshold:
    1) Prefer rows meeting min precision, maximize recall, then f1.
    2) If none meet precision, maximize f1, then recall.
    """
    if not compare_rows:
        return None

    eligible = [r for r in compare_rows if float(r["precision"]) >= float(min_precision)]
    pool = eligible if eligible else compare_rows
    best = sorted(
        pool,
        key=lambda r: (
            float(r["recall"]),
            float(r["f1"]),
            -float(r["fp"]),
            float(r["threshold"]),
        ),
        reverse=True,
    )[0]
    reason = (
        f"max recall with precision >= {min_precision:.2f}"
        if eligible
        else "fallback: max recall/f1 (no row met min precision)"
    )
    return {"row": best, "reason": reason, "min_precision": min_precision}


def infer_weights_path(data_path: str) -> str:
    p = str(data_path).lower().replace("\\", "/")
    if "dog-noseprint" in p or "/dog/" in p:
        return DOG_SIAMESE_WEIGHTS
    if "cat-facial-recog" in p or "/cat/" in p:
        return CAT_SIAMESE_WEIGHTS
    return DEFAULT_SIAMESE_WEIGHTS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Dataset root (pet folders with train/val/test)")
    parser.add_argument("--split", choices=["train", "val", "test", "all"], default="val")
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--backbone", choices=["efficientnetv2b0", "mobilenetv3small"], default="efficientnetv2b0")
    parser.add_argument("--threshold", type=float, default=None)
    parser.add_argument("--thresholds", type=str, default=None, help="Comma-separated list, e.g. 0.90,0.85,0.80")
    parser.add_argument("--positive-repeat", type=int, default=1)
    parser.add_argument("--negative-ratio", type=float, default=1.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--run-id", type=str, default=None, help="Optional shared run id to link with training logs")
    parser.add_argument("--metrics-json", type=str, default=None, help="Optional path to *_metrics.json; run_id inferred from it")
    parser.add_argument("--weights", type=str, default=None, help="Path to species-specific weights to evaluate")
    parser.add_argument(
        "--min-precision",
        type=float,
        default=0.95,
        help="Minimum precision target for recommended threshold selection from --thresholds sweep",
    )
    parser.add_argument("--skip-journal-update", action="store_true", help="Skip automatic journal index refresh")
    args = parser.parse_args()

    weights_path = args.weights or infer_weights_path(args.data)
    species = _infer_species(args.data)
    if args.threshold is None:
        args.threshold = threshold_for(species)
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Weights not found: {weights_path}")

    if args.split in ("val", "test"):
        gallery_a, gallery_b, gallery_labels = generate_gallery_pairs(
            args.data,
            query_split=args.split,
            reference_split="train",
            negative_ratio=max(1, int(args.negative_ratio)),
        )
        pairs = []
        for image_a, image_b, label in zip(gallery_a, gallery_b, gallery_labels):
            pet_a = os.path.basename(os.path.dirname(os.path.dirname(image_a)))
            pet_b = os.path.basename(os.path.dirname(os.path.dirname(image_b)))
            pairs.append((pet_a, image_a, pet_b, image_b, int(label)))
    else:
        pets = collect_images(args.data, args.split)
        if len(pets) < 2:
            raise ValueError(f"Need at least 2 pets with 2+ images in split '{args.split}'. Found: {len(pets)}")
        pairs = build_pairs(
            pets,
            positive_repeat=args.positive_repeat,
            negative_ratio=args.negative_ratio,
            seed=args.seed,
        )
    if not pairs:
        raise ValueError("No pairs generated. Check dataset split and image counts.")

    evaluated_pets = {pet for pet_a, _, pet_b, _, _ in pairs for pet in (pet_a, pet_b)}
    evaluated_images = {
        image
        for _, image_a, _, image_b, _ in pairs
        for image in (image_a, image_b)
    }

    model = build_siamese()
    model.load_weights(weights_path)

    scored_pairs = _predict_scores(
        model=model,
        pairs=pairs,
        species=species,
        image_size=args.image_size,
        backbone_name=args.backbone,
    )
    rows, metrics = evaluate_pairs(scored_pairs=scored_pairs, threshold=args.threshold)
    misclassified, hardest, easiest = summarize_hard_cases(rows, take=25)

    os.makedirs(LOGS_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    species_token = _infer_species_token(args.data).replace("_training", "")
    linked_run_id = args.run_id
    if not linked_run_id and args.metrics_json:
        metrics_name = os.path.basename(args.metrics_json)
        if metrics_name.endswith("_metrics.json"):
            linked_run_id = metrics_name[: -len("_metrics.json")]
        elif metrics_name.endswith(".json"):
            linked_run_id = metrics_name[:-5]

    base = f"{linked_run_id}_pair_eval" if linked_run_id else f"{species_token}_pair_eval_{ts}"
    csv_path = os.path.join(LOGS_DIR, f"{base}.csv")
    json_path = os.path.join(LOGS_DIR, f"{base}.json")

    write_csv(csv_path, rows)

    payload = {
        "run_id": base,
        "timestamp": ts,
        "linked_training_run_id": linked_run_id,
        "weights_path": weights_path,
        "config": {
            "data": args.data,
            "split": args.split,
            "image_size": args.image_size,
            "backbone": args.backbone,
            "threshold": args.threshold,
            "positive_repeat": args.positive_repeat,
            "negative_ratio": args.negative_ratio,
            "seed": args.seed,
        },
        "dataset": {
            "pets": len(evaluated_pets),
            "images": len(evaluated_images),
            "pairs_generated": len(pairs),
        },
        "metrics": metrics,
        "analysis": {
            "misclassified_top25": misclassified,
            "hardest_pairs_top25": hardest,
            "easiest_pairs_top25": easiest,
            "notes": [
                "False positives are risky: model says same pet but actually different.",
                "False negatives hurt UX: model says different pet but actually same.",
                "Hardest pairs are closest to threshold and best for data cleanup review.",
            ],
        },
        "csv_path": csv_path,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Optional multi-threshold comparison from the same scored pairs.
    threshold_list = parse_thresholds(args.thresholds)
    if threshold_list:
        compare_rows = []
        for thr in threshold_list:
            _, m = evaluate_pairs(scored_pairs=scored_pairs, threshold=thr)
            compare_rows.append(
                {
                    "threshold": thr,
                    "pairs_total": m["pairs_total"],
                    "tp": m["tp"],
                    "tn": m["tn"],
                    "fp": m["fp"],
                    "fn": m["fn"],
                    "accuracy": m["accuracy"],
                    "precision": m["precision"],
                    "recall": m["recall"],
                    "f1": m["f1"],
                }
            )

        recommendation = choose_recommended_threshold(compare_rows, min_precision=args.min_precision)
        compare_csv = os.path.join(LOGS_DIR, f"{base}_thresholds.csv")
        compare_json = os.path.join(LOGS_DIR, f"{base}_thresholds.json")
        with open(compare_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "threshold",
                    "pairs_total",
                    "tp",
                    "tn",
                    "fp",
                    "fn",
                    "accuracy",
                    "precision",
                    "recall",
                    "f1",
                ],
            )
            writer.writeheader()
            writer.writerows(compare_rows)
        with open(compare_json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "run_id": f"{base}_thresholds",
                    "linked_pair_eval_run_id": base,
                    "threshold_metrics": compare_rows,
                    "recommended_threshold": recommendation,
                },
                f,
                indent=2,
            )
        print(f"Threshold CSV: {compare_csv}")
        print(f"Threshold JSON: {compare_json}")
        if recommendation:
            rec = recommendation["row"]
            print(
                "Recommended threshold: "
                f"{rec['threshold']} "
                f"(precision={rec['precision']:.4f}, recall={rec['recall']:.4f}, "
                f"f1={rec['f1']:.4f}, fp={rec['fp']}, fn={rec['fn']}) "
                f"[{recommendation['reason']}]"
            )

    if not args.skip_journal_update:
        update_journal()
        print("Journal auto-update: biometric-training.md refreshed from logs")

    print(f"Pairs evaluated: {len(pairs)}")
    print(
        f"Metrics: accuracy={metrics['accuracy']:.4f}, precision={metrics['precision']:.4f}, "
        f"recall={metrics['recall']:.4f}, f1={metrics['f1']:.4f}"
    )
    print(f"Pair CSV : {csv_path}")
    print(f"Summary  : {json_path}")


if __name__ == "__main__":
    main()
