"""Step 4 - Train the AcneLens classifier (transfer learning).

Usage: python 04_train.py DATASET_DIR OUT_DIR

Model: EfficientNetV2-B0 pre-trained on ImageNet (Keras Applications) with a
new 3-class head.  This is the same idea as Teachable Machine (re-use a
network that already knows general image features, teach only the last
part), but with control over the data split, class balance and augmentation.

Two stages:
  A. backbone frozen, train only the new head;
  B. unfreeze the top of the backbone and fine-tune with a small learning rate.

Anti-shortcut augmentation: every training image is randomly downscaled,
blurred, JPEG-compressed, colour-shifted, rotated and cropped, so photo
resolution / camera / lighting stop being clues - only the skin is.

Input to the saved model: raw RGB pixels 0-255, 224x224.  ImageNet
normalisation happens inside the model, so the app does no maths except
resizing.
"""
import json, os, sys
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
import numpy as np
import tensorflow as tf
import keras

LABELS = ["Clear Skin", "Non-Inflammatory", "Inflammatory"]
IMG = 224
SEED = 20261112
MEAN = np.array([0.485, 0.456, 0.406]); STD = np.array([0.229, 0.224, 0.225])
keras.utils.set_random_seed(SEED)


def list_split(root, split):
    paths, ys = [], []
    for i, lab in enumerate(LABELS):
        d = os.path.join(root, split, lab)
        for f in sorted(os.listdir(d)):
            paths.append(os.path.join(d, f)); ys.append(i)
    return paths, np.array(ys)


def load(path):
    raw = tf.io.read_file(path)
    img = tf.io.decode_image(raw, channels=3, expand_animations=False)
    img = tf.image.convert_image_dtype(img, tf.float32)  # 0..1
    return img


def center_square(img):
    h, w = tf.shape(img)[0], tf.shape(img)[1]
    s = tf.minimum(h, w)
    img = tf.image.crop_to_bounding_box(img, (h - s) // 2, (w - s) // 2, s, s)
    return tf.image.resize(img, (IMG, IMG), method="area" if True else "bilinear", antialias=True)


def gaussian_blur(img, sigma):
    k = 7
    x = tf.range(-(k // 2), k // 2 + 1, dtype=tf.float32)
    g = tf.exp(-(x ** 2) / (2 * sigma ** 2)); g = g / tf.reduce_sum(g)
    kern = tf.tile(tf.reshape(g, [k, 1, 1, 1]), [1, 1, 3, 1])
    img = tf.nn.depthwise_conv2d(img[None], kern, [1, 1, 1, 1], "SAME")
    img = tf.nn.depthwise_conv2d(img, tf.transpose(kern, [1, 0, 2, 3]), [1, 1, 1, 1], "SAME")
    return img[0]


def augment(img):
    h, w = tf.cast(tf.shape(img)[0], tf.float32), tf.cast(tf.shape(img)[1], tf.float32)
    # random resized crop (area 35-100%, aspect 0.8-1.25)
    area = tf.random.uniform([], 0.35, 1.0) * h * w
    ratio = tf.exp(tf.random.uniform([], tf.math.log(0.8), tf.math.log(1.25)))
    ch = tf.minimum(tf.sqrt(area / ratio), h); cw = tf.minimum(tf.sqrt(area * ratio), w)
    y0 = tf.random.uniform([], 0, h - ch + 1e-3); x0 = tf.random.uniform([], 0, w - cw + 1e-3)
    img = tf.image.crop_and_resize(img[None], [[y0 / h, x0 / w, (y0 + ch) / h, (x0 + cw) / w]], [0], [IMG, IMG])[0]
    # flips + 90-degree rotations (skin has no "up")
    img = tf.image.random_flip_left_right(img); img = tf.image.random_flip_up_down(img)
    img = tf.image.rot90(img, tf.random.uniform([], 0, 4, dtype=tf.int32))
    # resolution: simulate low-quality cameras / small source photos (kills the size shortcut)
    if tf.random.uniform([]) < 0.6:
        s = tf.cast(tf.random.uniform([], 56, 200), tf.int32)
        img = tf.image.resize(tf.image.resize(img, (s, s), antialias=True), (IMG, IMG), method="bilinear")
    if tf.random.uniform([]) < 0.3:
        img = gaussian_blur(img, tf.random.uniform([], 0.6, 1.8))
    # colour / lighting
    img = tf.image.random_brightness(img, 0.15)
    img = tf.image.random_contrast(img, 0.8, 1.2)
    img = tf.image.random_saturation(img, 0.8, 1.2)
    img = tf.image.random_hue(img, 0.03)
    img = tf.clip_by_value(img, 0.0, 1.0)
    if tf.random.uniform([]) < 0.5:
        img = tf.image.adjust_jpeg_quality(img, tf.random.uniform([], 35, 95, dtype=tf.int32))
    if tf.random.uniform([]) < 0.3:
        img = img + tf.random.normal(tf.shape(img), 0, tf.random.uniform([], 0.0, 0.03))
    return tf.clip_by_value(img, 0.0, 1.0)


def make_ds(paths, ys, train, batch=24):
    ds = tf.data.Dataset.from_tensor_slices((paths, ys))
    if train:
        ds = ds.shuffle(len(paths), seed=SEED, reshuffle_each_iteration=True)
        ds = ds.map(lambda p, y: (augment(load(p)) * 255.0, tf.one_hot(y, 3)), num_parallel_calls=4)
    else:
        ds = ds.map(lambda p, y: (center_square(load(p)) * 255.0, tf.one_hot(y, 3)), num_parallel_calls=4)
    return ds.batch(batch).prefetch(2)


def build():
    base = keras.applications.EfficientNetV2B0(include_top=False, weights="imagenet",
                                               input_shape=(IMG, IMG, 3), pooling="avg",
                                               include_preprocessing=False)
    inp = keras.Input((IMG, IMG, 3), name="image")
    x = keras.layers.Rescaling(scale=list(1 / (255 * STD)), offset=list(-MEAN / STD), name="imagenet_norm")(inp)
    x = base(x)
    x = keras.layers.Dropout(0.3)(x)
    out = keras.layers.Dense(3, activation="softmax", name="probs",
                             kernel_regularizer=keras.regularizers.l2(1e-4))(x)
    return keras.Model(inp, out), base


class BalancedEval(keras.callbacks.Callback):
    """Tracks validation balanced accuracy (mean per-class recall) and keeps the best weights."""
    def __init__(self, ds, ys):
        super().__init__(); self.ds, self.ys, self.best, self.best_w, self.log = ds, ys, -1, None, []

    def on_epoch_end(self, epoch, logs=None):
        p = self.model.predict(self.ds, verbose=0).argmax(1)
        rec = [float((p[self.ys == c] == c).mean()) for c in range(3)]
        bal = float(np.mean(rec))
        self.log.append(dict(epoch=len(self.log) + 1, val_balanced_acc=round(bal, 4),
                             recall=dict(zip(LABELS, [round(r, 3) for r in rec])), loss=round(float(logs["loss"]), 4)))
        print(self.log[-1], flush=True)
        if bal > self.best:
            self.best, self.best_w = bal, self.model.get_weights()


def main(root, out):
    os.makedirs(out, exist_ok=True)
    trp, try_ = list_split(root, "train"); vp, vy = list_split(root, "val")
    counts = np.bincount(try_, minlength=3)
    cw = {i: float(len(try_) / (3 * counts[i])) for i in range(3)}
    print("train counts", counts.tolist(), "class weights", cw, flush=True)
    tr, va = make_ds(trp, try_, True), make_ds(vp, vy, False)
    model, base = build()
    loss = keras.losses.CategoricalCrossentropy(label_smoothing=0.1)
    cb = BalancedEval(va, vy)
    # Stage A: head only
    base.trainable = False
    model.compile(keras.optimizers.Adam(1e-3), loss)
    model.fit(tr, epochs=8, class_weight=cw, callbacks=[cb], verbose=0)
    # Stage B: fine-tune top of backbone (BatchNorm layers stay frozen)
    base.trainable = True
    n = len(base.layers)
    for i, l in enumerate(base.layers):
        l.trainable = (i >= int(n * 0.55)) and not isinstance(l, keras.layers.BatchNormalization)
    model.compile(keras.optimizers.Adam(keras.optimizers.schedules.CosineDecay(2e-4, 20 * len(tr))), loss)
    model.fit(tr, epochs=20, class_weight=cw, callbacks=[cb], verbose=0)
    model.set_weights(cb.best_w)
    model.save(os.path.join(out, "acnelens_model.keras"))
    json.dump(dict(labels=LABELS, best_val_balanced_acc=cb.best, history=cb.log, class_weights=cw,
                   train_counts=counts.tolist()), open(os.path.join(out, "train_log.json"), "w"), indent=1)
    print("best val balanced acc", cb.best)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
