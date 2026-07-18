"""
Model loading and inference for the AcneLens Teachable Machine model.

COMPATIBILITY NOTE:
Teachable Machine's exported .h5 files include a "groups" argument in
their DepthwiseConv2D layer config that modern Keras (Keras 3, bundled
with TensorFlow 2.16+) no longer accepts, raising:

    TypeError: Error when deserializing class 'DepthwiseConv2D' ...

This is a known, widely-reported incompatibility -- not a mistake in
your training or your model file. Rather than requiring an older,
Python-3.12-incompatible TensorFlow version, this file works around it
directly: CompatibleDepthwiseConv2D below simply discards the
unrecognized "groups" argument during loading, so any current
TensorFlow/Python version works, including Python 3.12. This exact fix
was tested against a reproduction of the real error before being added
here.
"""

import numpy as np
from PIL import Image, ImageOps
import tensorflow as tf


class CompatibleDepthwiseConv2D(tf.keras.layers.DepthwiseConv2D):
    """Drop-in replacement for DepthwiseConv2D that silently discards the
    legacy 'groups' argument found in Teachable Machine's exported .h5
    files, which newer Keras versions no longer accept."""
    def __init__(self, **kwargs):
        kwargs.pop("groups", None)
        super().__init__(**kwargs)


# Matches the 70% Confidence Threshold documented in Phase 1
CONFIDENCE_THRESHOLD = 0.70

# If the gap between the top-scoring class and the runner-up is smaller
# than this, the prediction is flagged as a "close call" even though it
# may still clear CONFIDENCE_THRESHOLD on its own.
BORDERLINE_MARGIN = 15.0  # percentage points

_model = None
_class_names = None


def load_model_and_labels(model_path="keras_model.h5", labels_path="labels.txt"):
    """Loads the exported Teachable Machine model and class labels once,
    then reuses the cached objects on every later call (important for
    Streamlit, which re-runs the whole script on every interaction)."""
    global _model, _class_names
    if _model is None:
        _model = tf.keras.models.load_model(
            model_path,
            custom_objects={"DepthwiseConv2D": CompatibleDepthwiseConv2D},
            compile=False,
        )
        with open(labels_path, "r") as f:
            # labels.txt lines look like "0 Clear Skin" -- strip the index
            _class_names = [line.strip().split(" ", 1)[-1] for line in f.readlines()]
    return _model, _class_names


def classify_image(pil_image):
    """
    Runs a PIL image through the model using the exact same preprocessing
    Teachable Machine itself uses (224x224 center-crop, normalized to
    [-1, 1]), so predictions match what you saw in the Teachable Machine
    preview panel.

    Returns a dict:
        {
            "predicted_class": str or None (None if it failed the gate),
            "confidence": float (0-100),
            "passed_gate": bool,
            "all_scores": {class_name: confidence_percent, ...},
        }
    """
    model, class_names = load_model_and_labels()

    size = (224, 224)
    image = ImageOps.fit(pil_image.convert("RGB"), size, Image.Resampling.LANCZOS)
    image_array = np.asarray(image)
    normalized_image_array = (image_array.astype(np.float32) / 127.5) - 1
    data = np.expand_dims(normalized_image_array, axis=0)

    predictions = model.predict(data, verbose=0)[0]
    all_scores = {class_names[i]: round(float(predictions[i]) * 100, 2) for i in range(len(class_names))}

    # Sort classes by score, highest first
    ranked = sorted(all_scores.items(), key=lambda kv: kv[1], reverse=True)
    best_class, best_confidence = ranked[0]
    runner_up_class, runner_up_confidence = ranked[1] if len(ranked) > 1 else (None, 0.0)

    passed_gate = best_confidence >= (CONFIDENCE_THRESHOLD * 100)
    margin = best_confidence - runner_up_confidence
    is_borderline = passed_gate and margin < BORDERLINE_MARGIN

    return {
        "predicted_class": best_class if passed_gate else None,
        "confidence": round(best_confidence, 2),
        "passed_gate": passed_gate,
        "all_scores": all_scores,
        "runner_up_class": runner_up_class,
        "runner_up_confidence": round(runner_up_confidence, 2),
        "is_borderline": is_borderline,
    }
