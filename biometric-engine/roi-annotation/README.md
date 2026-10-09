# ROI Annotation Protocol

This folder documents the training data preparation for the dog-nose and cat-face
ROI detectors. The source dataset contains 50 original dog images and 50 original
cat images, plus generated variants.

## Annotation Tool

Use an object-detection annotation tool that can export YOLO format. CVAT,
Label Studio, and Roboflow are suitable options. Export one class per model:

- Dog project: `dog_nose`
- Cat project: `cat_face`

Keep the dog and cat projects separate. Do not mix class IDs between projects.

## What To Draw

Annotate the 100 original images first:

- Dog: one tight box around the visible nose leather. Include the full nose surface,
  but not the muzzle, mouth, eyes, or background.
- Cat: one box around the complete visible face, including both eyes and the muzzle.
  Do not include the body or unrelated background.

Use one box per image. If the target is not visible or is too obstructed to label
reliably, record the filename and reason in the annotation log instead of guessing.

## Data Split

Split before training and keep transformed copies of an image in the same split as
their original. Do not place an original in training and its zoom/dark/bright copy
in validation or test.

Recommended split:

- Training: 70%
- Validation: 15%
- Test: 15%

Use pet identity and capture session when making the split. The final test set must
contain photos that were not used to create training augmentations.

## YOLO Export

Each image needs a label file with the same base name:

```text
image01.jpg
image01.txt
```

Each label line is:

```text
class_id center_x center_y width height
```

All coordinates are normalized from 0 to 1. For each separate model, the only
valid class ID is `0`.

## Quality Review

Before training, review every label for:

- Correct class and matching filename
- Exactly one box per usable image
- Box tightly covering the biometric region
- Coordinates between 0 and 1
- No train/validation/test leakage from transformed copies

Record skipped images and corrections in `annotation-log.csv` when annotation work
starts. Do not silently delete difficult examples.

## Required Evidence

Record the following in `RESULTS.md`:

- Annotation tool and export version
- Number of original and generated images
- Number of labeled, skipped, and corrected images
- Split counts for each species
- Detector architecture, image size, epochs, and confidence threshold
- Precision, recall, mAP50, and mAP50-95 on the untouched test set
- Examples of false positives, false negatives, and missed detections
- Model file name, file size, and checksum
- Date and exact command used for training and evaluation

Do not report recognition accuracy as ROI detection accuracy. Evaluate ROI detection
first, then evaluate the complete pet-identification pipeline separately.
