// Renders every recommendation rule straight from docs/assets/js/rules.js (so the
// printout can never drift from the app) into validation/AcneLens_Recommendation_Rules.html.
// Then: node validation/pdf.cjs validation/AcneLens_Recommendation_Rules.html validation/AcneLens_Recommendation_Rules.pdf
import { recommend, INGREDIENTS, RULE_TEXT, AAD_2024, JEADV_2024 } from "../docs/assets/js/rules.js";
import { writeFileSync } from "node:fs";
const ai = ["Non-Inflammatory", "Inflammatory", "Clear Skin"], skin = ["Oily", "Dry", "Combination", "Normal"];
const name = (x) => x ? `${x.name} <span class="id">${x.id}</span>` : "<i>none</i>";
let base = "";
for (const a of ai) for (const s of skin) {
  const r = recommend({ aiClass: a, skinType: s, sensitivity: "Resilient", activeUsage: "No" });
  base += `<tr><td><b>${r.rules[0]}</b></td><td>${a}</td><td>${s}</td><td>${name(r.cleanser)}</td><td>${name(r.target)}</td><td>${name(r.moisturizer)}</td><td class="lik">1 2 3 4 5</td></tr>`;
}
const ing = Object.entries(INGREDIENTS).map(([id, x]) => `<tr><td><b>${id}</b></td><td>${x.name}</td><td>${x.vehicle}</td><td>${x.mechanism}</td><td>${x.evidence}</td></tr>`).join("");
const mods = ["M-01", "M-02", "F-00", "A-01", "A-02"].map((k) => `<tr><td><b>${k}</b></td><td>${RULE_TEXT[k]}</td><td class="lik">1 2 3 4 5</td></tr>`).join("");
const html = `<!doctype html><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Helvetica,Arial,sans-serif;color:#16363B;font-size:9.5pt}
h1{font-size:17pt;margin:0 0 4pt}h2{font-size:12pt;margin:12pt 0 4pt}table{width:100%;border-collapse:collapse;margin-bottom:6pt}
td,th{border:1px solid #bbb;padding:3.5pt 5pt;vertical-align:top}th{background:#16363B;color:#fff;text-align:left}.id{color:#C4573F;font-size:8pt}
.lik{white-space:nowrap;letter-spacing:4pt;text-align:center}.note{color:#5F7376}.ref{font-size:8.5pt;color:#3D5B5F}</style>
<h1>AcneLens — Recommendation Rules for Expert Review</h1>
<p class="note">Generated from the app's own rule code. Rate the appropriateness of each rule (1 = strongly disagree … 5 = strongly agree) and note any change you would recommend. Ingredients only — no brands are ever suggested.</p>
<h2>Table C1 — Base rules (AI result × skin type), shown for a resilient user not on any treatment</h2>
<table><tr><th>Rule</th><th>AI result</th><th>Skin type</th><th>Cleanser</th><th>Target treatment</th><th>Moisturizer</th><th>Appropriate?</th></tr>${base}</table>
<h2>Table C2 — Modifiers, fallback and referral notices (applied on top of the base rule)</h2>
<table><tr><th>Rule</th><th>Effect</th><th>Appropriate?</th></tr>${mods}</table>
<p class="note">Order: base rule → M-01 (sensitivity) → M-02 (current treatment; applied last, so it wins: no new active is added even if M-01 suggested azelaic acid). A-01/A-02 only display advice; they never change ingredients. Together these cover all 48 combinations (3 AI results × 4 skin types × 2 sensitivity levels × 2 treatment states).</p>
<h2 style="break-before:page">Table B — Ingredients and evidence</h2>
<table><tr><th>ID</th><th>Ingredient</th><th>Vehicle</th><th>What it does</th><th>Evidence</th></tr>${ing}</table>
<p class="ref">${AAD_2024}<br>${JEADV_2024}</p>
<h2>Comments / suggested changes</h2><div style="border:1px solid #bbb;height:70pt"></div>`;
writeFileSync(new URL("./AcneLens_Recommendation_Rules.html", import.meta.url), html);
console.log("rules html written");
