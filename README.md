# AcneLens

Installable web app (PWA) that checks a close-up skin photo **on the phone**, sorts it into
**Clear Skin / Non-Inflammatory / Inflammatory**, asks four questions, and suggests
**ingredients (never brands)** using rules from the AAD 2024 acne guideline and the 2024
international expert consensus on dermocosmetics. A guidance tool, not a diagnosis.

| Folder | What's inside |
|---|---|
| `docs/` | The app itself (served by GitHub Pages). `docs/validation.json` holds the validation badge text. |
| `training/` | The full, re-runnable data + model pipeline (steps 01–07) and the result files. |
| `tests/` | Rule-engine test (all 48 quiz combinations) and an end-to-end phone walk-through. |
| `brand/` | Logo files (SVG + PNG) for the app, slides and paper. |

The previous Streamlit version is kept unchanged on the `v1-streamlit` branch.
