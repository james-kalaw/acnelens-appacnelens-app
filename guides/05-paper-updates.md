# 5 · Paper updates (ready to paste)

The rebuilt app no longer uses Google Teachable Machine, Streamlit or iStock images. The paper must describe
what was actually done, or the methodology would not match the software. Below are replacement texts in the same
academic voice as Chapters 1–2 and the Technical Plan. Section F lists the numbers you can already report.

---

## A. Chapter 1

### Operational Definition of Terms — replace these entries

**Artificial Intelligence (AI)** – The image-classification model built into the AcneLens application. It runs on the user's own phone and sorts a close-up photograph of one skin area into Clear Skin, Non-Inflammatory Acne, or Inflammatory Acne.

**Transfer Learning** – The machine-learning technique used to develop the AcneLens model. A convolutional neural network previously trained on the ImageNet image collection (EfficientNetV2-B0) is re-used, and its final layers are re-trained on curated acne images using Python and TensorFlow/Keras.

**Validation Dataset** – A separate set of facial skin photographs that were never used to train the AI model, used to measure its accuracy: 75 held-out curated images and 10 real-world smartphone photographs.

### Operational Definition of Terms — add these entries

**Progressive Web Application (PWA)** – A web application that can be installed on Android and iOS phones directly from the browser, opens like a regular mobile application, and keeps working without an internet connection.

**Confidence Threshold** – The minimum probability (50%) that the AI's answer must reach before a result is shown. Below it, the application asks the user to retake the photograph instead of guessing.

### Scope and Delimitations — add after the first paragraph

The AI model was trained on publicly available acne images compiled from the Acne Dataset Image collection (Tiswan, Universitas Perjuangan Tasikmalaya) and the ACNE04 dataset (Wu et al., 2019), together with clear-skin patches cropped from the Flickr-Faces-HQ dataset (Karras et al., 2019). Because these images were captured with different cameras and lighting conditions than users' phones, the accuracy obtained on real-world photographs may differ from the reported test results. The application analyses a close-up of one skin area per check rather than a full-face photograph.

> **Fix:** the Scope says the study is conducted in **Zaragoza**, while the Research Locale says **Cabanatuan City**. Use one place consistently.

---

## B. Chapter 2

### Table 1. Development Materials and Components (replace rows 1–3, add row 4)

| Development Materials | Description |
|---|---|
| 1. Acne Dataset Image (Tiswan) | Public dataset of blackheads, whiteheads, papules, pustules, nodules and cysts, grouped into Non-Inflammatory and Inflammatory acne for training. |
| 2. ACNE04 Dataset | Public, dermatologist-annotated facial acne images (Wu et al., 2019), added to the curated training pool. |
| 3. Flickr-Faces-HQ (FFHQ) — Kaggle mirror "FFHQ small" | Public face photographs from which skin-only clear-skin patches were cropped (eyes, nose and lips excluded). Replaces the earlier stock-photo subset. |
| 4. Skin Condition Image Network (SCIN) | Real-world smartphone photographs labelled by dermatologists (Google Research, 2024). Ten facial-acne photographs were used **only for testing**, never for training. |

### Table 2. Software and Development Tools (replace the whole table)

| Software and Development Tools | Description |
|---|---|
| 1. Python | Used to clean and organise the image datasets, train the AI model, and compute the evaluation results. |
| 2. TensorFlow / Keras | Used for transfer learning: the EfficientNetV2-B0 network pre-trained on ImageNet was re-trained to classify facial acne images. |
| 3. MediaPipe Face Landmarker | Used to locate facial features so that skin-only patches (cheeks, forehead, chin) could be cropped automatically. |
| 4. ONNX Runtime Web | Runs the trained AI model inside the phone's web browser, so photographs never leave the device. |
| 5. HTML, CSS and JavaScript | Used to build the installable web application (PWA): screens, quiz, rule-based recommendations, and journal. |
| 6. GitHub and GitHub Pages | Used for version control and to publish the web application online at no cost. |

> **Fix:** "Phyton" → "Python".

### Figure 1. Conceptual Framework — change the circle texts

- **Development:** Train AI model (transfer learning in Python/TensorFlow) · Develop rule-based recommendation system · Build local journal database · Integrate system components · Develop installable web application.
- **Implementation:** Deploy via GitHub Pages · Install on Android and iOS phones · Prepare for evaluation.

### Paragraph explaining Figure 1 (page 23) — replace the Development and Implementation sentences

In the Development phase, the researchers curate the image datasets, train the transfer learning model using Python and TensorFlow, develop the rule-based recommendation system, build the on-device journal, and integrate the components into an installable, mobile-responsive web application. The Implementation phase follows with the deployment of the application on GitHub Pages, where it can be installed on Android and iOS phones, along with the preparation for the evaluation.

### Data Analysis — add before the Likert-scale paragraph

The classification accuracy of AcneLens will be measured with a confusion matrix computed on photographs that were never used for training. Overall accuracy, per-category sensitivity and precision, and Cohen's kappa will be reported. During the consultation, a licensed dermatologist will independently classify the same photographs without seeing the application's results. Agreement between the dermatologist and the application will be reported as the Doctor Match Rate (raw agreement) and the Verified Agreement Score (Cohen's kappa).

> **Note for the panel:** Slovin's formula is designed for large populations. With only a few dermatologists in the locale, state instead that **purposive sampling** of the available licensed dermatologist(s) was used.

---

## C. Technical Plan — Phase 1 (replace "The Approach" and "The Data Source")

**The Approach.** The application uses transfer learning to classify a close-up photograph of one facial skin area into three categories: Clear Skin, Non-Inflammatory, and Inflammatory. The classifier is EfficientNetV2-B0, pre-trained on ImageNet and re-trained in Python with TensorFlow/Keras. The trained model is exported to the ONNX format and runs inside the phone's browser using ONNX Runtime Web, so photographs are never uploaded. A brief self-report question after the photo lets the user identify the specific lesion type (e.g., blackheads, papules) without requiring the model to distinguish between them.

**Data curation.** The researchers compiled 1,136 public images from the Acne Dataset Image collection, ACNE04, and FFHQ. The curation followed these steps:
1. Near-duplicates (re-saved, resized, rotated or cropped copies of the same photograph) were grouped using perceptual hashing, the original Roboflow source filename, and deep-feature similarity. This left 1,024 distinct photographs.
2. Every photograph was reviewed. The researchers removed watermarked or stock images, collages, illustrations, non-facial or non-acne photographs, pixelated images, and photographs whose category was ambiguous (194 removals).
3. Each photograph was labelled with the study's rule: if any inflammatory lesion (papule, pustule, nodule or cyst) is visible, the photograph is Inflammatory. Under this rule, 31 photographs filed as blackheads or whiteheads were relabelled as Inflammatory.
4. Clear-skin photographs showing eyes, nose or lips were automatically cropped into skin-only patches.

The final curated set has **903 photographs** (Clear Skin 163, Non-Inflammatory 241, Inflammatory 499). It was split by look-alike group, so that no copy of a photograph can appear in two splits:
- **Training:** 681 photographs.
- **Validation:** 147 photographs, used to choose settings.
- **Test:** 75 photographs, 25 per category, used only once for the final results.

In addition, **10 real-world smartphone photographs** of facial acne from SCIN (10 different people, Fitzpatrick skin types I–V) form a real-world test subset.

**Training.** Training ran in two stages:
1. Only the new classification layer was trained, for 8 epochs.
2. The top layers of the network were fine-tuned for 20 epochs. The epoch with the best validation balanced accuracy was kept.

Class weights compensated for the unequal number of photographs per category. To stop the model from learning camera or resolution differences instead of the skin itself, every training photograph was randomly cropped, rotated, flipped, down-scaled, blurred, JPEG-compressed and colour-shifted.

**Decision rule.** Mistaking inflammatory acne for a milder category is the less safe error. It would give a gentler routine and no referral advice. Therefore:
- The application reports **Inflammatory whenever the model gives it a probability of at least one in three**. This threshold was fixed in advance by judging a missed inflammatory case to be twice as harmful as an unnecessary referral.
- For any other result, the top category is shown only if its probability is at least **50%**. This confidence threshold was selected on the validation set (Section 4.1a); otherwise the user is asked to retake the photo.
- Before classification, a **photo-quality check** rejects photographs that are too dark, over-exposed, completely blurred, or not mostly skin.

**Stated limitation.** The training and test photographs are public images, not photographs taken with users' phones. Performance on real-world photographs may therefore be lower than on the curated test set. The 10-photo SCIN subset gives a first indication of real-world performance.

## D. Technical Plan — Phase 3 (replace "The Approach")

AcneLens is built as an installable web application (Progressive Web Application) using HTML, CSS and JavaScript, and is published at no cost on GitHub Pages. Users install it on Android (Chrome: Install app) or iOS (Safari: Add to Home Screen). After the first launch, the application, including the AI model, works offline.

*Justification:* on-device processing keeps the "Privacy First" promise, because photographs never leave the phone. Installation gives a native-app experience on both Android and iOS without app-store fees.

**User interface flow** — add a **Frame** step after Home: the user drags and pinches so that only skin fills a square frame. The photo-quality check runs live on that square.

**Journal** — entries are stored only on the device (the browser's IndexedDB storage). The user can export them as `AcneLens_Journey_Log.csv` or delete them at any time.

## E. Technical Plan — Phase 2 notes (add)

- **Modifier precedence:** M-01 is applied first and M-02 last. When a user is both Highly Sensitive and already using strong actives, no new active is suggested. Azelaic acid would still be an additional active on top of the current treatment.
- **Referral advisories (display only):** A-01 appears for an Inflammatory result. A-02 appears when the user self-reports cysts or nodules, because severe and nodular acne is treated with prescription options (AAD 2024). Advisories never change the recommended ingredients.
- **Question 1** adds a "None of these / not sure" option, for users whose result is Clear Skin.
- **Table D** — Skin_State values: Oily, Dry, Combination, **Normal**. Routine_Followed adds "First check" for the first entry.

---

## F. Results you can already report (Chapter 4 draft)

**4.1 Confusion matrix — 75 held-out test photographs, run through the deployed application**

| True \ AcneLens | Clear Skin | Non-Inflammatory | Inflammatory | Total |
|---|---|---|---|---|
| Clear Skin | **25** | 0 | 0 | 25 |
| Non-Inflammatory | 0 | **22** | 3 | 25 |
| Inflammatory | 0 | 2 | **23** | 25 |

**Overall results**
- Overall accuracy: **93.3%** (95% CI 85.3–97.1%).
- Cohen's kappa: **0.90**, almost perfect agreement.

**Per category**

| Category | Sensitivity | Precision |
|---|---|---|
| Clear Skin | 100% | 100% |
| Non-Inflammatory | 88% | 91.7% |
| Inflammatory | 92% | 88.5% |

**Direction of errors**
- 3 Non-Inflammatory photographs were reported as Inflammatory. This is the safe direction: they receive a referral notice.
- 2 Inflammatory photographs were reported as Non-Inflammatory.

**Real-world SCIN subset (10 photographs, all dermatologist-labelled acne)**
- All 10 were recognised as acne: 9 as Inflammatory, 1 as Non-Inflammatory, none as Clear Skin.
- None were rejected by the confidence threshold.

**Comparison with the earlier model.** The earlier Teachable Machine model was scored on the same 75 photographs:

| Model | Accuracy | Inflammatory recall |
|---|---|---|
| Earlier Teachable Machine model | 81.3% | 72% |
| AcneLens model | 93.3% | 92% |

Some of these test photographs may have been part of the earlier model's training data, which would favour the earlier model.

**4.1a Confidence threshold (filled template)**

| Candidate Threshold | Missed Errors (validation, n=147) | Unnecessary Rejections (validation) | Missed Errors (test, n=75) | Unnecessary Rejections (test) |
|---|---|---|---|---|
| 50% (adopted) | 1 | 1 | 5 | 0 |
| 60% | 1 | 2 | 5 | 0 |
| 70% | 1 | 5 | 4 | 3 |
| 80% | 1 | 5 | 3 | 6 |
| 90% | 1 | 21 | 3 | 18 |

The threshold was **selected on the validation set** — not on the test set — so that the test results remain unbiased. 50% gives the fewest missed errors there, with the fewest unnecessary rejections. On the test set, 3 of the "missed errors" at every threshold are Non-Inflammatory photographs reported as Inflammatory. By design, the confidence threshold never hides an Inflammatory result.

The validation-set numbers come from the Python evaluation (`training/results/python_eval_results.json`). The test-set numbers come from the deployed app pipeline (`training/results/app_predictions_test.csv`).

**4.2 Dermatologist validation:** fill in with `validation/AcneLens_Scoring.xlsx` after the consult.

---

## G. Other inconsistencies to fix before the defense

1. **Locale:** Zaragoza (Scope) vs. Cabanatuan City (Research Locale).
2. **Usability survey:** the Technical Plan's SUS survey with 15–30 teenage testers conflicts with Chapter 2's ethics section ("no testing … on the target audience"). Either remove the SUS or add the teenage testers, with parental consent, to the ethics section.
3. **Table 5:** the last range reads "1.00–2.80"; it should be **1.00–1.80**.
4. **Kappa interpretation table:** reorder as < 0.20 Slight, 0.21–0.40 Fair, 0.41–0.60 Moderate, 0.61–0.80 Substantial, 0.81–1.00 Almost perfect.
5. **Question 1:** use "Nodules" (plural), consistent with the other options.
6. **Table 1 logos:** remove the Kaggle "k" logo shown for ACNE04 and the iStock logo. iStock is no longer used.

## References to add

- Karras, T., Laine, S., & Aila, T. (2019). A style-based generator architecture for generative adversarial networks. *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, 4401–4410. (FFHQ dataset)
- Tan, M., & Le, Q. (2021). EfficientNetV2: Smaller models and faster training. *Proceedings of the 38th International Conference on Machine Learning (ICML)*, PMLR 139, 10096–10106.
- Wu, X., Wen, N., Liang, J., Lai, Y.-K., She, D., Cheng, M.-M., & Yang, J. (2019). Joint acne image grading and counting via label distribution learning. *Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV)*, 10642–10651. (ACNE04)
- Google Research. (2024). *Skin Condition Image Network (SCIN) dataset* [Data set]. https://github.com/google-research-datasets/scin
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics, 33*(1), 159–174.
