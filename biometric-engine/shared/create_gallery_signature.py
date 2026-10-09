"""Create an explicit immutable gallery signature after gallery regeneration.

This command does not create or modify a gallery. It is intentionally separate
from service startup so a stale gallery cannot be silently re-certified.
"""

import argparse
import json
from pathlib import Path

from artifact_validation import artifact_paths, expected_signature, gallery_signature_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--species', required=True, choices=['dog', 'cat'])
    parser.add_argument('--db', required=True, type=Path)
    args = parser.parse_args()

    shared_dir = Path(__file__).resolve().parent
    model_path, detector_path = artifact_paths(args.species, shared_dir)
    if not model_path.exists() or not detector_path.exists():
        raise SystemExit('Required model and detector artifacts must exist before signing a gallery.')

    signature_path = gallery_signature_path(args.db)
    signature_path.write_text(
        json.dumps(expected_signature(args.species, model_path, detector_path), indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'Wrote gallery signature: {signature_path}')


if __name__ == '__main__':
    main()
