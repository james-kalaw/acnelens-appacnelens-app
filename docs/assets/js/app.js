import { loadModel, getConfig, fileToImage, cropSquare, checkQuality, classify } from "./analyzer.js";
import { recommend, AAD_2024, JEADV_2024 } from "./rules.js";
import { addEntry, allEntries, deleteEntry, clearAll, toCSV } from "./journal.js";
import { t, getLang, setLang, applyStatic, dateLocale, ingText } from "./i18n.js";

const VERSION = "2.2.0";
const MODEL_DATE = "2026-11-12";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------------ icons */
const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  camera: P('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.6"/>'),
  image: P('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-9 8.5"/>'),
  scan: P('<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  hand: P('<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L3.6 15a1.6 1.6 0 0 1 2.4-2.1L8 15"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>'),
  lock: P('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  user: P('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
  "arrow-right": P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  "chev-left": P('<path d="m15 5-7 7 7 7"/>'),
  "chev-right": P('<path d="m9 5 7 7-7 7"/>'),
  check: P('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>'),
  refresh: P('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'),
  "zoom-in": P('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8v6M8 11h6"/>'),
  "zoom-out": P('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8 11h6"/>'),
  download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  share: P('<path d="M12 15V4M8 8l4-4 4 4M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12"/>'),
  trash: P('<path d="M4.5 7h15M10 11v5M14 11v5M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V4.5h5V7"/>'),
  alert: P('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.2"/>'),
  doctor: P('<path d="M7 4v5a4 4 0 0 0 8 0V4M7 4H5.5M15 4h1.5"/><path d="M11 13v2.5a4.5 4.5 0 0 0 9 0V13"/><circle cx="20" cy="11" r="1.8"/>'),
  seal: P('<path d="M12 3l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6L4 15.3l.8-2.6L4 10.1l2.2-1.6.9-2.6 2.7.1z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  book: P('<path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H18"/>'),
  sliders: P('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  leaf: P('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>'),
  globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>'),
  moon: P('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  doc: P('<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z"/><path d="M14 3.5V8h4M9 13h6M9 16.5h4"/>'),
};
function hydrateIcons(root = document) {
  for (const el of $$("i[data-icon]", root)) {
    const svg = ICONS[el.dataset.icon];
    if (!svg) continue;
    const span = document.createElement("span");
    span.innerHTML = svg;
    const node = span.firstElementChild;
    if (el.className) node.setAttribute("class", el.className);
    el.replaceWith(node);
  }
}
const icon = (n, cls = "") => ICONS[n].replace("<svg ", `<svg class="${cls}" `);

/* ------------------------------------------------------------------ state */
const state = {
  img: null, crop: null, crop224: null, cropDisplay: null, thumb: null,
  result: null, answers: {}, quizStep: 0, rec: null, saved: false, validation: null, installEvent: null,
};
const store = {
  get onboarded() { try { return localStorage.getItem("acnelens.onboarded") === "1"; } catch { return false; } },
  set onboarded(v) { try { localStorage.setItem("acnelens.onboarded", v ? "1" : "0"); } catch {} },
  get theme() { try { return localStorage.getItem("acnelens.theme") || "system"; } catch { return "system"; } },
  set theme(v) { try { v === "system" ? localStorage.removeItem("acnelens.theme") : localStorage.setItem("acnelens.theme", v); } catch {} },
};

/* ------------------------------------------------------------------ router */
const TAB_SCREENS = { home: "home", journal: "journal", settings: "settings", results: null };
let current = null;
function show(name, { push = true, replace = false } = {}) {
  const swap = () => {
    for (const s of $$(".screen")) s.classList.toggle("active", s.id === `s-${name}`);
    current = name;
    const tabbed = ["home", "journal", "settings", "results"].includes(name);
    $("#tabbar").hidden = !tabbed;
    for (const t of $$(".tab")) t.setAttribute("aria-current", t.dataset.tab === (TAB_SCREENS[name] ?? "") ? "page" : "false");
    window.scrollTo({ top: 0 });
    const h = $(`#s-${name} h1, #s-${name} h2`);
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  };
  if (document.startViewTransition && !reduceMotion && current) document.startViewTransition(swap); else swap();
  if (replace) history.replaceState({ screen: name }, "");
  else if (push) history.pushState({ screen: name }, "");
  if (name === "journal") renderJournal();
  if (name === "home") startHero(); 
}
window.addEventListener("popstate", (e) => {
  closeSheet(true);
  const name = e.state?.screen || (store.onboarded ? "home" : "onboarding");
  if (name === "analyzing") { history.back(); return; }
  show(name, { push: false });
});

/* ------------------------------------------------------------------ sheet + toast */
function openSheet(html, onMount) {
  const sheet = $("#sheet"), scrim = $("#scrim");
  $("#sheet-content").innerHTML = html;
  hydrateIcons($("#sheet-content"));
  sheet.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => { sheet.classList.add("on"); scrim.classList.add("on"); });
  onMount?.($("#sheet-content"));
  setTimeout(() => $("#sheet-content h2")?.focus?.(), 50);
}
function closeSheet(instant = false) {
  const sheet = $("#sheet"), scrim = $("#scrim");
  if (sheet.hidden) return;
  sheet.classList.remove("on"); scrim.classList.remove("on");
  setTimeout(() => { sheet.hidden = true; scrim.hidden = true; }, instant ? 0 : 380);
}
$("#scrim").addEventListener("click", () => closeSheet());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2400);
}

/* ------------------------------------------------------------------ model status */
// The status line remembers WHAT it says (key + values), so it can be re-drawn in another language.
let statusNow = { kind: "loading", key: "status.preparing", vars: {}, code: "" };
function setStatus(kind, key, vars = {}, code = "") {
  statusNow = { kind, key, vars, code };
  drawStatus();
}
function drawStatus() {
  const el = $("#model-status");
  const { kind, key, vars, code } = statusNow;
  el.className = `status-line ${kind}`;
  if (kind === "error") {
    el.innerHTML = `<span class="dot"></span><span>${t("status.error")}
      <button class="btn-text retry" id="retry-model">${t("status.retry")}</button>.<span class="err-code">${code}</span></span>`;
    $("#retry-model")?.addEventListener("click", warmModel);
  } else {
    el.innerHTML = `<span class="dot"></span><span>${t(key, vars)}</span>`;
  }
}
function warmModel() {
  loadModel((p) => (p < 1 ? setStatus("loading", "status.preparingPct", { p: Math.round(p * 100) }) : setStatus("loading", "status.starting")))
    .then(() => setStatus("", "status.ready"))
    .catch((err) => {
      console.error(err);
      setStatus("error", "", {}, esc(String(err?.name || "Error") + (err?.message ? ": " + err.message : "")).slice(0, 120));
    });
}

/* ------------------------------------------------------------------ photo input + cropper */
$("#btn-camera").addEventListener("click", () => $("#file-camera").click());
$("#btn-gallery").addEventListener("click", () => $("#file-gallery").click());
$("#btn-retake").addEventListener("click", () => history.back());
for (const id of ["#file-camera", "#file-gallery"]) {
  $(id).addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await fileToImage(file);
      state.img = img;
      startCropper(img);
      if (current !== "frame") show("frame");
    } catch (err) { toast(err.message); }
  });
}

const crop = { s0: 1, z: 1, ox: 0, oy: 0, V: 0, iw: 0, ih: 0 };
function startCropper(img) {
  const el = $("#crop-img");
  el.src = img.src;
  crop.iw = img.naturalWidth; crop.ih = img.naturalHeight;
  crop.z = 1; crop.V = 0; $("#zoom").value = "1";
  layoutCropper(true);   // works if already visible; otherwise the ResizeObserver lays it out once shown
}
function layoutCropper(reset = false) {
  const V = $("#cropper").clientWidth;
  if (!V) return;
  const prevCenter = crop.V ? [(crop.V / 2 - crop.ox) / (crop.s0 * crop.z), (crop.V / 2 - crop.oy) / (crop.s0 * crop.z)] : null;
  crop.V = V; crop.s0 = V / Math.min(crop.iw, crop.ih);
  const s = crop.s0 * crop.z;
  if (reset || !prevCenter) { crop.ox = (V - crop.iw * s) / 2; crop.oy = (V - crop.ih * s) / 2; }
  else { crop.ox = V / 2 - prevCenter[0] * s; crop.oy = V / 2 - prevCenter[1] * s; }
  applyCrop();
}
function clampCrop() {
  const s = crop.s0 * crop.z, V = crop.V;
  crop.ox = Math.min(0, Math.max(V - crop.iw * s, crop.ox));
  crop.oy = Math.min(0, Math.max(V - crop.ih * s, crop.oy));
}
function applyCrop() {
  clampCrop();
  const s = crop.s0 * crop.z;
  $("#crop-img").style.transform = `translate(${crop.ox}px, ${crop.oy}px) scale(${s})`;
  scheduleQuality();
}
function zoomAround(newZ, cx, cy) {
  newZ = Math.min(4, Math.max(1, newZ));
  const s1 = crop.s0 * crop.z, s2 = crop.s0 * newZ;
  const ix = (cx - crop.ox) / s1, iy = (cy - crop.oy) / s1;
  crop.z = newZ; crop.ox = cx - ix * s2; crop.oy = cy - iy * s2;
  $("#zoom").value = String(newZ);
  applyCrop();
}
function cropRect() {
  const s = crop.s0 * crop.z;
  return { sx: -crop.ox / s, sy: -crop.oy / s, size: crop.V / s };
}
(() => {
  const el = $("#cropper");
  const pts = new Map();
  let last = null;
  el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); el.classList.add("dragging"); last = null; });
  el.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { crop.ox += e.clientX - prev[0]; crop.oy += e.clientY - prev[1]; applyCrop(); }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = el.getBoundingClientRect();
      const mid = [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top];
      if (last) zoomAround(crop.z * (d / last), mid[0], mid[1]);
      last = d;
    }
  });
  const end = (e) => { pts.delete(e.pointerId); last = null; if (!pts.size) el.classList.remove("dragging"); };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAround(crop.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $("#zoom").addEventListener("input", (e) => zoomAround(Number(e.target.value), crop.V / 2, crop.V / 2));
  new ResizeObserver(() => { if (state.img && el.clientWidth) layoutCropper(!crop.V); }).observe(el);
})();

let qTimer;
function scheduleQuality() {
  clearTimeout(qTimer);
  qTimer = setTimeout(updateQuality, 160);
}
const qText = (p) => [t(`qt.${p}.h`), t(`qt.${p}.p`)];
async function updateQuality() {
  if (!state.img || !crop.V) return;
  const { sx, sy, size } = cropRect();
  const c = cropSquare(state.img, sx, sy, size, 224);
  const q = await checkQuality(c);
  state.lastQuality = q;
  const has = (p) => q.problems.includes(p);
  const chip = (ok, label) => `<span class="chip ${ok ? "ok" : "warn"}">${ok ? icon("check") : icon("alert")}${label}</span>`;
  $("#quality").innerHTML = [
    chip(!has("dark") && !has("bright"), has("dark") ? t("q.dark") : has("bright") ? t("q.bright") : t("q.lighting")),
    chip(!has("blur"), has("blur") ? t("q.blurry") : t("q.focus")),
    chip(!has("skin"), has("skin") ? t("q.skinBad") : t("q.skinOk")),
  ].join("");
  $$("#quality .chip svg").forEach((s) => { s.style.width = "15px"; s.style.height = "15px"; });
}

/* ------------------------------------------------------------------ analyze */
$("#btn-analyze").addEventListener("click", analyze);
async function analyze() {
  if (!crop.V) layoutCropper(true);
  if (!crop.V) return;
  const { sx, sy, size } = cropRect();
  state.crop224 = cropSquare(state.img, sx, sy, size, 224);
  state.cropDisplay = cropSquare(state.img, sx, sy, size, 480).toDataURL("image/jpeg", 0.88);
  state.thumb = cropSquare(state.img, sx, sy, size, 160).toDataURL("image/jpeg", 0.8);
  const q = await checkQuality(state.crop224);
  if (!q.ok) return retakeSheet(q.problems.map(qText), t("rt.cant"));
  $("#scan-img").src = state.cropDisplay;
  const steps = $$("#scan-steps li");
  steps.forEach((li) => (li.className = ""));
  show("analyzing");
  const tick = async (i, work, min) => { steps[i].className = "on"; const [r] = await Promise.all([work, sleep(min)]); steps[i].className = "done"; return r; };
  try {
    await tick(0, Promise.resolve(), 650);
    const result = await tick(1, (async () => { await loadModel(); return classify(state.crop224); })(), 800);
    await tick(2, Promise.resolve(), 600);
    await sleep(250);
    if (current !== "analyzing") return;          // user pressed back during the scan
    state.result = result;
    if (!result.passed) {
      history.back();
      return retakeSheet([[t("rt.unsure.h"), t("rt.unsure.p", { pct: Math.round(result.confidence * 100) })],
        qText("skin"), [t("rt.area.h"), t("rt.area.p")]], t("rt.another"));
    }
    state.answers = {}; state.quizStep = 0; state.saved = false; state.rec = null;
    renderQuiz(0);
    show("quiz", { replace: true });
  } catch (err) {
    console.error(err);
    if (current === "analyzing") history.back();
    toast(t("toast.aiError"));
  }
}
function retakeSheet(items, title) {
  openSheet(`<h2>${esc(title)}</h2><div class="body">${items.map(([h, d]) =>
    `<div class="point"><div class="ico">${icon("alert")}</div><div><h3>${esc(h)}</h3><p>${esc(d)}</p></div></div>`).join("")}</div>
    <div class="stack" style="margin-top:14px"><button class="btn btn-primary" id="rt-new">${icon("camera")}${t("rt.new")}</button>
    <button class="btn btn-text" id="rt-adjust">${t("rt.adjust")}</button></div>`, (root) => {
    $("#rt-new", root).addEventListener("click", () => { $("#file-camera").click(); closeSheet(); });
    $("#rt-adjust", root).addEventListener("click", () => closeSheet());
  });
}

/* ------------------------------------------------------------------ quiz */
// Option VALUES (data-v) stay in English: they feed the rules engine and the journal (Table D).
const LESIONS = [["Blackheads", "Non-inflammatory"], ["Whiteheads", "Non-inflammatory"], ["Papules", "Inflammatory"],
  ["Pustules", "Inflammatory"], ["Nodules", "Inflammatory"], ["Cysts", "Inflammatory"]];
function questions() {
  return [
    { key: "lesion", title: t("q1.title"), note: t("q1.note"), lesion: true,
      options: LESIONS.map(([v, tag]) => ({ v, t: v, d: t(`les.${v}`), tag, img: `assets/img/lesions/${v.toLowerCase()}.svg` })) },
    { key: "skinType", title: t("q2.title"),
      options: ["Oily", "Dry", "Combination", "Normal"].map((v) => ({ v, t: v, d: t(`skin.${v}`) })) },
    { key: "sensitivity", title: t("q3.title"), options: [
      { v: "Resilient", t: "Resilient", d: t("sens.Resilient") },
      { v: "Highly Sensitive", t: "Highly sensitive", d: t("sens.Highly") }] },
    { key: "activeUsage", title: t("q4.title"), note: t("q4.note"), options: [
      { v: "Yes", t: t("act.Yes.t"), d: t("act.Yes.d") },
      { v: "No", t: t("act.No.t"), d: t("act.No.d") }] },
  ];
}
const QCOUNT = 4;
function renderQuiz(step, dir = "fwd") {
  state.quizStep = step;
  const q = questions()[step];
  $("#quiz-count").textContent = t("quiz.count", { n: step + 1, total: QCOUNT });
  $("#quiz-progress").style.width = `${((step + (state.answers[q.key] ? 1 : 0.35)) / QCOUNT) * 100}%`;
  const sel = state.answers[q.key];
  const opts = q.options.map((o) => q.lesion
    ? `<button class="opt lesion" role="radio" aria-checked="${sel === o.v}" data-v="${esc(o.v)}"><img src="${o.img}" alt="" loading="lazy"><span class="tag">${o.tag}</span><span class="t">${o.t}</span><span class="d">${o.d}</span></button>`
    : `<button class="opt" role="radio" aria-checked="${sel === o.v}" data-v="${esc(o.v)}"><span class="t">${o.t}</span><span class="d">${o.d}</span></button>`).join("");
  const notSure = () => (sel === "Not sure" || state.answers[q.key] === "Not sure" ? "✓ " : "") + t("quiz.notsure");
  $("#quiz-body").innerHTML = `<div class="qstep ${dir === "back" ? "back" : ""}">
    <h2>${q.title}</h2>${q.note ? `<p class="small muted" style="margin:0">${q.note}</p>` : ""}
    <div class="options ${q.lesion ? "grid" : ""}" role="radiogroup">${opts}</div>
    ${q.lesion ? `<div style="text-align:center;margin-top:10px"><button class="btn btn-text" data-v="Not sure" id="q-notsure">${notSure()}</button></div>` : ""}
    <div class="quiz-nav"><button class="btn btn-primary" id="q-next" ${sel ? "" : "disabled"}>${step === QCOUNT - 1 ? t("quiz.finish") : t("quiz.next")} ${icon("arrow-right")}</button></div></div>`;
  const pick = (v) => {
    state.answers[q.key] = v;
    $$("#quiz-body .opt").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
    const ns = $("#q-notsure"); if (ns) ns.textContent = notSure();
    $("#q-next").disabled = false;
    $("#quiz-progress").style.width = `${((step + 1) / QCOUNT) * 100}%`;
    if (!q.lesion && step < QCOUNT - 1) setTimeout(() => { if (state.quizStep === step) next(); }, reduceMotion ? 0 : 380);
  };
  $$("#quiz-body .opt").forEach((b) => b.addEventListener("click", () => pick(b.dataset.v)));
  $("#q-notsure")?.addEventListener("click", () => pick("Not sure"));
  $("#q-next").addEventListener("click", next);
}
function next() {
  const step = state.quizStep;
  if (!state.answers[questions()[step].key]) return;
  if (step < QCOUNT - 1) { renderQuiz(step + 1); window.scrollTo({ top: 0 }); }
  else { renderResults(); show("results"); }
}
$("#quiz-back").addEventListener("click", () => { if (state.quizStep > 0) renderQuiz(state.quizStep - 1, "back"); else history.back(); });

/* ------------------------------------------------------------------ results */
// Category names are scientific terms and stay in English in both languages.
const CLASS_INFO = {
  "Clear Skin": { cls: "clear", title: "Clear skin" },
  "Non-Inflammatory": { cls: "noninf", title: "Non-inflammatory acne" },
  "Inflammatory": { cls: "inf", title: "Inflammatory acne" },
};
const ADVICE_REF = {
  "A-01": "AAD 2024 guideline of care for acne vulgaris",
  "A-02": "AAD 2024: severe and nodular acne is treated with prescription options such as oral isotretinoin",
};
function shortEvidence(e) {
  if (/strong recommendation/.test(e)) return "AAD 2024 · strong";
  if (/conditional recommendation/.test(e)) return "AAD 2024 · conditional";
  if (/^International/.test(e)) return "Expert consensus 2024";
  return "General maintenance";
}
function stepCard(n, kindKey, item) {
  if (!item) return `<div class="card step-card none"><div class="num">${n}</div><div><div class="kind">${t(kindKey)}</div>
    <div class="name">${t("none.name")}</div><p>${t("none.p")}</p>
    <div class="meta"><button class="evidence" data-rule="M-02">${icon("leaf")}${t("none.rule")}</button></div></div></div>`;
  return `<div class="card step-card"><div class="num">${n}</div><div><div class="kind">${t(kindKey)}</div>
    <div class="name">${esc(item.name)}</div><p>${esc(ingText(item))}</p>
    <div class="meta"><span class="chip">${esc(item.vehicle)}</span><button class="evidence" data-ing="${item.id}">${icon("leaf")}${esc(shortEvidence(item.evidence))}</button></div></div></div>`;
}
function badgeHTML() {
  const v = state.validation;
  if (v?.status === "validated" && v.doctor_match_rate != null)
    return `<button class="badge validated" data-sheet="validation"><span class="seal">${icon("seal")}</span><span><span class="t">${t("badge.valid.t")}</span><br><span class="s">${t("badge.valid.s", { r: v.doctor_match_rate })}</span></span>${icon("chev-right", "chev")}</button>`;
  return `<button class="badge pending" data-sheet="validation"><span class="seal">${icon("clock")}</span><span><span class="t">${t("badge.pend.t")}</span><br><span class="s">${t("badge.pend.s")}</span></span>${icon("chev-right", "chev")}</button>`;
}
function ruleText(id) { return t(`rule.${id}`); }
function renderResults({ animate = true } = {}) {
  const r = state.result, a = state.answers;
  const info = CLASS_INFO[r.label];
  const rec = recommend({ aiClass: r.label, skinType: a.skinType, sensitivity: a.sensitivity, activeUsage: a.activeUsage, lesion: a.lesion });
  state.rec = rec;
  const pct = Math.round(r.confidence * 100);
  const date = new Date().toLocaleDateString(dateLocale(), { month: "long", day: "numeric", year: "numeric" });
  const adv = rec.advisories.map((id) => `<div class="advisory" role="note"><div class="ico">${icon("doctor")}</div><div><h3>${t(`adv.${id}.h`)}</h3><p>${t(`adv.${id}.p`)}</p><div class="ref">${ADVICE_REF[id]}</div></div></div>`).join("");
  const rules = [...rec.rules, ...rec.advisories];
  $("#results-body").innerHTML = `<div class="${animate ? "reveal" : ""}">
    <div class="topbar"><div><p class="eyebrow" style="margin:0">${t("res.eyebrow")}</p><div class="small muted">${date}</div></div>
      <button class="icon-btn" id="res-new" aria-label="${t("res.new")}">${icon("refresh")}</button></div>
    <div class="result-hero ${info.cls}">
      <div class="top"><div class="thumb"><img src="${state.cropDisplay}" alt="${t("res.photoAlt")}"><div class="frame"><span></span><span></span><span></span><span></span></div></div>
        <div><p class="eyebrow">${t("res.ai")}</p><div class="label">${info.title}</div><p>${t(`cls.${r.label}`)}</p></div></div>
      <div class="meter"><div class="lbl"><span>${t("res.conf")}</span><b id="conf-num">${animate ? 0 : pct}%</b></div><div class="bar"><span id="conf-bar" style="${animate ? "" : `width:${pct}%`}"></span></div></div>
      ${r.leanedToSafety ? `<div class="lean-note">${t("res.lean", { pct })}</div>` : ""}
    </div>
    ${adv}
    <div class="chips" style="margin-top:16px">
      <span class="chip">${t("res.reported", { x: esc(a.lesion === "Not sure" ? t("res.notsure") : a.lesion) })}</span>
    </div>
    <div class="section-title"><h2>${t("res.routine")}</h2></div>
    <p class="small muted" style="margin:-4px 0 12px">${t("res.personal", { skin: esc(a.skinType), sens: t(`res.sens.${a.sensitivity}`), act: t(`res.act.${a.activeUsage}`) })}</p>
    ${stepCard(1, "step.cleanse", rec.cleanser)}
    ${stepCard(2, "step.treat", rec.target)}
    ${stepCard(3, "step.moist", rec.moisturizer)}
    ${badgeHTML()}
    <details class="how"><summary>${t("res.how")}</summary><div class="body">
      ${rules.map((id) => `<div class="rule"><code>${id}</code><span>${id.startsWith("R-") ? t("res.base", { cls: esc(r.label), skin: esc(a.skinType) }) : esc(ruleText(id))}</span></div>`).join("")}
      <div class="rule"><code>AI</code><span>Clear ${Math.round(r.probs[0] * 100)}% · Non-inflammatory ${Math.round(r.probs[1] * 100)}% · Inflammatory ${Math.round(r.probs[2] * 100)}%</span></div>
    </div></details>
    <div class="stack" style="margin-top:20px">
      <button class="btn ${state.saved ? "btn-ghost" : "btn-primary"}" id="res-save">${icon(state.saved ? "check" : "book")}${t(state.saved ? "res.saved" : "res.save")}</button>
      <button class="btn btn-ghost" id="res-again">${icon("camera")}${t("res.again")}</button>
    </div>
    <div class="disclaimer">${t("res.disclaimer")}</div>
  </div>`;
  if (animate) requestAnimationFrame(() => setTimeout(() => {
    $("#conf-bar").style.width = pct + "%";
    const t0 = performance.now(), el = $("#conf-num");
    const stepN = (ts) => { const k = Math.min(1, (ts - t0) / (reduceMotion ? 1 : 1100)); el.textContent = Math.round(pct * (1 - Math.pow(1 - k, 3))) + "%"; if (k < 1) requestAnimationFrame(stepN); };
    requestAnimationFrame(stepN);
  }, 200));
  $$("#results-body [data-ing]").forEach((b) => b.addEventListener("click", () => {
    const all = [rec.cleanser, rec.target, rec.moisturizer].filter(Boolean);
    const it = all.find((x) => x.id === b.dataset.ing);
    openSheet(`<h2>${esc(it.name)}</h2><div class="body"><p><b>${t("ing.why")}</b> ${esc(ingText(it))}</p><p><b>${t("ing.evidence")}</b> ${esc(it.evidence)}</p>
      <p class="small muted">${t("ing.levels")}</p><div class="cite">${esc(it.ref)}</div>
      <p class="small muted" style="margin-top:12px">${t("ing.id", { id: it.id })}</p></div>
      <button class="btn btn-primary" style="margin-top:8px" id="sh-close">${t("common.gotit")}</button>`, (root) => $("#sh-close", root).addEventListener("click", () => closeSheet()));
  }));
  $$("#results-body [data-rule]").forEach((b) => b.addEventListener("click", () => openSheet(`<h2>${t("none.rule")}</h2><div class="body"><p>${esc(ruleText("M-02"))}</p><p>${t("m02.extra")}</p><div class="cite">${esc(AAD_2024)}</div></div><button class="btn btn-primary" style="margin-top:12px" id="sh-close">${t("common.gotit")}</button>`, (root) => $("#sh-close", root).addEventListener("click", () => closeSheet()))));
  $("#results-body [data-sheet='validation']").addEventListener("click", () => sheets.validation());
  $("#res-save").addEventListener("click", saveSheet);
  $("#res-again").addEventListener("click", newCheck);
  $("#res-new").addEventListener("click", newCheck);
}
function newCheck() { show("home"); }

/* ------------------------------------------------------------------ journal */
const ROUTINE = ["Yes", "Partially", "No", "First check"];   // stored values stay in English (Table D)
function saveSheet() {
  if (state.saved) return toast(t("toast.already"));
  const ans = { routine: null, irritation: null };
  openSheet(`<h2>${t("sv.title")}</h2><div class="body"><p class="small">${t("sv.intro")}</p>
    <div class="field-label">${t("sv.q1")}</div>
    <div class="seg" id="sv-routine">${ROUTINE.map((v) => `<button aria-pressed="false" data-v="${v}">${t(`rf.${v}`)}</button>`).join("")}</div>
    <div class="field-label">${t("sv.q2")}</div>
    <div class="seg five" id="sv-irr">${[1, 2, 3, 4, 5].map((v) => `<button aria-pressed="false" data-v="${v}">${v}</button>`).join("")}</div>
    <div class="row tiny muted" style="justify-content:space-between;margin-top:6px"><span>${t("sv.none")}</span><span>${t("sv.severe")}</span></div>
    <label class="row small" style="margin-top:16px;gap:10px"><input type="checkbox" id="sv-photo" checked style="width:20px;height:20px;flex:none;accent-color:var(--btn)"> ${t("sv.photo")}</label>
    </div><div class="stack" style="margin-top:16px"><button class="btn btn-primary" id="sv-save" disabled>${icon("check")}${t("sv.save")}</button></div>`, (root) => {
    const upd = () => { $("#sv-save", root).disabled = !(ans.routine && ans.irritation); };
    for (const [sel, key] of [["#sv-routine", "routine"], ["#sv-irr", "irritation"]]) {
      $$(sel + " button", root).forEach((b) => b.addEventListener("click", () => {
        $$(sel + " button", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        ans[key] = b.dataset.v; upd();
      }));
    }
    $("#sv-save", root).addEventListener("click", async () => {
      const r = state.result, a = state.answers, rec = state.rec;
      try {
        await addEntry({
          date: new Date().toISOString(), aiResult: r.label, confidence: r.confidence, skinType: a.skinType, sensitivity: a.sensitivity,
          activeUsage: a.activeUsage, lesion: a.lesion, routineFollowed: ans.routine, irritation: Number(ans.irritation),
          rules: [...rec.rules, ...rec.advisories], cleanser: rec.cleanser.name, target: rec.target ? rec.target.name : "None (M-02)",
          moisturizer: rec.moisturizer.name, thumb: $("#sv-photo", root).checked ? state.thumb : null,
        });
        state.saved = true; closeSheet(); toast(t("toast.saved"));
        const b = $("#res-save"); if (b) { b.innerHTML = `${icon("check")}${t("res.saved")}`; b.classList.replace("btn-primary", "btn-ghost"); }
      } catch { toast(t("toast.saveFail")); }
    });
  });
}
const CLS = { "Clear Skin": "c-clear", "Non-Inflammatory": "c-noninf", "Inflammatory": "c-inf" };
async function renderJournal() {
  let entries = [];
  try { entries = await allEntries(); } catch {}
  const list = $("#journal-list");
  $("#journal-actions").hidden = !entries.length;
  if (!entries.length) {
    list.innerHTML = `<div class="card empty">${icon("book")}<h3 style="color:var(--ink)">${t("jr.empty.h")}</h3><p class="small">${t("jr.empty.p")}</p></div>`;
    return;
  }
  list.innerHTML = `<div class="stack reveal">${entries.map((e) => `<div class="card entry">
    <div class="th">${e.thumb ? `<img src="${e.thumb}" alt="">` : icon("image")}</div>
    <div><div class="when">${new Date(e.date).toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
      <div class="what"><span class="tl-dot ${CLS[e.aiResult]}"></span>${esc(e.aiResult)}</div>
      <div class="tiny muted">${t("jr.line", { skin: esc(e.skinType), r: esc(t(`rf.${e.routineFollowed}`)), i: e.irritation })}</div></div>
    <button class="del" data-id="${e.id}" aria-label="${t("jr.del")}">${icon("trash")}</button></div>`).join("")}</div>`;
  $$("#journal-list .del").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(t("jr.confirm"))) return;
    await deleteEntry(Number(b.dataset.id)); renderJournal();
  }));
}
$("#btn-export").addEventListener("click", async () => {
  const entries = await allEntries();
  if (!entries.length) return toast(t("toast.emptyJournal"));
  const name = "AcneLens_Journey_Log.csv";
  const blob = new Blob([toCSV(entries)], { type: "text/csv" });
  const file = new File([blob], name, { type: "text/csv" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "AcneLens journal" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(t("toast.exported"));
});

/* ------------------------------------------------------------------ settings sheets */
// Landis & Koch agreement levels are scientific terms and stay in English.
const kappaWord = (k) => k < 0 ? "Poor" : k <= 0.2 ? "Slight" : k <= 0.4 ? "Fair" : k <= 0.6 ? "Moderate" : k <= 0.8 ? "Substantial" : "Almost perfect";
const doneBtn = () => `<button class="btn btn-primary" style="margin-top:16px" data-close>${t("common.done")}</button>`;
const mount = (root) => $$("[data-close]", root).forEach((b) => b.addEventListener("click", () => closeSheet()));
const point = (ic, h, p) => `<div class="point"><div class="ico">${ic.length > 2 ? icon(ic) : ic}</div><div><h3>${h}</h3><p>${p}</p></div></div>`;
const sheets = {
  how: () => openSheet(`<h2>${t("how.title")}</h2><div class="body">
    ${point("scan", t("how.1.h"), t("how.1.p"))}
    ${point("image", t("how.2.h"), t("how.2.p", { g: Math.round((window.__cfg?.gate ?? 0.5) * 100) }))}
    ${point("user", t("how.3.h"), t("how.3.p"))}
    ${point("doctor", t("how.4.h"), t("how.4.p"))}
    <p class="small muted">${t("how.foot")}</p></div>${doneBtn()}`, mount),
  validation: () => {
    const v = state.validation || {};
    const tt = v.technical_test || {};
    const derm = v.status === "validated" && v.doctor_match_rate != null
      ? `<div class="metric"><span class="k">Doctor Match Rate</span><span class="v">${v.doctor_match_rate}%</span><span class="x">${t("val.dmr.x", { across: v.images_reviewed ? t("val.across", { n: v.images_reviewed }) : "" })}</span></div>
         <div class="metric"><span class="k">Verified Agreement Score</span><span class="v">${Number(v.verified_agreement_score).toFixed(2)}</span><span class="x">${t("val.vas.x", { word: kappaWord(Number(v.verified_agreement_score)) })}</span></div>
         <p class="small muted">${esc(v.reviewer || t("val.reviewer"))}${v.date ? ` · ${esc(v.date)}` : ""}. ${t("val.blind")}</p>`
      : `<div class="advisory amber"><div class="ico">${icon("clock")}</div><div><h3>${t("badge.pend.t")}</h3><p>${t("val.pend.p")}</p></div></div>`;
    const caught = String(tt.inflammatory_caught ?? "—").replace(" of ", ` ${t("val.of")} `);
    openSheet(`<h2>${t("val.title")}</h2><div class="body">
      ${derm}
      <div class="list-label" style="margin-top:22px">${t("val.tech")}</div>
      <div class="metric"><span class="k">${t("val.acc.k")}</span><span class="v">${tt.accuracy ?? "—"}%</span><span class="x">${t("val.acc.x", { n: tt.images ?? "—" })}</span></div>
      <div class="metric"><span class="k">${t("val.inf.k")}</span><span class="v">${caught}</span><span class="x">${t("val.inf.x")}</span></div>
      <div class="metric"><span class="k">${t("val.kap.k")}</span><span class="v">${tt.kappa != null ? Number(tt.kappa).toFixed(2) : "—"}</span><span class="x">${t("val.kap.x")}</span></div>
      <p class="small muted">${t("val.why")}</p>
      <p class="small">${t("val.guide")}</p></div>${doneBtn()}`, mount);
  },
  refs: () => openSheet(`<h2>${t("refs.title")}</h2><div class="body"><p class="small">${t("refs.p")}</p>
    <div class="cite">${esc(AAD_2024)}</div><div class="cite" style="margin-top:10px">${esc(JEADV_2024)}</div></div>${doneBtn()}`, mount),
  privacy: () => openSheet(`<h2>${t("priv.title")}</h2><div class="body">
    ${point("lock", t("priv.1.h"), t("priv.1.p"))}${point("book", t("priv.2.h"), t("priv.2.p"))}${point("trash", t("priv.3.h"), t("priv.3.p"))}</div>${doneBtn()}`, mount),
  install: () => openSheet(installHTML(), (root) => { mount(root); $("#do-install", root)?.addEventListener("click", promptInstall); }),
  disclaimer: () => openSheet(`<h2>${t("disc.title")}</h2><div class="body"><p>${t("disc.1")}</p><p>${t("disc.2")}</p><p>${t("disc.3")}</p></div>${doneBtn()}`, mount),
  credits: () => openSheet(`<h2>${t("cred.title")}</h2><div class="body small">
    <p><b>${t("cred.train")}</b> ${t("cred.train.note")}: Acne Dataset Image (Tiswan, Universitas Perjuangan Tasikmalaya; Apache-2.0) · ACNE04 (Wu et al., ICCV 2019) · Flickr-Faces-HQ (Karras et al., CVPR 2019; NVIDIA, CC BY-NC-SA 4.0), via the Kaggle mirror “FFHQ small” by tommykamaz.</p>
    <p><b>${t("cred.test")}</b> Skin Condition Image Network (SCIN), Google Research, SCIN Data Use License. ${t("cred.test.note")}</p>
    <p><b>${t("cred.model")}</b> EfficientNetV2-B0 (Tan &amp; Le, 2021) ImageNet weights via Keras Applications (Apache-2.0). ONNX Runtime Web (MIT License).</p>
    <p><b>${t("cred.fonts")}</b> Instrument Serif, Manrope (SIL Open Font License).</p>
    <p><b>${t("cred.art")}</b> ${t("cred.art.note")}</p></div>${doneBtn()}`, mount),
};
$$("[data-sheet]").forEach((b) => b.addEventListener("click", () => sheets[b.dataset.sheet]()));
$("#btn-reset").addEventListener("click", async () => {
  if (!confirm(t("set.resetConfirm"))) return;
  try { await clearAll(); localStorage.clear(); } catch {}
  toast(t("toast.deleted"));
  setTimeout(() => location.reload(), 900);
});

/* ------------------------------------------------------------------ install */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some((m) => matchMedia(`(display-mode: ${m})`).matches)
  || navigator.standalone === true || document.referrer.startsWith("android-app://");
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.installEvent = e; if (!standalone) $("#install-chip").hidden = false; });
window.addEventListener("appinstalled", () => { $("#install-chip").hidden = true; toast(t("toast.installed")); });
if (isIOS && !standalone) $("#install-chip").hidden = false;
$("#install-chip").addEventListener("click", () => (state.installEvent ? promptInstall() : sheets.install()));
async function promptInstall() {
  if (!state.installEvent) return sheets.install();
  state.installEvent.prompt();
  await state.installEvent.userChoice.catch(() => {});
  state.installEvent = null; $("#install-chip").hidden = true; closeSheet();
}
function installHTML() {
  if (standalone) return `<h2>${t("inst.done.h")}</h2><div class="body"><p>${t("inst.done.p")}</p></div>${doneBtn()}`;
  if (isIOS) return `<h2>${t("inst.ios.h")}</h2><div class="body">
    ${point("1", t("inst.ios.1.h"), t("inst.ios.1.p"))}${point("share", t("inst.ios.2.h"), t("inst.ios.2.p"))}${point("3", t("inst.ios.3.h"), t("inst.ios.3.p"))}</div>${doneBtn()}`;
  return `<h2>${t("inst.and.h")}</h2><div class="body">
    ${state.installEvent ? `<button class="btn btn-coral" id="do-install">${icon("download")}${t("inst.and.btn")}</button>` : ""}
    ${point("1", t("inst.and.1.h"), t("inst.and.1.p"))}${point("2", t("inst.and.2.h"), t("inst.and.2.p"))}</div>${doneBtn()}`;
}

/* ------------------------------------------------------------------ language + appearance */
function syncPressed() {
  const l = getLang();
  $$(".lang-toggle button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === l)));
  $$("#seg-lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === l)));
  $$("#seg-theme button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === store.theme)));
}
/** Redraw everything that shows text, in the current language. */
function localize() {
  applyStatic();
  $("#app-version").textContent = t("set.version", { v: VERSION, d: MODEL_DATE });
  drawStatus();
  syncPressed();
  if (state.img && current === "frame") scheduleQuality();
  if (state.answers && state.result && state.quizStep != null && current === "quiz") renderQuiz(state.quizStep);
  if (state.rec) renderResults({ animate: false });
  if (current === "journal") renderJournal();
}
function chooseLang(l) { if (l === getLang()) return; setLang(l); localize(); }
$$(".lang-toggle button").forEach((b) => b.addEventListener("click", () => chooseLang(b.dataset.lang)));
$$("#seg-lang button").forEach((b) => b.addEventListener("click", () => chooseLang(b.dataset.v)));
function applyTheme(mode) {
  store.theme = mode;
  if (mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
  else document.documentElement.removeAttribute("data-theme");
  syncPressed();
}
$$("#seg-theme button").forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.v)));

/* ------------------------------------------------------------------ boot */
$$(".tab").forEach((tb) => tb.addEventListener("click", () => { if (current !== tb.dataset.tab) show(tb.dataset.tab); }));
$$("[data-back]").forEach((b) => b.addEventListener("click", () => history.back()));
$("#ob-continue").addEventListener("click", () => { store.onboarded = true; show("home", { replace: true }); warmModel(); });
hydrateIcons();
localize();

/* ------------------------------------------------------------------ home hero: a magnifier roaming over skin */
// Deterministic "skin": pores everywhere, more spots on the left, clearer on the right (the logo's idea).
function buildHeroSkin() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const feats = [];
  for (let i = 0; i < 70; i++) feats.push(["pore", rnd() * 100, rnd() * 100, 1.1 + rnd() * 0.8]);
  const spots = [["pap", 16, 30, 7], ["pus", 27, 58, 8], ["pap", 12, 72, 6], ["pap", 34, 22, 5.5], ["pus", 40, 80, 6.5],
    ["bh", 22, 44, 2.4], ["bh", 30, 40, 2], ["bh", 47, 36, 2.2], ["bh", 52, 64, 1.8], ["wh", 58, 26, 3.4], ["wh", 44, 56, 3],
    ["wh", 64, 74, 2.8], ["bh", 70, 48, 1.6], ["pap", 8, 46, 5], ["wh", 20, 88, 3]];
  feats.push(...spots);
  const html = feats.map(([k, x, y, w]) => `<i class="feat ${k}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${w}%"></i>`).join("");
  $("#hero-skin").innerHTML = html;
  $("#hero-skin-clone").innerHTML = html;
}
let heroRAF = 0, heroT0 = 0, heroL = 0;
function heroFrame(ts) {
  const hero = $("#lens-hero");
  if (current !== "home" || document.hidden || !hero) { heroRAF = 0; return; }
  const W = hero.clientWidth, H = hero.clientHeight;
  if (W && H) {
    const mag = $("#hero-mag"), clone = $("#hero-skin-clone");
    const L = Math.round(Math.min(W, H) * 0.5);
    if (L !== heroL) { heroL = L; mag.style.setProperty("--L", L + "px"); clone.style.width = W + "px"; clone.style.height = H + "px"; }
    if (!heroT0) heroT0 = ts;
    const t = reduceMotion ? 2 : (ts - heroT0) / 1000;
    const x = W * (0.46 + 0.27 * Math.sin(t * 0.42)), y = H * (0.46 + 0.17 * Math.sin(t * 0.61 + 1.1));
    const zoom = 1.9;
    mag.style.transform = `translate(${(x - L / 2).toFixed(1)}px, ${(y - L / 2).toFixed(1)}px)`;
    clone.style.transform = `translate(${(L / 2 - x * zoom).toFixed(1)}px, ${(L / 2 - y * zoom).toFixed(1)}px) scale(${zoom})`;
    if (reduceMotion) { heroRAF = 0; return; }
  }
  heroRAF = requestAnimationFrame(heroFrame);
}
function startHero() { if (!heroRAF) heroRAF = requestAnimationFrame(heroFrame); }
document.addEventListener("visibilitychange", () => { if (!document.hidden && current === "home") startHero(); });
window.addEventListener("resize", () => { heroL = 0; });
buildHeroSkin();

/* ------------------------------------------------------------------ opening animation */
function runSplash() {
  const sp = $("#splash");
  let done = false;
  const finish = () => { sp.remove(); document.body.classList.remove("booting"); };
  const exit = () => {
    if (done) return;
    done = true;
    if (reduceMotion) { sp.style.transition = "opacity .35s"; sp.style.opacity = "0"; setTimeout(finish, 380); return; }
    sp.classList.add("exit");
    // The app opens out of the lens: a circular reveal centred on the magnifier's glass.
    const m = sp.querySelector(".sp-mark").getBoundingClientRect();
    const k = m.width / 392;                          // viewBox is 392 units wide (60..452)
    const cx = m.left + (220 - 60) * k, cy = m.top + (220 - 60) * k, r = 112 * k;
    const app = $("#app"), a = app.getBoundingClientRect();
    const x = cx - a.left, y = cy - a.top;
    const R = Math.hypot(Math.max(x, a.width - x), Math.max(y, a.height - y)) + 24;
    app.classList.add("revealing");
    app.style.webkitClipPath = app.style.clipPath = `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    app.getBoundingClientRect();
    requestAnimationFrame(() => {
      app.style.transition = "clip-path .85s cubic-bezier(.65,0,.35,1), -webkit-clip-path .85s cubic-bezier(.65,0,.35,1)";
      app.style.webkitClipPath = app.style.clipPath = `circle(${R.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    });
    setTimeout(() => {
      finish();
      app.classList.remove("revealing");
      app.style.webkitClipPath = app.style.clipPath = app.style.transition = "";
    }, 900);
  };
  sp.addEventListener("click", exit);
  setTimeout(exit, reduceMotion ? 700 : 2300);
}

async function boot() {
  getConfig().then((c) => { window.__cfg = c; }).catch(() => {});
  fetch("validation.json", { cache: "no-cache" }).then((r) => r.json()).then((v) => { state.validation = v; }).catch(() => {});
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    // A new version was published: once its service worker takes control, reload once so the
    // fixed files are used right away instead of on the following launch.
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});
  const first = store.onboarded ? "home" : "onboarding";
  show(first, { replace: true });
  if (store.onboarded) warmModel();
  runSplash();
}
boot();
