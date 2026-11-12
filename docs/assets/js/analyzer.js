// On-device analysis: photo quality checks + the AcneLens classifier.
// Everything runs in the browser (ONNX Runtime Web, WebAssembly).
// The photo is never uploaded anywhere.

const BASE = new URL("../../", import.meta.url); // -> docs/
const ORT_DIR = new URL("assets/vendor/ort/", BASE).href;

let config = null;
let session = null;
let loading = null;

export async function getConfig() {
  if (!config) config = await (await fetch(new URL("model/model_config.json", BASE))).json();
  return config;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.ort) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Could not load the AI engine."));
    document.head.appendChild(s);
  });
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the AI model (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got); got += value.length;
    onProgress?.(Math.min(0.99, got / total));
  }
  return got === total ? out : out.slice(0, got);
}

/** Loads the engine + model once. onProgress(0..1) reports the first download. */
export function loadModel(onProgress) {
  if (session) return Promise.resolve(session);
  if (loading) return loading;
  loading = (async () => {
    const cfg = await getConfig();
    await loadScript(ORT_DIR + "ort.wasm.min.js");
    const ort = window.ort;
    ort.env.wasm.wasmPaths = ORT_DIR;
    ort.env.wasm.numThreads = 1;          // GitHub Pages cannot enable cross-origin isolation
    ort.env.logLevel = "error";
    const bytes = await fetchWithProgress(new URL("model/" + cfg.model_file, BASE).href, onProgress);
    session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    onProgress?.(1);
    return session;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

/** Loads a File into an <img> (browsers apply the EXIF rotation automatically). */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be opened as a photo.")); };
    img.src = url;
  });
}

function canvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return c;
}

/**
 * Crops a square region (sx, sy, size in image pixels) and shrinks it to
 * `out` x `out` the same way the training pipeline does: halve repeatedly
 * while the image is at least 4x the target, then one smooth resize.
 */
export function cropSquare(img, sx, sy, size, out = 224) {
  let w = Math.max(1, Math.round(size));
  let c = canvas(w, w);
  let ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, size, size, 0, 0, w, w);
  while (w >= out * 4) {
    const h = Math.floor(w / 2);
    const c2 = canvas(h, h); const x2 = c2.getContext("2d");
    x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = "high";
    x2.drawImage(c, 0, 0, w, w, 0, 0, h, h);
    c = c2; w = h;
  }
  const f = canvas(out, out); const fx = f.getContext("2d", { willReadFrequently: true });
  fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = "high";
  fx.drawImage(c, 0, 0, w, w, 0, 0, out, out);
  return f;
}

/** Same three numbers as training/07_quality_thresholds.py. */
export function measureQuality(c224) {
  const { data, width: W, height: H } = c224.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c224.width, c224.height);
  const Y = new Float32Array(W * H);
  let sum = 0, skin = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    Y[p] = y; sum += y;
    if (cr >= 132 && cr <= 190 && cb >= 70 && cb <= 145 && y >= 20) skin++;
  }
  let n = 0, m = 0, m2 = 0;
  for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
    const p = yy * W + xx;
    const l = Y[p - 1] + Y[p + 1] + Y[p - W] + Y[p + W] - 4 * Y[p];
    n++; const d = l - m; m += d / n; m2 += d * (l - m);
  }
  return { brightness: sum / (W * H), sharpness: m2 / n, skin: skin / (W * H) };
}

export async function checkQuality(c224) {
  const q = measureQuality(c224);
  const t = (await getConfig()).quality;
  const problems = [];
  if (q.brightness < t.min_brightness) problems.push("dark");
  if (q.brightness > t.max_brightness) problems.push("bright");
  if (q.sharpness < t.min_sharpness) problems.push("blur");
  if (q.skin < t.min_skin) problems.push("skin");
  return { ...q, ok: problems.length === 0, problems };
}

/** Runs the model and applies the documented decision rule. */
export async function classify(c224) {
  const cfg = await getConfig();
  const s = await loadModel();
  const { data } = c224.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, cfg.input_size, cfg.input_size);
  const n = cfg.input_size * cfg.input_size;
  const x = new Float32Array(n * 3);
  for (let p = 0, i = 0; p < n; p++, i += 4) { x[p * 3] = data[i]; x[p * 3 + 1] = data[i + 1]; x[p * 3 + 2] = data[i + 2]; }
  const input = new window.ort.Tensor("float32", x, [1, cfg.input_size, cfg.input_size, 3]);
  const out = await s.run({ [s.inputNames[0]]: input });
  const probs = Array.from(out[s.outputNames[0]].data);
  return { probs, ...decide(probs, cfg) };
}

/**
 * Decision rule (same as training/05_export_evaluate.py):
 * 1. P(Inflammatory) >= t_inf (1/3)  -> Inflammatory (safety lean; never hidden by the gate)
 * 2. otherwise the most likely class
 * 3. if that class's probability < gate -> not confident enough, ask for a retake
 */
export function decide(probs, cfg) {
  const INF = cfg.labels.indexOf("Inflammatory");
  const top = probs.indexOf(Math.max(...probs));
  if (probs[INF] >= cfg.t_inf) {
    return { label: "Inflammatory", index: INF, confidence: probs[INF], passed: true, leanedToSafety: top !== INF };
  }
  return { label: cfg.labels[top], index: top, confidence: probs[top], passed: probs[top] >= cfg.gate, leanedToSafety: false };
}
