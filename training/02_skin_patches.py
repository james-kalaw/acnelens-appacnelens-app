"""Step 2 - Cut skin-only patches (cheeks, forehead, chin) from face photos.

The app asks users for a close-up of one skin area, so training images must
look like that too: no eyes, nose or lips.  This replaces the manual cropping
the researchers did before.  MediaPipe Face Landmarker finds 478 face points;
patches are centred on fixed landmarks and sized relative to face width.

Usage:  python 02_skin_patches.py LANDMARKER.task OUT_DIR IMG [IMG ...]
        python 02_skin_patches.py --windows OUT_DIR IMG [IMG ...]   (no-face fallback)
Writes OUT_DIR/<image-stem>__<region>.jpg and prints one CSV line per patch.
"""
import os, sys
import numpy as np
from PIL import Image, ImageOps
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

# landmark ids on MediaPipe's canonical face mesh
REGIONS = {
    "cheek_a": [50, 101, 118],    # cheek below one eye, beside the nose
    "cheek_b": [280, 330, 347],   # the other cheek
    "forehead": [151, 108, 337],  # centre of forehead
    "chin": [175, 199, 200],      # between lower lip and chin tip
}
SIZE_FRAC = {"cheek_a": 0.26, "cheek_b": 0.26, "forehead": 0.26, "chin": 0.20}


def main(task, out_dir, paths):
    os.makedirs(out_dir, exist_ok=True)
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=task),
                                        num_faces=1, min_face_detection_confidence=0.4)
    det = vision.FaceLandmarker.create_from_options(opts)
    for p in paths:
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        if max(im.size) > 1600:
            im.thumbnail((1600, 1600))
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
        if not res.face_landmarks:
            print(f"{p},NOFACE,,"); continue
        lm = res.face_landmarks[0]
        W, H = im.size
        pt = lambda i: np.array([lm[i].x * W, lm[i].y * H])
        face_w = np.linalg.norm(pt(234) - pt(454))
        stem = os.path.splitext(os.path.basename(p))[0]
        for name, ids in REGIONS.items():
            c = np.mean([pt(i) for i in ids], axis=0)
            s = SIZE_FRAC[name] * face_w
            box = [c[0] - s / 2, c[1] - s / 2, c[0] + s / 2, c[1] + s / 2]
            if s < 48 or box[0] < 0 or box[1] < 0 or box[2] > W or box[3] > H:
                print(f"{p},SKIP_{name},,"); continue
            patch = im.crop(tuple(int(round(v)) for v in box))
            outp = os.path.join(out_dir, f"{stem}__{name}.jpg")
            patch.save(outp, quality=92)
            print(f"{p},{name},{outp},{int(s)}")



def plain_skin_windows(im, frac=0.42, k=2, step=0.06):
    """Fallback for partial-face close-ups where no face is detected:
    slide a square window and keep the k windows that are (a) almost all
    skin-coloured (YCrCb skin range) and (b) lowest in edge energy, i.e.
    away from eyes, nostrils, lips and hair.  Returns PIL crops."""
    from PIL import ImageFilter
    g = im.copy(); g.thumbnail((512, 512))
    ycc = np.asarray(g.convert("YCbCr")).astype(np.float32)
    skin = (ycc[..., 2] > 133) & (ycc[..., 2] < 180) & (ycc[..., 1] > 77) & (ycc[..., 1] < 135) & (ycc[..., 0] > 40)
    edges = np.asarray(g.convert("L").filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    H, W = skin.shape
    s = int(frac * min(W, H)); st = max(4, int(step * min(W, H)))
    cands = []
    for y in range(0, H - s + 1, st):
        for x in range(0, W - s + 1, st):
            sk = skin[y:y + s, x:x + s].mean()
            if sk < 0.97:
                continue
            cands.append((edges[y:y + s, x:x + s].mean(), x, y))
    cands.sort()
    chosen = []
    for e, x, y in cands:
        if all(abs(x - cx) >= s * 0.8 or abs(y - cy) >= s * 0.8 for _, cx, cy in chosen):
            chosen.append((e, x, y))
        if len(chosen) == k:
            break
    sc = im.width / W
    return [im.crop((int(x * sc), int(y * sc), int((x + s) * sc), int((y + s) * sc))) for _, x, y in chosen]


def main_windows(out_dir, paths):
    os.makedirs(out_dir, exist_ok=True)
    for p in paths:
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        stem = os.path.splitext(os.path.basename(p))[0]
        for i, c in enumerate(plain_skin_windows(im)):
            outp = os.path.join(out_dir, f"{stem}__win{i}.jpg"); c.save(outp, quality=92)
            print(f"{p},win{i},{outp},{c.width}")


if __name__ == "__main__":
    if sys.argv[1] == "--windows":
        main_windows(sys.argv[2], sys.argv[3:])
    else:
        main(sys.argv[1], sys.argv[2], sys.argv[3:])
