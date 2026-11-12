"""Step 5 - Export to ONNX, calibrate the decision rule on VALIDATION data,
then report final numbers on the untouched TEST set.

Usage: python 05_export_evaluate.py MODEL.keras DATASET_DIR SCIN_TEST_DIR OUT_DIR

Decision rule used by the app (T_INF fixed in advance; GATE chosen on validation only):
  1. If P(Inflammatory) >= T_INF (=1/3) -> "Inflammatory"  (safety bias: a close
     call between Non-Inflammatory and Inflammatory is resolved towards
     Inflammatory, which also shows the dermatologist advisory).
  2. Otherwise take the highest-probability class.
  3. If that class's probability < GATE -> "not sure" (ask for a retake).
     An Inflammatory call from rule 1 is never hidden by the gate.

Outputs: acnelens.onnx, model_config.json (read by the app), results.json and
results.md (numbers for Chapter 4), predictions_test.csv.
"""
import csv, json, math, os, sys
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
import numpy as np
from PIL import Image, ImageOps

LABELS = ["Clear Skin", "Non-Inflammatory", "Inflammatory"]
INF = 2
IMG = 224


def preprocess(path):
    """Same steps as the app: EXIF-upright, centre square, shrink to 224x224."""
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    while im.width >= 2 * IMG * 2:            # step-down halving (the app does the same)
        im = im.resize((im.width // 2, im.height // 2), Image.BOX)
    im = im.resize((IMG, IMG), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32)


def listing(root, split):
    out = []
    for i, lab in enumerate(LABELS):
        d = os.path.join(root, split, lab)
        out += [(os.path.join(d, f), i) for f in sorted(os.listdir(d))]
    return out


def decide(p, t_inf, gate):
    if p[INF] >= t_inf:
        return INF, True
    c = int(np.argmax(p))
    return c, bool(p[c] >= gate)


def kappa(cm):
    n = cm.sum(); po = np.trace(cm) / n
    pe = (cm.sum(0) * cm.sum(1)).sum() / n ** 2
    return float((po - pe) / (1 - pe)) if pe < 1 else 1.0


def wilson(k, n, z=1.96):
    if n == 0: return (0.0, 0.0)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(c - m, 3), round(c + m, 3))


def metrics(y, yhat):
    cm = np.zeros((3, 3), int)
    for a, b in zip(y, yhat): cm[a, b] += 1
    n = cm.sum(); acc = np.trace(cm) / n
    per = {}
    for c in range(3):
        tp = cm[c, c]; rec = tp / cm[c].sum() if cm[c].sum() else 0; pre = tp / cm[:, c].sum() if cm[:, c].sum() else 0
        per[LABELS[c]] = dict(recall=round(float(rec), 3), precision=round(float(pre), 3), n=int(cm[c].sum()))
    return dict(n=int(n), accuracy=round(float(acc), 3), accuracy_95ci=wilson(int(np.trace(cm)), int(n)),
                balanced_accuracy=round(float(np.mean([per[l]["recall"] for l in LABELS])), 3),
                cohen_kappa=round(kappa(cm), 3), per_class=per, confusion_matrix=cm.tolist())


def main(model_path, root, scin_dir, out):
    import keras, onnxruntime as ort
    os.makedirs(out, exist_ok=True)
    model = keras.models.load_model(model_path)
    model.predict(np.zeros((1, IMG, IMG, 3), np.float32), verbose=0)
    onnx_path = os.path.join(out, "acnelens.onnx")
    model.export(onnx_path, format="onnx", verbose=False)
    sess = ort.InferenceSession(onnx_path); iname = sess.get_inputs()[0].name
    run = lambda X: sess.run(None, {iname: X})[0]
    probe = np.stack([preprocess(p) for p, _ in listing(root, "test")[:8]])
    parity = float(np.abs(model.predict(probe, verbose=0) - run(probe)).max())
    print("keras vs onnx max diff", parity)

    def probs(items):
        return np.concatenate([run(np.stack([preprocess(p) for p, _ in items[i:i + 32]])) for i in range(0, len(items), 32)])

    val, test = listing(root, "val"), listing(root, "test")
    Pv, Pt = probs(val), probs(test)
    yv, yt = np.array([y for _, y in val]), np.array([y for _, y in test])

    # --- T_INF is fixed in advance by a cost rule, not tuned: a missed Inflammatory
    #     case (gentler routine, no referral advice) is treated as twice as harmful as
    #     an unneeded referral, so Inflammatory wins whenever P(Inflammatory) >= 1/3.
    #     Validation is only used to confirm it does not add false alarms.
    best_t = round(1 / 3, 4)
    # --- confidence-gate sweep (Section 4.1a). Selection is made on VALIDATION
    #     (so the test set stays unbiased): fewest missed errors, ties broken by
    #     fewest unnecessary rejections; rejections must stay <= 10% of correct answers.
    def sweep(P, Y, t):
        rows = []
        for g in [0.5, 0.6, 0.7, 0.8, 0.9]:
            missed = unnecessary = shown = 0
            for p, yy in zip(P, Y):
                c, ok = decide(p, t, g)
                shown += ok
                if ok and c != yy: missed += 1
                if not ok and c == yy: unnecessary += 1
            rows.append(dict(threshold=g, missed_errors=missed, unnecessary_rejections=unnecessary,
                             shown=shown, total=len(Y)))
        return rows
    sv = sweep(Pv, yv, best_t)
    n_correct = sum(decide(p, best_t, 0)[0] == yy for p, yy in zip(Pv, yv))
    ok_rows = [r for r in sv if r["unnecessary_rejections"] <= 0.10 * n_correct]
    gate = min(ok_rows, key=lambda r: (r["missed_errors"], r["unnecessary_rejections"], r["threshold"]))["threshold"] if ok_rows else 0.5

    yv_pred = [decide(p, best_t, 0)[0] for p in Pv]
    res = dict(val_decision_rule_all=metrics(yv, yv_pred), t_inf=best_t, gate=gate, keras_onnx_max_abs_diff=parity, val_gate_sweep=sv,
               test_gate_sweep=sweep(Pt, yt, best_t))
    res["val_argmax"] = metrics(yv, Pv.argmax(1))
    res["test_argmax"] = metrics(yt, Pt.argmax(1))
    res["test_decision_rule_all"] = metrics(yt, [decide(p, best_t, 0)[0] for p in Pt])
    shown = [(yy, decide(p, best_t, gate)[0]) for p, yy in zip(Pt, yt) if decide(p, best_t, gate)[1]]
    res["test_decision_rule_after_gate"] = metrics([a for a, _ in shown], [b for _, b in shown])
    res["test_rejected_by_gate"] = int(len(yt) - len(shown))

    # --- real-world SCIN photos (dermatologist label: acne; no 3-class label yet)
    scin = sorted(os.path.join(scin_dir, f) for f in os.listdir(scin_dir))
    Ps = probs([(p, 0) for p in scin])
    sd = [decide(p, best_t, gate) for p in Ps]
    res["scin_real_world"] = dict(n=len(scin), predicted={LABELS[c]: int(sum(1 for d in sd if d[0] == c)) for c in range(3)},
                                  rejected_by_gate=int(sum(1 for d in sd if not d[1])),
                                  called_clear_skin=int(sum(1 for d in sd if d[0] == 0)))
    with open(os.path.join(out, "predictions_test.csv"), "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["file", "dataset_label", "p_clear", "p_noninf", "p_inf", "app_result", "shown"])
        for (p, yy), pr in zip(test, Pt):
            c, ok = decide(pr, best_t, gate)
            w.writerow([os.path.relpath(p, root), LABELS[yy], *[round(float(v), 4) for v in pr], LABELS[c], ok])
        for p, pr, (c, ok) in zip(scin, Ps, sd):
            w.writerow([os.path.basename(p), "SCIN (acne, real-world)", *[round(float(v), 4) for v in pr], LABELS[c], ok])
    json.dump(res, open(os.path.join(out, "results.json"), "w"), indent=1)
    json.dump(dict(labels=LABELS, input_size=IMG, input="RGB 0-255, NHWC float32", input_name=iname,
                   t_inf=best_t, gate=gate, model_file="acnelens.onnx"),
              open(os.path.join(out, "model_config.json"), "w"), indent=1)
    print(json.dumps({k: res[k] for k in ["t_inf", "gate", "test_argmax", "test_decision_rule_all",
                                          "test_decision_rule_after_gate", "test_rejected_by_gate", "scin_real_world"]}, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:5])
