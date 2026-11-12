"""Step 3 - Apply the review decisions, group look-alikes, and split.

Usage: python 03_build_dataset.py RAW_DIR INVENTORY.csv review_decisions.csv \
           PATCH_DIR PATCH_KEEP.txt OUT_DIR

What it does
1. Drops every image (and its whole near-duplicate cluster) marked "drop" in
   review_decisions.csv, and applies "relabel" decisions (Non-Inflammatory
   images that show an inflamed lesion become Inflammatory - the agreed
   "any inflammatory lesion visible = Inflammatory" rule).
2. Replaces full-face Clear Skin photos with their skin-only patches.
3. Groups look-alikes so they can never be split across train/val/test:
   - same pHash cluster (step 1),
   - same Roboflow source photo (file prefix before ".rf."),
   - same source photo for skin patches,
   - deep-feature cosine similarity >= 0.93 (catches rotated/zoomed copies
     that pHash misses).
4. Splits by group: a fixed number of groups per class for the TEST set
   (the dermatologist packet), ~15% for VALIDATION, the rest TRAIN.
5. Copies files to OUT_DIR/{train,val,test}/{label}/ and writes manifest.csv.
"""
import csv, os, random, re, shutil, sys
import numpy as np

SEED = 20261112
TEST_PER_CLASS = 25
VAL_FRAC = 0.15
LABELS = ["Clear Skin", "Non-Inflammatory", "Inflammatory"]


def rf_prefix(path):
    m = re.match(r"(.+?)_(jpg|jpeg|png)\.rf\.", os.path.basename(path), re.I)
    return m.group(1) if m else None


def embed(paths):
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    import keras
    from PIL import Image, ImageOps
    base = keras.applications.EfficientNetV2B0(include_top=False, weights="imagenet",
                                               input_shape=(224, 224, 3), pooling="avg")
    feats = []
    for i in range(0, len(paths), 32):
        batch = [np.asarray(ImageOps.fit(ImageOps.exif_transpose(Image.open(p)).convert("RGB"), (224, 224)),
                            dtype=np.float32) for p in paths[i:i + 32]]
        feats.append(base.predict(np.stack(batch), verbose=0))
    f = np.concatenate(feats)
    return f / np.linalg.norm(f, axis=1, keepdims=True)


def main(raw, inv_csv, dec_csv, patch_dir, keep_txt, out):
    inv = list(csv.DictReader(open(inv_csv)))
    dec = {d["id"]: d for d in csv.DictReader(open(dec_csv))}
    by_cluster = {}
    for r in inv:
        by_cluster.setdefault(r["cluster"], []).append(r)
    # decisions were made on one representative per cluster -> apply cluster-wide
    cluster_action = {}
    for r in inv:
        if r["id"] in dec:
            cluster_action[r["cluster"]] = dec[r["id"]]
    keep_patches = set(open(keep_txt).read().split())
    items = []
    seen_md5 = set()
    for cl, members in by_cluster.items():
        act = cluster_action.get(cl)
        if act and act["action"] == "drop":
            continue
        for r in members:
            if r["id"] in seen_md5:
                continue  # exact duplicate file
            seen_md5.add(r["id"])
            label = act["new_label"] if act and act["action"] == "relabel" else r["label"]
            src_path = os.path.join(raw, r["path"])
            if act and act["action"] == "crop_to_skin":
                stem = os.path.splitext(os.path.basename(r["path"]))[0]
                for f in sorted(keep_patches):
                    if f.startswith(stem + "__"):
                        items.append(dict(path=os.path.join(patch_dir, f), label="Clear Skin", source="ffhq-patch",
                                          subtype="Clear Skin", key=f"cl:{cl}", origin=r["path"]))
                continue
            items.append(dict(path=src_path, label=label, source=r["source"], subtype=r["subtype"],
                              key=f"cl:{cl}", origin=r["path"]))
    # Clear Skin photos that were already skin-only are kept as they are (no crop decision).
    # --- grouping (union-find)
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        parent[find(i)] = find(j)

    first = {}
    for i, it in enumerate(items):
        for k in [it["key"], ("rf:" + rf_prefix(it["origin"])) if rf_prefix(it["origin"]) else None]:
            if k is None:
                continue
            if k in first:
                union(i, first[k])
            else:
                first[k] = i
    F = embed([it["path"] for it in items])
    S = F @ F.T
    ii, jj = np.where(np.triu(S, 1) >= 0.93)
    for a, b in zip(ii, jj):
        union(int(a), int(b))
    for i, it in enumerate(items):
        it["group"] = f"g{find(i)}"
    # groups with mixed labels: keep majority label for all (rare)
    groups = {}
    for it in items:
        groups.setdefault(it["group"], []).append(it)
    mixed = 0
    for g, its in groups.items():
        labs = [x["label"] for x in its]
        if len(set(labs)) > 1:
            mixed += 1
            # safety-first: if any member is Inflammatory the group is ambiguous -> drop it
            for x in its:
                x["label"] = None
    items = [x for x in items if x["label"]]
    groups = {}
    for it in items:
        groups.setdefault(it["group"], []).append(it)
    # --- split by group, per class
    rng = random.Random(SEED)
    for lab in LABELS:
        gs = sorted(g for g, its in groups.items() if its[0]["label"] == lab)
        rng.shuffle(gs)
        n_imgs = sum(len(groups[g]) for g in gs)
        test, val, acc = [], [], 0
        # test: pick single-image groups first so 25 groups ~= 25 distinct photos
        singles = [g for g in gs if len(groups[g]) == 1]
        test = singles[:TEST_PER_CLASS]
        rest = [g for g in gs if g not in set(test)]
        for g in rest:
            if acc < VAL_FRAC * n_imgs:
                val.append(g); acc += len(groups[g])
        for g in gs:
            split = "test" if g in test else ("val" if g in val else "train")
            for it in groups[g]:
                it["split"] = split
    # --- write
    if os.path.exists(out):
        shutil.rmtree(out)
    rows = []
    for n, it in enumerate(sorted(items, key=lambda x: (x["split"], x["label"], x["path"]))):
        ext = os.path.splitext(it["path"])[1].lower()
        dst = os.path.join(out, it["split"], it["label"], f"{n:05d}{ext}")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(it["path"], dst)
        rows.append(dict(file=os.path.relpath(dst, out), split=it["split"], label=it["label"], group=it["group"],
                         source=it["source"], subtype=it["subtype"], origin=it["origin"]))
    with open(os.path.join(out, "manifest.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    from collections import Counter
    print("mixed-label groups dropped:", mixed)
    for s in ["train", "val", "test"]:
        print(s, dict(Counter(r["label"] for r in rows if r["split"] == s)))


if __name__ == "__main__":
    main(*sys.argv[1:7])
