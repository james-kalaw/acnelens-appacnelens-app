"""Step 7 - Calibrate the app's photo-quality checks on real data.

The app computes three numbers on the same 224x224 crop the model sees
(identical formulas in docs/assets/js/analyzer.js):
  brightness = mean luma (0.299R + 0.587G + 0.114B)
  sharpness  = variance of the 4-neighbour Laplacian of luma
  skin       = share of pixels inside a broad skin-colour box in YCbCr
Curated internet photos are cleaner than real phone photos, so percentile
cut-offs would reject normal indoor photos.  The app therefore uses lenient
fixed cut-offs placed just outside the worst curated image (which includes
the darkest skin tones and the real-world SCIN photos): they only catch
photos that are nearly black, blown-out white, completely blurred/flat, or
mostly not skin.  This script prints how many curated images each would reject.

Usage: python 07_quality_thresholds.py DATASET_DIR SCIN_TEST_DIR MODEL_CONFIG.json
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("ev", os.path.join(os.path.dirname(__file__), "05_export_evaluate.py"))
ev = importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)


def quality(x):
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    lap = y[1:-1, :-2] + y[1:-1, 2:] + y[:-2, 1:-1] + y[2:, 1:-1] - 4 * y[1:-1, 1:-1]
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    skin = (cr >= 132) & (cr <= 190) & (cb >= 70) & (cb <= 145) & (y >= 20)
    return float(y.mean()), float(lap.var()), float(skin.mean())


def main(root, scin, cfg_path):
    paths = []
    for dp, _, fs in os.walk(root):
        paths += [os.path.join(dp, f) for f in fs if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    paths += [os.path.join(scin, f) for f in os.listdir(scin)]
    Q = np.array([quality(ev.preprocess(p)) for p in paths])
    th = dict(min_brightness=45.0, max_brightness=235.0, min_sharpness=0.6, min_skin=0.30)
    print("data minimums: brightness %.1f, sharpness %.2f, skin %.2f; max brightness %.1f"
          % (Q[:, 0].min(), Q[:, 1].min(), Q[:, 2].min(), Q[:, 0].max()))
    print(len(paths), "images; thresholds", th)
    for k, col, op in [("min_brightness", 0, np.less), ("max_brightness", 0, np.greater),
                       ("min_sharpness", 1, np.less), ("min_skin", 2, np.less)]:
        print(f"  {k}: would reject {int(op(Q[:, col], th[k]).sum())} of {len(Q)} curated images")
    cfg = json.load(open(cfg_path)); cfg["quality"] = th
    json.dump(cfg, open(cfg_path, "w"), indent=1)


if __name__ == "__main__":
    main(*sys.argv[1:4])
