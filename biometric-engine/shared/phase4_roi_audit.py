"""Analysis-only Phase 4 ROI and dataset-readiness audit.

This script never deletes, moves, rewrites, or re-labels source images. It
produces manifests, summaries, and contact sheets under ``biometric-engine/logs``.
"""

import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
THRESHOLDS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50]
ROI_PADDING = 0.15
MIN_ROI_SIDE = 16


def image_files(data_dir):
    return sorted(
        path for path in Path(data_dir).glob('*/*/*')
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def dhash(path):
    image = Image.open(path).convert('L').resize((9, 8))
    pixels = list(image.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | int(pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    return bits


def hamming(left, right):
    return (left ^ right).bit_count()


def padded_box(box, width, height):
    x1, y1, x2, y2 = box
    box_width = max(1.0, x2 - x1)
    box_height = max(1.0, y2 - y1)
    side = max(box_width, box_height) * (1.0 + ROI_PADDING * 2.0)
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    result = [
        max(0, int(cx - side / 2.0)),
        max(0, int(cy - side / 2.0)),
        min(width, int(cx + side / 2.0)),
        min(height, int(cy + side / 2.0)),
    ]
    return result


def classify_failure(record):
    if record.get('corrupt_image'):
        return 'CORRUPT_IMAGE'
    if record.get('box_count_at_lowest_threshold', 0) == 0:
        return 'NO_DETECTION'
    if record.get('highest_confidence', 0.0) < record['operational_threshold']:
        return 'LOW_CONFIDENCE'
    if record.get('roi_width', 0) < MIN_ROI_SIDE or record.get('roi_height', 0) < MIN_ROI_SIDE:
        return 'ROI_TOO_SMALL'
    if record.get('ambiguous_detections'):
        return 'MULTIPLE_AMBIGUOUS_DETECTIONS'
    return 'OTHER'


def run_species_audit(species, data_dir, detector_path, output_root):
    from ultralytics import YOLO

    detector = YOLO(str(detector_path))
    paths = image_files(data_dir)
    threshold = 0.25
    records = []

    # Low-confidence predictions are retained so the threshold sweep can be
    # computed without repeatedly changing detector settings.
    for path in paths:
        record = {
            'species': species,
            'pet_id': path.parent.parent.name,
            'split': path.parent.name,
            'filename': path.name,
            'path': str(path.resolve()),
            'operational_threshold': threshold,
            'image_width': None,
            'image_height': None,
            'box_count_at_lowest_threshold': 0,
            'box_count_at_operational_threshold': 0,
            'highest_confidence': None,
            'selected_confidence': None,
            'all_confidences': [],
            'selected_box': None,
            'roi_width': 0,
            'roi_height': 0,
            'ambiguous_detections': False,
            'failure_category': None,
            'corrupt_image': False,
        }
        try:
            with Image.open(path) as image:
                width, height = image.size
                image_array = np.asarray(image.convert('RGB'))
            record['image_width'], record['image_height'] = width, height
        except Exception as exc:
            record['corrupt_image'] = True
            record['failure_reason'] = str(exc)
            record['failure_category'] = 'CORRUPT_IMAGE'
            records.append(record)
            continue

        result = detector.predict(source=image_array, conf=0.01, verbose=False, device='cpu')[0]
        boxes = result.boxes
        confidences = [] if boxes is None else [float(value) for value in boxes.conf.tolist()]
        coordinates = [] if boxes is None else boxes.xyxy.tolist()
        record['box_count_at_lowest_threshold'] = len(confidences)
        record['all_confidences'] = sorted(confidences, reverse=True)
        record['highest_confidence'] = max(confidences, default=0.0)
        accepted = [index for index, confidence in enumerate(confidences) if confidence >= threshold]
        record['box_count_at_operational_threshold'] = len(accepted)
        record['ambiguous_detections'] = len(accepted) > 1
        if accepted:
            best = max(accepted, key=lambda index: confidences[index])
            selected = [float(value) for value in coordinates[best]]
            padded = padded_box(selected, width, height)
            record['selected_confidence'] = confidences[best]
            record['selected_box'] = [round(value, 2) for value in selected]
            record['padded_box'] = padded
            record['roi_width'] = max(0, padded[2] - padded[0])
            record['roi_height'] = max(0, padded[3] - padded[1])
            record['success'] = record['roi_width'] >= MIN_ROI_SIDE and record['roi_height'] >= MIN_ROI_SIDE
        else:
            record['success'] = False
        record['failure_category'] = None if record['success'] else classify_failure(record)
        record['failure_reason'] = None if record['success'] else record['failure_category']
        records.append(record)

    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path = output_root / f'{species}_roi_failure_manifest.json'
    manifest_path.write_text(json.dumps({
        'species': species,
        'detector': str(Path(detector_path).resolve()),
        'operational_threshold': threshold,
        'roi_padding': ROI_PADDING,
        'minimum_roi_side': MIN_ROI_SIDE,
        'records': [record for record in records if not record.get('success')],
    }, indent=2), encoding='utf-8')

    with (output_root / f'{species}_roi_audit_records.json').open('w', encoding='utf-8') as handle:
        json.dump(records, handle, indent=2)
    with (output_root / f'{species}_roi_failure_manifest.csv').open('w', newline='', encoding='utf-8') as handle:
        fields = ['species', 'pet_id', 'split', 'filename', 'failure_category', 'highest_confidence', 'selected_box', 'roi_width', 'roi_height', 'failure_reason']
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for record in records:
            if not record.get('success'):
                writer.writerow({field: record.get(field) for field in fields})

    by_split = defaultdict(list)
    by_pet = defaultdict(lambda: defaultdict(list))
    for record in records:
        by_split[record['split']].append(record)
        by_pet[record['pet_id']][record['split']].append(record)

    split_summary = {}
    for split, items in sorted(by_split.items()):
        split_summary[split] = {
            'total': len(items),
            'roi_valid': sum(item.get('success', False) for item in items),
            'roi_failed': sum(not item.get('success', False) for item in items),
            'failure_categories': dict(Counter(item['failure_category'] for item in items if not item.get('success'))),
            'successful_confidences': [item['selected_confidence'] for item in items if item.get('success')],
            'failed_highest_confidences': [item['highest_confidence'] for item in items if not item.get('success')],
        }
        split_summary[split]['threshold_sweep'] = {
            str(candidate): sum(
                any(confidence >= candidate for confidence in item.get('all_confidences', []))
                for item in items
            )
            for candidate in THRESHOLDS
        }

    per_pet = {}
    for pet, splits in sorted(by_pet.items()):
        per_pet[pet] = {}
        for split in ('train', 'val', 'test'):
            items = splits.get(split, [])
            per_pet[pet][split] = {
                'total': len(items),
                'roi_valid': sum(item.get('success', False) for item in items),
                'roi_failed': sum(not item.get('success', False) for item in items),
            }
        per_pet[pet]['insufficient_for_training'] = per_pet[pet]['train']['roi_valid'] < 2
        per_pet[pet]['insufficient_for_validation'] = per_pet[pet]['val']['roi_valid'] < 1 or per_pet[pet]['train']['roi_valid'] < 1
        per_pet[pet]['insufficient_for_test'] = per_pet[pet]['test']['roi_valid'] < 1

    summary = {
        'species': species,
        'detector': str(Path(detector_path).resolve()),
        'operational_threshold': threshold,
        'split_summary': split_summary,
        'per_pet': per_pet,
        'total_images': len(records),
        'roi_valid': sum(record.get('success', False) for record in records),
        'roi_failed': sum(not record.get('success', False) for record in records),
        'failure_categories': dict(Counter(record['failure_category'] for record in records if not record.get('success'))),
    }
    (output_root / f'{species}_phase4_roi_summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    return records, summary


def create_contact_sheets(records, output_root, species):
    font = ImageFont.load_default()
    for split in ('train', 'val', 'test'):
        items = [item for item in records if item['split'] == split]
        successes = [item for item in items if item.get('success')]
        failures = [item for item in items if not item.get('success')]
        selected = successes[:6] + failures[:6]
        if not selected:
            continue
        cells = []
        for item in selected:
            try:
                image = Image.open(item['path']).convert('RGB')
            except Exception:
                continue
            image.thumbnail((320, 240))
            canvas = Image.new('RGB', (340, 300), 'white')
            left = (340 - image.width) // 2
            canvas.paste(image, (left, 30))
            draw = ImageDraw.Draw(canvas)
            if item.get('selected_box'):
                scale_x, scale_y = image.width / item['image_width'], image.height / item['image_height']
                box = item['selected_box']
                draw.rectangle([left + box[0] * scale_x, 30 + box[1] * scale_y, left + box[2] * scale_x, 30 + box[3] * scale_y], outline='lime', width=3)
            title = f"{item['pet_id']} | {item['filename']}"
            status = 'OK' if item.get('success') else item.get('failure_category')
            confidence = item.get('selected_confidence') or item.get('highest_confidence') or 0.0
            draw.text((6, 6), title[:48], fill='black', font=font)
            draw.text((6, 275), f"{status} | conf={confidence:.3f}", fill='black', font=font)
            cells.append(canvas)
        sheet = Image.new('RGB', (340 * 3, 300 * math.ceil(len(cells) / 3)), '#dddddd')
        for index, cell in enumerate(cells):
            sheet.paste(cell, ((index % 3) * 340, (index // 3) * 300))
        output = output_root / 'phase4_contact_sheets'
        output.mkdir(exist_ok=True)
        sheet.save(output / f'{species}_{split}.jpg', quality=90)


def annotation_audit(species, annotation_root, output_root):
    dataset = Path(annotation_root) / f'{species}-yolo'
    report = {'species': species, 'splits': {}, 'classes': [], 'invalid_labels': []}
    yaml_path = dataset / 'data.yaml'
    if yaml_path.exists():
        for line in yaml_path.read_text(encoding='utf-8').splitlines():
            if '  0:' in line:
                report['classes'].append(line.split(':', 1)[1].strip())
    for split in ('train', 'val', 'test'):
        image_dir = dataset / split / 'images'
        label_dir = dataset / split / 'labels'
        images = sorted(path for path in image_dir.glob('*') if path.suffix.lower() in IMAGE_EXTENSIONS)
        missing = []
        invalid = []
        for image in images:
            label = label_dir / f'{image.stem}.txt'
            if not label.exists():
                missing.append(str(image))
                continue
            lines = [line.strip() for line in label.read_text(encoding='utf-8').splitlines() if line.strip()]
            for line in lines:
                parts = line.split()
                try:
                    values = [float(value) for value in parts]
                    if len(values) != 5 or values[0] != 0 or any(value < 0 or value > 1 for value in values[1:]):
                        invalid.append({'image': str(image), 'line': line})
                except ValueError:
                    invalid.append({'image': str(image), 'line': line})
        report['splits'][split] = {'images': len(images), 'missing_labels': missing, 'invalid_labels': invalid, 'labels': len(images) - len(missing)}
    (output_root / f'{species}_annotation_audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def integrity_audit(species, data_dir, records, output_root):
    by_hash = defaultdict(list)
    by_dhash = defaultdict(list)
    for record in records:
        path = Path(record['path'])
        try:
            by_hash[sha256(path)].append({'split': record['split'], 'path': record['path']})
            by_dhash[dhash(path)].append({'split': record['split'], 'path': record['path']})
        except Exception:
            pass
    exact = [items for items in by_hash.values() if len({item['split'] for item in items}) > 1]
    near = []
    hashes = [(key, item) for key, values in by_dhash.items() for item in values]
    for index, (left_hash, left) in enumerate(hashes):
        for right_hash, right in hashes[index + 1:]:
            if left['split'] != right['split'] and hamming(left_hash, right_hash) <= 6:
                near.append([left, right])
    report = {'species': species, 'exact_cross_split_duplicates': exact, 'near_cross_split_duplicates_dhash_le_6': near}
    (output_root / f'{species}_integrity_audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--species', required=True, choices=['dog', 'cat'])
    parser.add_argument('--data', required=True)
    parser.add_argument('--detector', required=True)
    parser.add_argument('--annotation-root', required=True)
    parser.add_argument('--output-root', default=None)
    args = parser.parse_args()
    output = Path(args.output_root) if args.output_root else Path(__file__).resolve().parents[1] / 'logs'
    records, summary = run_species_audit(args.species, args.data, args.detector, output)
    create_contact_sheets(records, output, args.species)
    annotation_audit(args.species, args.annotation_root, output)
    integrity_audit(args.species, args.data, records, output)
    print(json.dumps({'species': args.species, 'total': summary['total_images'], 'roi_valid': summary['roi_valid'], 'roi_failed': summary['roi_failed'], 'failure_categories': summary['failure_categories']}))


if __name__ == '__main__':
    main()
