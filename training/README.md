# Training pipeline (re-runnable)

Everything that produced `docs/model/acnelens.onnx` is in this folder, in order.
The image datasets themselves are not stored in the repo (third-party licences); keep the raw zips you already have.

| Step | Script | What it does |
|---|---|---|
| 1 | `01_inventory.py` | Fingerprints every raw image (MD5, perceptual hash, size, sharpness) and groups near-duplicates. |
| — | `review_decisions.csv` | The manual review: 194 images dropped (each with a reason), 31 relabelled to Inflammatory, 28 full-face clear-skin photos marked for cropping. |
| 2 | `02_skin_patches.py` | Cuts skin-only patches (cheeks, forehead, chin) with MediaPipe Face Landmarker; fallback for close-ups with no detectable face. `ffhq_patch_keep.txt` lists the 32 patches kept after review. |
| 3 | `03_build_dataset.py` | Applies the decisions, groups look-alikes (pHash + Roboflow source + deep-feature similarity ≥ 0.93), and splits by group: train 681 / validation 147 / test 75 (25 per class). |
| 4 | `04_train.py` | Transfer learning: EfficientNetV2-B0 (ImageNet), head-only 8 epochs then top-layer fine-tuning 20 epochs; anti-shortcut augmentation; class weights; keeps the best validation epoch. |
| 5 | `05_export_evaluate.py` | Exports ONNX (max difference vs Keras 3e-7), fixes the Inflammatory lean at 1/3, picks the confidence threshold on validation (→ 50%), reports test results, writes `model_config.json`. |
| 6 | `06_baseline_old_model.py` | Scores the old Teachable Machine model (branch `v1-streamlit`) on the same test set. |
| 7 | `07_quality_thresholds.py` | Sets the photo-quality cut-offs (darkness, over-exposure, blur, skin coverage) so no curated image — including the darkest skin tones — is rejected. |

`scin_test_selection.tsv` lists the 10 SCIN real-world test photos (case IDs, image paths, crop).

## Results (`results/`)
- `app_pipeline_metrics.json`, `app_predictions_test.csv` — **official numbers**: the 75 test photos + 10 SCIN photos run through the deployed app code in a browser. Accuracy 93.3% (95% CI 85.3–97.1%), Cohen's kappa 0.90, Inflammatory 23/25.
- `python_eval_results.json`, `python_predictions_test.csv` — the same evaluation in Python, plus the validation-set threshold sweep. The browser and Python agree on 84 of 85 final results; the one difference sits exactly on the 1/3 line.
- `train_log.json` — per-epoch validation results. `dataset_manifest.csv` — every curated image, its split, group and origin.

## Re-running
```
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r training/requirements.txt
python training/01_inventory.py RAW_DIR inventory.csv
# ... steps 2–7 as described in each script's header
```
On a laptop CPU the full training takes about 30 minutes. Results will be very close but not bit-identical (floating-point and thread scheduling).
