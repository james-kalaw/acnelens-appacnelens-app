// AcneLens service worker: makes the app installable and fully usable offline.
// App files + AI model are cached on first visit. validation.json is always
// fetched fresh when online so badge updates appear immediately.
const VERSION = "acnelens-v2.1.0";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "assets/css/app.css", "assets/js/app.js", "assets/js/analyzer.js", "assets/js/rules.js", "assets/js/journal.js",
  "assets/fonts/instrument-serif-latin-400-normal.woff2", "assets/fonts/instrument-serif-latin-400-italic.woff2", "assets/fonts/manrope-latin-wght-normal.woff2",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/apple-touch-icon.png", "assets/icons/favicon.svg",
  "assets/icons/wordmark-dark.svg", "assets/icons/wordmark-light.svg",
  "assets/img/lesions/blackheads.svg", "assets/img/lesions/whiteheads.svg", "assets/img/lesions/papules.svg",
  "assets/img/lesions/pustules.svg", "assets/img/lesions/nodules.svg", "assets/img/lesions/cysts.svg",
  "model/model_config.json", "validation.json",
];
const HEAVY = ["model/acnelens.onnx", "assets/vendor/ort/ort.wasm.min.js", "assets/vendor/ort/ort-wasm-simd-threaded.js", "assets/vendor/ort/ort-wasm-simd-threaded.wasm"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // the big files are fetched in the background; failures here are retried on first use
    c.addAll(HEAVY).catch(() => {});
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/validation.json")) {           // network first
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  if (e.request.mode === "navigate") {                         // app page: network first, offline fallback
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put("index.html", cp)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  const heavy = HEAVY.some((h) => url.pathname.endsWith(h));
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const refresh = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { if (!heavy) refresh.catch(() => {}); return hit; }   // stale-while-revalidate (big files: cache-first)
    return refresh;
  }));
});
