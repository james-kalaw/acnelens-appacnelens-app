# AcneLens

**Installable web app (PWA) for teenagers' acne guidance.** It checks a close-up skin photo **on the phone itself**
(the photo is never uploaded), sorts it into **Clear Skin · Non-Inflammatory · Inflammatory**, asks four questions,
and suggests **ingredients — never brands** — using rules from the AAD 2024 acne guideline and the 2024
international expert consensus on dermocosmetics. A guidance tool, not a diagnosis.

**App link (after enabling GitHub Pages, guide 1):** https://james-kalaw.github.io/acnelens-appacnelens-app/

## Start here
1. [Publish the app](guides/01-publish-the-app.md) — one setting on GitHub, 2 minutes.
2. [Install on Android and iPhone](guides/02-install-on-phones.md) — works offline after the first launch.
3. [Update the validation badge](guides/03-update-the-validation-badge.md) — after the consult, edit one file, no coding.
4. [Run the dermatologist consult](guides/04-dermatologist-consult.md) — blind photo packet, rating sheet, automatic scoring.
5. [Paper updates](guides/05-paper-updates.md) — replacement text for Chapters 1–2 and the Technical Plan, plus results to report.

## Results so far (75 photos the AI never saw, run through the deployed app)
| | Old Teachable Machine model | **AcneLens model** |
|---|---|---|
| Overall accuracy | 81.3% | **93.3%** (95% CI 85.3–97.1%) |
| Inflammatory acne caught | 72% | **92%** (23 of 25) |
| Cohen's kappa | — | **0.90** |
| Real-world SCIN phone photos recognised as acne | — | **10 of 10** |

Dermatologist validation: pending (December consult).

## Repository map
| Folder | What's inside |
|---|---|
| `docs/` | The app (served by GitHub Pages). `docs/validation.json` = badge text. `docs/model/` = AI model + settings. |
| `training/` | Re-runnable data and model pipeline (steps 01–07), manual review decisions, and all result files. |
| `validation/` | Scoring spreadsheet, rating sheet, rules sheet, answer key, and kit builder. |
| `tests/` | `rules.test.mjs` (all 48 quiz combinations vs. Tables C1/C2) and `e2e.cjs` (full phone walk-through). |
| `brand/` | Logo files: app icon, light/dark logos (SVG + PNG) for slides and the paper cover. |
| `guides/` | Step-by-step instructions above. |

The previous Streamlit version is preserved unchanged on the **`v1-streamlit`** branch.

## Running locally (optional)
```
cd docs
python3 -m http.server 8000
```
Then open http://localhost:8000. To run the tests: `node tests/rules.test.mjs`.
