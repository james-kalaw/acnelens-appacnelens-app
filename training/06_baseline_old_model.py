"""Step 6 (optional) - Score the OLD Teachable Machine model (v1-streamlit branch:
keras_model.h5 + labels.txt) on the SAME new test set, for a fair before/after.

Usage: python 06_baseline_old_model.py keras_model.h5 labels.txt DATASET_DIR
Preprocessing is Teachable Machine's own: 224x224 centre fit, scaled to [-1, 1].
"""
import os, sys
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import numpy as np
from PIL import Image, ImageOps
import tf_keras as keras

NEW = ["Clear Skin", "Non-Inflammatory", "Inflammatory"]


class DW(keras.layers.DepthwiseConv2D):
    def __init__(self, **kw):
        kw.pop("groups", None); super().__init__(**kw)


def main(h5, labels_txt, root):
    m = keras.models.load_model(h5, custom_objects={"DepthwiseConv2D": DW}, compile=False)
    names = [l.strip().split(" ", 1)[-1] for l in open(labels_txt) if l.strip()]
    cm = np.zeros((3, 3), int)
    for yi, lab in enumerate(NEW):
        d = os.path.join(root, "test", lab)
        for f in sorted(os.listdir(d)):
            im = ImageOps.fit(ImageOps.exif_transpose(Image.open(os.path.join(d, f))).convert("RGB"), (224, 224), Image.Resampling.LANCZOS)
            x = (np.asarray(im, np.float32) / 127.5 - 1)[None]
            pred = names[int(m.predict(x, verbose=0)[0].argmax())]
            cm[yi, NEW.index(pred)] += 1
    print("old TM model on new test set: accuracy", round(np.trace(cm) / cm.sum(), 3))
    for i, l in enumerate(NEW): print(f"  {l} recall {cm[i, i] / cm[i].sum():.2f}")
    print("confusion (rows=true", NEW, ")\n", cm)


if __name__ == "__main__":
    main(*sys.argv[1:4])
