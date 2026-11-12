# 3 · Update the validation badge after the consult (no coding)

The badge in the results screen ("Dermatologist review in progress") reads the file `docs/validation.json`.
After the dermatologist's ratings are scored, change that one file on GitHub's website.

1. Fill in `validation/AcneLens_Scoring.xlsx` (guide 4). Open sheet **2 Results**.
2. Copy the yellow cell **A36**. It looks like:
   `"status": "validated", "doctor_match_rate": 92.9, "verified_agreement_score": 0.89, "images_reviewed": 85,`
3. On GitHub open **docs/validation.json** → click the **pencil** (Edit).
4. Replace these four lines with the copied text (keep everything else):
   ```
   "status": "pending",
   "doctor_match_rate": null,
   "verified_agreement_score": null,
   "images_reviewed": null,
   ```
5. Fill in the two text lines, keeping the quotes, for example:
   ```
   "reviewer": "1 licensed dermatologist (PRC-licensed), Cabanatuan City",
   "date": "December 2026",
   ```
6. Click **Commit changes**. Within a minute the app shows **"Checked against a dermatologist's assessments"** with the numbers.

Rules: text goes inside quotes, numbers do not; every line except the last one inside `{ }` ends with a comma.
If the app still shows the old badge, close and reopen it once (it fetches the file fresh when online).

The `technical_test` block holds the pre-consult numbers (93.3% on 75 unseen photos, 23 of 25
inflammatory caught, kappa 0.90). Leave it as is unless the model is retrained.
