# PawsitiveCare Biometric Engine

Species-adaptive pet identification with two FastAPI services:

- Dogs: noseprint recognition on port 8000
- Cats: facial recognition on port 8001

## Current Runtime

Each service classifies the species with ImageNet EfficientNetV2B0 before matching.
When its species-specific Siamese weights are available, registration and scanning
use the trained 128D projection. Without weights, both operations use the 1280D
ImageNet feature vector as a fallback.

The database and running model must use the same embedding dimension. The API
returns an explicit error when they do not match.

ROI detection is the default runtime mode. The startup script uses the trained
YOLO detector before embedding extraction. If ROI mode misses a region, the API falls back to the full frame and
reports that fallback in `preprocessing`. Rebuild both databases after changing
this mode so enrollment and scan embeddings use the same preprocessing.

The branch still does not include image-quality gating, liveness detection, or a
production-calibrated threshold.

## Setup

```powershell
cd path/to/pawsitivecare/biometric-engine
py -3.12 -m venv .venv312
.venv312\Scripts\activate
pip install -r requirements.txt
```

The current metric-learning weights are stored in `shared/`:

```text
shared/siamese_weights_dog_metric.weights.h5
shared/siamese_weights_cat_metric.weights.h5
```

ROI weights are expected at:

```text
roi-annotation/work/runs/dog_nose/weights/best.pt
roi-annotation/work/runs/cat_face/weights/best.pt
```

The normal startup command enables ROI mode automatically. To run the controlled
full-frame comparison, use:

```powershell
$env:ROI_ENABLED = "0"
```

Use `.\start-all.ps1 -DisableRoi` to preserve the full-frame baseline. The ROI and
full-frame database galleries must match the preprocessing mode used by the API.

The services select the species-specific metric file automatically. The current
operational thresholds are dog `0.55` and cat `0.45`, calibrated from the
validation results. If the files are missing, the fallback is 1280D cosine
matching.

## Build Databases

The seed scripts read registration images from each pet's `train/` folder in
`dataset/` by default and add augmented reference views. They reset the local table, so do
not run them against a database containing irreplaceable production registrations.

Run both commands from this directory after installing weights or changing the
embedding mode:

```powershell
cd dog-noseprint\src
python create_database.py
cd ..\..
cd cat-facial-recog\src
python create_database.py
cd ..\..
```

Rebuild both databases after changing weights. Existing 1280D records cannot be
used by the 128D Siamese runtime.

## Start Services

```powershell
cd dog-noseprint\src
python main.py
```

```powershell
cd cat-facial-recog\src
python main.py
```

Health checks:

```powershell
curl http://127.0.0.1:8000
curl http://127.0.0.1:8001
```

Open `ui.html` in a browser for the standalone demo.

## API

Register with `file` and `name`:

```powershell
curl.exe -X POST http://127.0.0.1:8000/reg `
  -F "file=@dog-noseprint/dataset/dog1/train/image1 (orig).jpg" `
  -F "name=Buddy"
```

Scan with `file`:

```powershell
curl.exe -X POST http://127.0.0.1:8000/scanning `
  -F "file=@dog-noseprint/dataset/dog1/test/image1.5 (dark zoom).jpg"
```

Use port 8001 and the cat paths for cat recognition. Responses include the mode,
best candidate, high-scoring candidates, preprocessing mode, and the threshold used
by the service. Rebuild both databases after changing `ROI_ENABLED`, because
enrollment embeddings must use the same preprocessing as scan images.
The current cosine threshold is 0.90, but it is not production-calibrated yet.

## Testing

Start both services, rebuild the databases, then run:

```powershell
python real_test.py
```

The test reports identification rate (exact top identity) and threshold rate
(exact top identity plus the API threshold). It does not prove production
accuracy; independent photos from each pet are required for that.

For a single scan using the formal dataset:

```powershell
.\test_scan.ps1 "dog-noseprint/dataset/dog1/test/image1.5 (dark zoom).jpg"
```

## Siamese Training Evidence

The latest Siamese training and pair-evaluation CSV files are preserved under
`logs/run011-run012/`:

```text
logs/run011-run012/dog_training_20260514_155427_metrics.csv
logs/run011-run012/dog_training_20260514_155427_pair_eval.csv
logs/run011-run012/dog_training_20260514_155427_pair_eval_thresholds.csv
logs/run011-run012/cat_training_20260514_201406_metrics.csv
logs/run011-run012/cat_training_20260514_201406_pair_eval.csv
logs/run011-run012/cat_training_20260514_201406_pair_eval_thresholds.csv
```

The `*_metrics.csv` files contain epoch-by-epoch training and validation history.
The pair-evaluation files contain genuine and different-pet comparisons, including
threshold, score, and outcome. These records should be used as the primary Siamese
training evidence in the capstone documentation.

## Structure

```text
biometric-engine/
  shared/                    Model, training, augmentation, and DB helpers
  dog-noseprint/src/         Dog API and database seed script
  cat-facial-recog/src/      Cat API and database seed script
  dog-noseprint/dataset/     Formal 50-dog dataset with train/val/test splits
  cat-facial-recog/dataset/  Formal 50-cat dataset with train/val/test splits
  */test_data/               Legacy smoke-test samples; not final evaluation data
  real_test.py               API-level evaluator
  ui.html                    Standalone demo UI
```

## Limitations

The pet image datasets used for training and evaluation are not included in
this public repository due to privacy, data-usage, and redistribution
considerations. The repository retains the implementation and evaluation
code necessary to document the biometric identification pipeline.

- The bundled test set is small and includes augmented views, not many independent
  captures per animal.
- Thresholds are not calibrated against a representative negative gallery.
- SQLite and absolute image paths are local-development storage.
- The system is not a liveness or anti-spoofing system.
- Human confirmation is recommended for identity-sensitive workflows.
