// Checks the English/Filipino text table (docs/assets/js/i18n.js).
// Run: node tests/i18n.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.localStorage = { getItem: () => null, setItem() {} };
Object.defineProperty(globalThis, "navigator", { value: { languages: ["en-US"] }, configurable: true });
globalThis.document = { documentElement: {} };
const { STR } = await import("../docs/assets/js/i18n.js");
const { INGREDIENTS, RULE_TEXT } = await import("../docs/assets/js/rules.js");

const en = STR.en, fil = STR.fil;
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const tags = (s) => [...s.matchAll(/<\/?(b|em|i)>/g)].map((m) => m[0]).sort().join("");
let n = 0;
for (const k of Object.keys(en)) {
  assert.ok(k in fil, `Filipino is missing "${k}"`);
  assert.equal(ph(fil[k]), ph(en[k]), `placeholders differ for "${k}"`);
  assert.equal(tags(fil[k]), tags(en[k]), `bold/italic markup differs for "${k}"`);
  n++;
}
for (const k of Object.keys(fil)) if (!k.startsWith("ing.T") && !k.startsWith("ing.C") && !k.startsWith("ing.M")) assert.ok(k in en, `English is missing "${k}"`);
// every ingredient has a Filipino explanation; English rule texts match the rules engine
for (const id of Object.keys(INGREDIENTS)) assert.ok(fil["ing." + id], `no Filipino text for ${id}`);
for (const id of Object.keys(RULE_TEXT)) assert.equal(en["rule." + id], RULE_TEXT[id], `rule.${id} differs from rules.js`);
// every key used by the app exists
const src = readFileSync(new URL("../docs/assets/js/app.js", import.meta.url), "utf8") + readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const used = new Set([...src.matchAll(/\bt\("([^"$]+)"/g), ...src.matchAll(/data-i18n(?:-aria|-alt)?="([^"]+)"/g)].map((m) => m[1]));
for (const k of used) assert.ok(k in en, `app uses unknown key "${k}"`);
// keys built from values: lesions, skin types, routine answers, advisories, classes
for (const v of ["Blackheads", "Whiteheads", "Papules", "Pustules", "Nodules", "Cysts"]) assert.ok(`les.${v}` in en);
for (const v of ["Oily", "Dry", "Combination", "Normal"]) assert.ok(`skin.${v}` in en);
for (const v of ["Yes", "Partially", "No", "First check"]) assert.ok(`rf.${v}` in en);
for (const v of ["Clear Skin", "Non-Inflammatory", "Inflammatory"]) assert.ok(`cls.${v}` in en);
for (const v of ["A-01", "A-02"]) assert.ok(`adv.${v}.h` in en && `adv.${v}.p` in en);
console.log(`OK — ${n} texts in English and Filipino; ${used.size} keys used by the app all exist; placeholders and markup match`);
