# 4 · Running the dermatologist consult

This follows the six-step **Dermatologist Validation Protocol** in the technical plan (Section 4.2).

## What to bring
| File | Use | Show the dermatologist? |
|---|---|---|
| `AcneLens_Blind_Photo_Packet.pdf` (85 photos, IDs AL-001…AL-085) | Print in **colour**, or show on a tablet at full brightness | **Yes** |
| `AcneLens_Blind_Rating_Sheet.pdf` (pages 1–3 + Validation Certificate) | The doctor ticks one category per photo, then signs the certificate | **Yes** |
| `AcneLens_Recommendation_Rules.pdf` | Every rule and ingredient with its citation, for judging appropriateness | Yes — **after** the blind rating |
| A phone with AcneLens installed | Live demo for the Likert evaluation form | Yes — **after** the blind rating |
| `photos/` folder | Same photos as image files (e.g., to zoom on a laptop) | Yes |
| `answer_key.csv`, `AcneLens_Scoring.xlsx` | Your copies — the AI's answers are in here | **No** (keep hidden until the rating is done) |

The photo packet and `photos/` folder are delivered as a zip (not stored in the public GitHub repo,
because the photos come from third-party datasets). Everything else is in the `validation/` folder.

## Steps (matches the paper)
1. **Recruit / verify.** Record the dermatologist's name, clinic/hospital affiliation and PRC licence number.
2. **Blind packet.** Give only the photo packet + rating sheet. Do not open the app or the scoring file in front of the doctor.
3. **Independent classification.** Read the labelling rule aloud (it is also printed on the sheet):
   *Inflammatory if ANY papule, pustule, nodule or cyst is visible; Non-Inflammatory if only blackheads/whiteheads; Clear Skin if no acne lesion is visible; "Cannot tell" only if a photo is not gradable.* Expect 30–45 minutes.
4. **Comparison.** Afterwards, type each ticked label into `AcneLens_Scoring.xlsx`, sheet **1 Ratings**, column B (drop-down).
5. **Calculation.** Sheet **2 Results** fills in automatically: Doctor Match Rate (with 95% CI), Verified Agreement Score (Cohen's kappa) and its interpretation, the confusion matrix, per-class results, and the safety count (inflammatory photos the AI called milder). Sheet **3 Threshold (4.1a)** fills the Section 4.1a table using the doctor's labels.
6. **Sign-off.** Write the two numbers on the Validation Certificate (last page of the rating sheet); the dermatologist signs.

Then do the **Expert Evaluation Form** (Likert, Chapter 2) with the live app and the rules PDF, and
finally update the in-app badge (guide 3).

## Showing consistency (Research Question 2.3)
- The recommendation rules are deterministic: the same answers always give the same routine. The automated test `tests/rules.test.mjs` checks all 48 combinations against Tables C1/C2.
- To show it live: analyse the same photo twice with the same answers — the result and routine are identical.

## What the 85 photos are
- **75** curated photos the AI never saw during training or tuning (25 per category by dataset label), chosen so that no near-duplicate of a training photo is included.
- **10** real-world smartphone photos of facial acne from the SCIN dataset (10 different people, Fitzpatrick skin types I–V), never used for training.
- Photos are shuffled with a fixed random seed; the answer key maps each ID to its source.
