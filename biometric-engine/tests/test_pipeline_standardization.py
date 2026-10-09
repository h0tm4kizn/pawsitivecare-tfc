import sqlite3
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np

SHARED = Path(__file__).resolve().parents[1] / 'shared'
sys.path.insert(0, str(SHARED))

from biometric_config import EMBEDDING_DIM, INPUT_SIZE, PROVISIONAL_THRESHOLDS  # noqa: E402
from identity_preprocessing import model_input_from_identity, resize_identity_image  # noqa: E402
from artifact_validation import expected_signature  # noqa: E402


class PipelineStandardizationTests(unittest.TestCase):
    def test_identity_resize_is_224_square(self):
        image = np.zeros((91, 137, 3), dtype=np.uint8)
        resized = resize_identity_image(image)
        self.assertEqual(resized.shape, (INPUT_SIZE[1], INPUT_SIZE[0], 3))

    def test_model_input_is_224_square_and_rgb(self):
        image = np.zeros((40, 80, 3), dtype=np.uint8)
        result = model_input_from_identity(image, lambda value: value)
        self.assertEqual(result.shape, (1, 224, 224, 3))

    def test_production_thresholds_are_species_specific(self):
        self.assertEqual(PROVISIONAL_THRESHOLDS, {'dog': 0.50, 'cat': 0.55})

    def test_signature_contains_model_and_detector_hashes(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            model = root / 'model.h5'
            detector = root / 'best.pt'
            model.write_bytes(b'model')
            detector.write_bytes(b'detector')
            signature = expected_signature('dog', model, detector)
            self.assertEqual(signature['embedding_dim'], EMBEDDING_DIM)
            self.assertEqual(len(signature['model_sha256']), 64)
            self.assertEqual(len(signature['detector_sha256']), 64)

    def test_existing_galleries_are_128d(self):
        for species in ('dog', 'cat'):
            database = Path(__file__).resolve().parents[1] / (
                'dog-noseprint' if species == 'dog' else 'cat-facial-recog'
            )
            db_path = database / 'src' / 'Database' / f'{species}.db'
            if not db_path.exists():
                continue
            with sqlite3.connect(db_path) as connection:
                blob = connection.execute('SELECT value FROM pets LIMIT 1').fetchone()[0]
            self.assertEqual(len(blob) // 4, EMBEDDING_DIM)


if __name__ == '__main__':
    unittest.main()
