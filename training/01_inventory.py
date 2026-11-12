"""Step 1 - Inventory every raw image: fingerprint, size, sharpness, and
near-duplicate clusters.

Usage:  python 01_inventory.py RAW_DIR OUT_CSV

RAW_DIR layout (as uploaded by the researchers):
  RAW_DIR/internet/Non-Inflammatory/{BLACKHEADS,WHITEHEADS}/...
  RAW_DIR/internet/Inflammatory/{PAPULES,PUSTULES,NODULES,CYSTS}/...
  RAW_DIR/internet/Clear Skin/...                (FFHQ-derived)
  RAW_DIR/roboflow/Wag gagalawin/{Clear Skin,Non-Inflammatory,Inflammatory}/...

Near-duplicates (same photo re-saved, resized, lightly edited) are grouped
with a perceptual hash (pHash, Hamming distance <= 6).  Every member of a
cluster later goes to the SAME split, so the test set can never contain a
copy of a training photo (the leak that inflated the earlier 90% score).
"""
import csv, hashlib, os, sys
from PIL import Image, ImageOps, ImageFilter, ImageStat
import imagehash

NONINF = {"BLACKHEADS", "WHITEHEADS", "NON-INFLAMMATORY"}
INF = {"PAPULES", "PUSTULES", "NODULES", "CYSTS", "INFLAMMATORY"}


def label_of(folder):
    f = folder.upper()
    if "CLEAR" in f:
        return "Clear Skin"
    if f in NONINF:
        return "Non-Inflammatory"
    if f in INF:
        return "Inflammatory"
    raise ValueError(folder)


def main(raw, out_csv):
    rows = []
    for src in ("internet", "roboflow"):
        for dp, _, fs in os.walk(os.path.join(raw, src)):
            for f in sorted(fs):
                if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue
                p = os.path.join(dp, f)
                im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
                folder = os.path.basename(dp)
                g = im.convert("L")
                small = g.copy()
                small.thumbnail((512, 512))
                rows.append({
                    "id": hashlib.md5(open(p, "rb").read()).hexdigest()[:12],
                    "source": src,
                    "path": os.path.relpath(p, raw),
                    "subtype": folder,
                    "label": label_of(folder),
                    "w": im.width, "h": im.height,
                    "phash": str(imagehash.phash(im)),
                    "edge_var": round(ImageStat.Stat(small.filter(ImageFilter.FIND_EDGES)).var[0], 1),
                    "brightness": round(ImageStat.Stat(g).mean[0], 1),
                })
    # union-find clusters on pHash distance
    hs = [imagehash.hex_to_hash(r["phash"]) for r in rows]
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            if hs[i] - hs[j] <= 6:
                parent[find(i)] = find(j)
    for i, r in enumerate(rows):
        r["cluster"] = rows[find(i)]["id"]
    with open(out_csv, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} images, {len(set(r['cluster'] for r in rows))} unique clusters -> {out_csv}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
