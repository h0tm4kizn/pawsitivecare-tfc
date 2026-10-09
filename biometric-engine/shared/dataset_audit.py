"""Dataset integrity checks used before any biometric training run."""

import hashlib
import json
from pathlib import Path


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def find_cross_split_duplicates(data_dir):
    """Return exact-content duplicates occurring in different dataset splits."""
    by_hash = {}
    root = Path(data_dir)
    for path in root.glob('*/*/*'):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        split = path.parent.name.lower()
        if split not in {'train', 'val', 'test'}:
            continue
        by_hash.setdefault(_sha256(path), []).append({
            'path': str(path),
            'split': split,
        })
    return [items for items in by_hash.values() if len({item['split'] for item in items}) > 1]


def write_dataset_audit(data_dir, species):
    duplicates = find_cross_split_duplicates(data_dir)
    report = {
        'species': species,
        'data_dir': str(Path(data_dir).resolve()),
        'cross_split_exact_duplicates': duplicates,
        'duplicate_group_count': len(duplicates),
        'status': 'FAIL' if duplicates else 'PASS',
    }
    output = Path(__file__).resolve().parents[1] / 'logs' / f'{species}_dataset_audit.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return report
