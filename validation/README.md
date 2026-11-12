# Validation kit

| File | What it is |
|---|---|
| `AcneLens_Scoring.xlsx` | Type the dermatologist's labels → all metrics, Section 4.1a table, and the text for `docs/validation.json`. Formulas were checked against an independent Python calculation. |
| `AcneLens_Blind_Rating_Sheet.pdf` | Printable rating sheet + Validation Certificate. |
| `AcneLens_Recommendation_Rules.pdf` | All rules (Tables C1/C2 + advisories) with ingredients and citations, for the appropriateness review. |
| `answer_key.csv` | ID → source, dataset label, app result and probabilities. **Do not show to the dermatologist.** |
| `make_kit.py` | Rebuilds everything above (plus the photo packet) from the test set. |

**Photo packet** (`AcneLens_Blind_Photo_Packet.pdf` and `photos/AL-001…AL-085.jpg`): delivered
separately as a zip, not committed, because the photos belong to third-party datasets.
Rebuild with `python validation/make_kit.py <test_dir> <scin_dir> training/results/app_predictions_test.csv <out_dir>`.

How to run the consult: see `guides/04-dermatologist-consult.md`.
