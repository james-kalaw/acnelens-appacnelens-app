// Layout audit: walks every screen on several phone sizes and reports
//  - visible elements that overlap each other (excluding parent/child pairs and decorative layers)
//  - anything wider than the screen (horizontal scrolling)
//  - content that ends up hidden behind the bottom tab bar when scrolled to the end
//  - the main "Take a photo" button must be visible on the home screen without scrolling
// Usage: node tests/layout-audit.cjs http://127.0.0.1:8765/ skin-photo.jpg [SCREENSHOT_DIR]
// Env: LANGS=en,fil  THEMES=light,dark  DEVICES="iPhone SE,Pixel 7"  (defaults: every combination, 4 devices)
const { chromium, devices } = require("playwright");

const AUDIT = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const root = document.querySelector(".sheet.on") || document.querySelector(".screen.active");
  const sel = "h1,h2,h3,p,button,img,input,label,.chip,.tip,.opt,.card,.status-line,.lens-hero,.cropper,.scan,.result-hero,.advisory,.badge,details,.meter,.progress,.metric,.point,.entry,.list-item,.eyebrow,.lead,.disclaimer,.zoom,.steps li";
  const els = [...root.querySelectorAll(sel)].filter((e) => vis(e) && !e.closest("[aria-hidden='true']"));
  const issues = [];
  const name = (e) => (e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/)[0] : "")) + ` "${(e.textContent || e.alt || "").trim().slice(0, 28)}"`;
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (w > 2 && h > 2) issues.push(`overlap: ${name(a)}  ×  ${name(b)}  (${Math.round(w)}×${Math.round(h)}px)`);
  }
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
  for (const e of els) { const r = e.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) issues.push(`off-screen horizontally: ${name(e)} (${Math.round(r.left)}..${Math.round(r.right)})`); }
  return issues;
};
const TABBAR = async (page) => page.evaluate(async () => {
  const tb = document.querySelector("#tabbar"); if (!tb || tb.hidden || document.querySelector(".sheet.on")) return [];
  window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 250));
  const top = tb.getBoundingClientRect().top;
  const els = [...document.querySelectorAll(".screen.active button, .screen.active .card, .screen.active p, .screen.active .disclaimer, .screen.active .list")]
    .filter((e) => e.getBoundingClientRect().height > 0 && !e.closest("[aria-hidden='true']"));
  const last = els.reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
  window.scrollTo(0, 0);
  return last > top - 4 ? [`content hidden behind tab bar: last content bottom ${Math.round(last)} > tab bar top ${Math.round(top)}`] : [];
});

(async () => {
  const [, , url, photo, shots] = process.argv;
  const b = await chromium.launch();
  let total = 0;
  const DEVS = (process.env.DEVICES || "iPhone SE,Pixel 7,iPhone 14 Pro Max,Desktop").split(",");
  const combos = [];
  for (const dev of DEVS) for (const lang of (process.env.LANGS || "en,fil").split(",")) for (const theme of (process.env.THEMES || "light,dark").split(",")) combos.push([dev, lang, theme]);
  for (const [dev, lang, theme] of combos) {
    const base = dev === "Desktop" ? { viewport: { width: 1280, height: 800 } } : { ...devices[dev] };
    const ctx = await b.newContext({ ...base, colorScheme: theme }); const page = await ctx.newPage();
    await page.addInitScript((l) => { try { localStorage.setItem("acnelens.lang", l); } catch {} }, lang);
    const tagName = `${dev.replace(/\s/g, "")}-${lang}-${theme}`;
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    const out = [];
    const check = async (label) => {
      await page.waitForTimeout(700);
      const iss = [...(await page.evaluate(AUDIT)), ...(await TABBAR(page))];
      out.push(...iss.map((x) => `  [${label}] ${x}`));
      if (shots) await page.screenshot({ path: `${shots}/${tagName}-${label}.png` });
    };
    await page.goto(url); await page.click("#splash"); await page.waitForSelector("#splash", { state: "detached" });
    await check("onboarding");
    await page.click("#ob-continue"); await page.waitForFunction(() => (() => { const el = document.querySelector("#model-status"); return !el.classList.contains("loading") && !el.classList.contains("error"); })(), null, { timeout: 120000 });
    await check("home");
    const fold = await page.evaluate(() => { const b = document.querySelector("#btn-camera").getBoundingClientRect(), t = document.querySelector("#tabbar").getBoundingClientRect();
      return { bottom: Math.round(b.bottom), limit: Math.round(Math.min(t.top, innerHeight) - 8) }; });
    if (fold.bottom > fold.limit) out.push(`  [home] "Take a photo" is below the fold / behind the tab bar (${fold.bottom} > ${fold.limit})`);
    await page.setInputFiles("#file-gallery", photo); await page.waitForSelector("#s-frame.active"); await check("frame");
    await page.click("#btn-analyze"); await page.waitForSelector("#s-analyzing.active"); await check("analyzing");
    await page.waitForSelector("#s-quiz.active", { timeout: 30000 }); await check("quiz1");
    await page.click('.opt[data-v="Cysts"]'); await page.click("#q-next"); await check("quiz2");
    await page.click('.opt[data-v="Combination"]'); await page.waitForTimeout(600);
    await page.click('.opt[data-v="Highly Sensitive"]'); await page.waitForTimeout(600); await check("quiz4");
    await page.click('.opt[data-v="Yes"]'); await page.click("#q-next"); await page.waitForSelector("#s-results.active"); await check("results");
    await page.click("#res-save"); await check("sheet-save");
    await page.click('#sv-routine button[data-v="Partially"]'); await page.click('#sv-irr button[data-v="2"]'); await page.click("#sv-save");
    await page.waitForTimeout(600); await page.click('.tab[data-tab="journal"]'); await check("journal");
    await page.click('.tab[data-tab="settings"]'); await check("settings");
    for (const sh of ["how", "validation", "credits", "install"]) { await page.click(`#s-settings [data-sheet="${sh}"]`); await check("sheet-" + sh); await page.keyboard.press("Escape"); await page.waitForTimeout(450); }
    console.log(`${tagName}: ${out.length} issue(s)${errs.length ? ", JS errors: " + errs.join(" | ") : ""}`); out.forEach((x) => console.log(x));
    total += out.length + errs.length;
    await ctx.close();
  }
  await b.close();
  process.exitCode = total ? 1 : 0;
})();
