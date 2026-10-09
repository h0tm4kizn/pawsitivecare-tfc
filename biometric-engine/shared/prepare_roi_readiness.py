"""Run the strict ROI preflight for train, validation, and test images."""

import argparse
import json
import os
from pathlib import Path

from roi_readiness import inspect_images, write_readiness_report


def image_paths(data_dir, split):
    root = Path(data_dir)
    return [
        str(path)
        for path in sorted(root.glob(f'*/{split}/*'))
        if path.is_file() and path.suffix.lower() in {'.jpg', '.jpeg', '.png'}
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--species', required=True, choices=['dog', 'cat'])
    args = parser.parse_args()

    for split in ('train', 'val', 'test'):
        paths = image_paths(args.data, split)
        ready, failures = inspect_images(paths, args.species)
        report_path = write_readiness_report(args.data, args.species, split, paths, ready, failures)
        report = json.loads(report_path.read_text(encoding='utf-8'))
        print(f"{split}: {report['roi_success']}/{report['total_images']} ROI-ready; "
              f"failed={report['roi_failed']}")


if __name__ == '__main__':
    main()
