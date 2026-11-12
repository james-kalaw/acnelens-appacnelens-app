// AcneLens recommendation engine — a direct port of Phase 2 of the
// technical plan (Table B ingredients, Table C1 base rules, Table C2
// modifiers + fallback) plus two display-only referral advisories.
// Pure functions, no network, no brand names: ingredients only.

export const AAD_2024 =
  "Reynolds RV, et al. Guidelines of care for the management of acne vulgaris. J Am Acad Dermatol. 2024;90(5):1006.e1–1006.e30. doi:10.1016/j.jaad.2023.12.017";
export const JEADV_2024 =
  "International Expert Consensus Recommendations for the Use of Dermocosmetics in Acne. J Eur Acad Dermatol Venereol. 2024;39(5):952–966. doi:10.1111/jdv.20145";

// ---------- Table B: Ingredient Master Table ----------
export const INGREDIENTS = {
  // B1. Target actives
  "TGT-01": { name: "Benzoyl Peroxide 2.5%", vehicle: "Gel / Lotion", mechanism: "Kills acne-causing bacteria (bactericidal).",
              evidence: "AAD 2024 — strong recommendation", ref: AAD_2024 },
  "TGT-02": { name: "Adapalene 0.1%", vehicle: "Gel", mechanism: "Topical retinoid: unclogs pores (comedolytic) and calms inflammation.",
              evidence: "AAD 2024 — strong recommendation (topical retinoids)", ref: AAD_2024 },
  "TGT-03": { name: "Salicylic Acid 0.5–2%", vehicle: "Liquid / Gel", mechanism: "Loosens dead skin inside pores (comedolytic).",
              evidence: "AAD 2024 — conditional recommendation (low certainty of evidence)", ref: AAD_2024 },
  "TGT-04": { name: "Azelaic Acid 15–20%", vehicle: "Gel / Cream", mechanism: "Unclogs pores, fights bacteria, calms inflammation; also fades dark marks left by acne.",
              evidence: "AAD 2024 — conditional recommendation; noted benefit for sensitive skin and darker skin tones", ref: AAD_2024 },
  "TGT-05": { name: "Niacinamide (antioxidant) — maintenance", vehicle: "Serum / Lotion", mechanism: "General preventive care to keep skin balanced.",
              evidence: "Not an AAD treatment recommendation; general dermatologic maintenance practice", ref: JEADV_2024 },
  // B2. Cleansers
  "CLN-01": { name: "Salicylic Acid Wash 2%", vehicle: "Foaming Gel", mechanism: "Cleanses while helping keep pores clear.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  "CLN-02": { name: "Hydrating Cream Cleanser", vehicle: "Cream / Lotion", mechanism: "Cleanses without stripping the skin's moisture.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  "CLN-03": { name: "Gentle Fragrance-Free Cleanser", vehicle: "Foam / Liquid", mechanism: "Low-irritation cleansing.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  // B3. Moisturizers
  "MST-01": { name: "Oil-Free Gel Moisturizer", vehicle: "Gel", mechanism: "Light hydration that won't clog pores (non-comedogenic).",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  "MST-02": { name: "Ceramide-Rich Cream", vehicle: "Rich Cream", mechanism: "Repairs the skin barrier and hydrates deeply.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  "MST-03": { name: "Lightweight Lotion", vehicle: "Lotion", mechanism: "Balanced hydration for mixed or normal skin.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
  "MST-04": { name: "Fragrance-Free Barrier Repair Cream", vehicle: "Rich Cream", mechanism: "Repairs the barrier with the fewest possible irritants.",
              evidence: "International expert consensus on dermocosmetics in acne (JEADV 2024)", ref: JEADV_2024 },
};

// ---------- Table C1: Base layer (AI class × skin type) ----------
const BASE = {
  "Non-Inflammatory|Oily":        ["R-001", "CLN-01", "TGT-02", "MST-01"],
  "Non-Inflammatory|Dry":         ["R-002", "CLN-02", "TGT-03", "MST-02"],
  "Non-Inflammatory|Combination": ["R-003", "CLN-01", "TGT-02", "MST-03"],
  "Non-Inflammatory|Normal":      ["R-004", "CLN-03", "TGT-02", "MST-03"],
  "Inflammatory|Oily":            ["R-005", "CLN-01", "TGT-01", "MST-01"],
  "Inflammatory|Dry":             ["R-006", "CLN-02", "TGT-01", "MST-02"],
  "Inflammatory|Combination":     ["R-007", "CLN-01", "TGT-01", "MST-03"],
  "Inflammatory|Normal":          ["R-008", "CLN-03", "TGT-01", "MST-03"],
  "Clear Skin|Oily":              ["R-009", "CLN-03", "TGT-05", "MST-01"],
  "Clear Skin|Dry":               ["R-010", "CLN-03", "TGT-05", "MST-02"],
  "Clear Skin|Combination":       ["R-011", "CLN-03", "TGT-05", "MST-03"],
  "Clear Skin|Normal":            ["R-012", "CLN-03", "TGT-05", "MST-03"],
};

export const RULE_TEXT = {
  "M-01": "Highly sensitive skin: gentle cleanser, azelaic acid instead of stronger actives, barrier-repair moisturizer. Benzoyl peroxide and adapalene are not suggested.",
  "M-02": "Already using a strong acne treatment: no new active is added, to avoid irritation from stacking actives. Cleanser and moisturizer still apply.",
  "F-00": "Universal fallback: gentle cleanser + barrier cream, no active.",
  "A-01": "Inflammatory result: advise seeing a dermatologist (display only — does not change the routine).",
  "A-02": "Self-reported cysts or nodules: advise seeing a dermatologist (display only — does not change the routine).",
};

/**
 * @param {{aiClass:string, skinType:string, sensitivity:string, activeUsage:string, lesion?:string}} s
 */
export function recommend(s) {
  const applied = [];
  const base = BASE[`${s.aiClass}|${s.skinType}`];
  let out;
  if (base) {
    applied.push(base[0]);
    out = { cleanser: base[1], target: base[2], moisturizer: base[3] };
  } else {
    applied.push("F-00");
    out = { cleanser: "CLN-03", target: null, moisturizer: "MST-02" };
  }
  // M-01 — sensitivity override (all three slots)
  if (s.sensitivity === "Highly Sensitive") {
    out = { cleanser: "CLN-03", target: "TGT-04", moisturizer: "MST-04" };
    applied.push("M-01");
  }
  // M-02 — active-usage override (target slot only). Applied LAST so it wins over M-01:
  // a gentler substitute is still an extra active on top of the user's current treatment.
  let suppressed = false;
  if (s.activeUsage === "Yes") {
    out.target = null; suppressed = true;
    applied.push("M-02");
  }
  const advisories = [];
  if (s.aiClass === "Inflammatory") advisories.push("A-01");
  if (s.lesion === "Cysts" || s.lesion === "Nodules") advisories.push("A-02");
  return {
    rules: applied,
    advisories,
    cleanser: { id: out.cleanser, ...INGREDIENTS[out.cleanser] },
    target: out.target ? { id: out.target, ...INGREDIENTS[out.target] } : null,
    targetSuppressed: suppressed,
    moisturizer: { id: out.moisturizer, ...INGREDIENTS[out.moisturizer] },
  };
}
