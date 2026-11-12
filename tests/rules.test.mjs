// Exhaustive check of docs/assets/js/rules.js against the technical plan
// (Table C1 base rules, Table C2 modifiers). Run: node tests/rules.test.mjs
import { recommend, INGREDIENTS } from "../docs/assets/js/rules.js";
import assert from "node:assert/strict";

// Table C1 transcribed independently from the paper: [cleanser, target, moisturizer]
const C1 = {
  "Non-Inflammatory": { Oily: ["CLN-01","TGT-02","MST-01"], Dry: ["CLN-02","TGT-03","MST-02"], Combination: ["CLN-01","TGT-02","MST-03"], Normal: ["CLN-03","TGT-02","MST-03"] },
  "Inflammatory":     { Oily: ["CLN-01","TGT-01","MST-01"], Dry: ["CLN-02","TGT-01","MST-02"], Combination: ["CLN-01","TGT-01","MST-03"], Normal: ["CLN-03","TGT-01","MST-03"] },
  "Clear Skin":       { Oily: ["CLN-03","TGT-05","MST-01"], Dry: ["CLN-03","TGT-05","MST-02"], Combination: ["CLN-03","TGT-05","MST-03"], Normal: ["CLN-03","TGT-05","MST-03"] },
};
let n = 0;
for (const ai of Object.keys(C1)) for (const skin of Object.keys(C1[ai]))
  for (const sens of ["Resilient", "Highly Sensitive"]) for (const act of ["No", "Yes"]) {
    const r = recommend({ aiClass: ai, skinType: skin, sensitivity: sens, activeUsage: act, lesion: "Papules" });
    let [c, t, m] = C1[ai][skin];
    if (sens === "Highly Sensitive") [c, t, m] = ["CLN-03", "TGT-04", "MST-04"];      // M-01
    if (act === "Yes") t = null;                                                        // M-02 (wins)
    assert.equal(r.cleanser.id, c); assert.equal(r.moisturizer.id, m);
    assert.equal(r.target ? r.target.id : null, t);
    assert.ok(!r.target || !(sens === "Highly Sensitive" && ["TGT-01","TGT-02"].includes(r.target.id)), "no BPO/adapalene when sensitive");
    for (const x of [r.cleanser, r.moisturizer, r.target].filter(Boolean)) assert.ok(x.ref && x.evidence, `${x.id} has a citation`);
    assert.equal(r.advisories.includes("A-01"), ai === "Inflammatory");
    n++;
  }
assert.equal(n, 48);
// advisories from self-report
assert.deepEqual(recommend({ aiClass: "Clear Skin", skinType: "Oily", sensitivity: "Resilient", activeUsage: "No", lesion: "Cysts" }).advisories, ["A-02"]);
assert.deepEqual(recommend({ aiClass: "Inflammatory", skinType: "Oily", sensitivity: "Resilient", activeUsage: "No", lesion: "Nodules" }).advisories, ["A-01", "A-02"]);
// fallback
const f = recommend({ aiClass: "???", skinType: "Oily", sensitivity: "Resilient", activeUsage: "No" });
assert.deepEqual([f.rules[0], f.cleanser.id, f.target, f.moisturizer.id], ["F-00", "CLN-03", null, "MST-02"]);
// every ingredient cited
for (const [id, x] of Object.entries(INGREDIENTS)) assert.ok(x.ref && x.evidence, id);
console.log(`OK — all ${n} quiz combinations + advisories + fallback match the technical plan`);
