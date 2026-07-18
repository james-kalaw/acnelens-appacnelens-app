"""
Table C1: Junction Rules -- Base Layer (12 rules)
Table C2: Junction Rules -- Modifier & Fallback Layer (3 rules: M-01, M-02, F-00)

Implements the exact rule order documented in Phase 2:
  1. Look up the Base Layer rule for (AI_Classification, Skin_Type).
  2. Apply M-01 (Sensitivity override) if Sensitivity_Level == "Highly
     Sensitive" -- this overrides ALL THREE output slots regardless of
     which base rule matched, per the documented "Override Effect".
  3. Apply M-02 (Active Usage override) if Active_Usage == "Yes" --
     suppresses the target only; cleanser/moisturizer are unaffected.
  4. If no base rule matches at all (should not happen given the
     constrained input values, but guards against a bad/unexpected
     value making it through), apply F-00 (Universal Fallback).

NOTE ON MODIFIER STACKING (a design decision not spelled out verbatim in
the documentation, made explicit here): if BOTH M-01 and M-02 trigger in
the same session, M-02 is applied last and wins on the target slot. This
means a Highly Sensitive user who is also already using strong actives
gets Azelaic Acid suppressed too, not just the base rule's original
target -- the chemical-compounding safety concern behind M-02 is treated
as taking priority over M-01's substitution, since compounding risk
isn't eliminated just because the substituted active is gentler. Flag
this to your adviser as an explicit design choice worth documenting if
asked.
"""

from ingredients import get_ingredient

# Table C1: Base Layer -- keyed by (AI_Classification, Skin_Type)
BASE_RULES = {
    ("Non-Inflammatory", "Oily"):        {"cleanser": "CLN-01", "target": "TGT-02", "moisturizer": "MST-01"},  # R-001
    ("Non-Inflammatory", "Dry"):         {"cleanser": "CLN-02", "target": "TGT-03", "moisturizer": "MST-02"},  # R-002
    ("Non-Inflammatory", "Combination"): {"cleanser": "CLN-01", "target": "TGT-02", "moisturizer": "MST-03"},  # R-003
    ("Non-Inflammatory", "Normal"):      {"cleanser": "CLN-03", "target": "TGT-02", "moisturizer": "MST-03"},  # R-004

    ("Inflammatory", "Oily"):        {"cleanser": "CLN-01", "target": "TGT-01", "moisturizer": "MST-01"},      # R-005
    ("Inflammatory", "Dry"):         {"cleanser": "CLN-02", "target": "TGT-01", "moisturizer": "MST-02"},      # R-006
    ("Inflammatory", "Combination"): {"cleanser": "CLN-01", "target": "TGT-01", "moisturizer": "MST-03"},      # R-007
    ("Inflammatory", "Normal"):      {"cleanser": "CLN-03", "target": "TGT-01", "moisturizer": "MST-03"},      # R-008

    ("Clear Skin", "Oily"):        {"cleanser": "CLN-03", "target": "TGT-05", "moisturizer": "MST-01"},        # R-009
    ("Clear Skin", "Dry"):         {"cleanser": "CLN-03", "target": "TGT-05", "moisturizer": "MST-02"},        # R-010
    ("Clear Skin", "Combination"): {"cleanser": "CLN-03", "target": "TGT-05", "moisturizer": "MST-03"},        # R-011
    ("Clear Skin", "Normal"):      {"cleanser": "CLN-03", "target": "TGT-05", "moisturizer": "MST-03"},        # R-012
}

# Table C2 -- Rule F-00: Universal Fallback
FALLBACK_RULE = {"cleanser": "CLN-03", "target": None, "moisturizer": "MST-02"}

NO_ACTIVE_MESSAGE = "None -- existing routine flagged, avoid compounding actives"


def get_recommendation(ai_classification, skin_type, sensitivity_level, active_usage):
    """
    Returns a dict:
        {
            "cleanser": {...ingredient detail...},
            "target": {...ingredient detail...} or a flagged "no active" message,
            "moisturizer": {...ingredient detail...},
            "rules_applied": ["R-00X" or "F-00", "M-01"?, "M-02"?],
        }
    """
    rules_applied = []

    # Step 1: Base Layer lookup (Table C1)
    base = BASE_RULES.get((ai_classification, skin_type))
    if base is None:
        result = dict(FALLBACK_RULE)
        rules_applied.append("F-00 (fallback -- unrecognized combination)")
    else:
        result = dict(base)
        rules_applied.append("Base rule matched")

    # Step 2: Modifier M-01 -- Sensitivity override (overrides ALL slots)
    if sensitivity_level == "Highly Sensitive":
        result = {"cleanser": "CLN-03", "target": "TGT-04", "moisturizer": "MST-04"}
        rules_applied.append("M-01 (Highly Sensitive override)")

    # Step 3: Modifier M-02 -- Active Usage override (target slot only)
    if active_usage == "Yes":
        result["target"] = None
        rules_applied.append("M-02 (Active Usage override)")

    # Resolve IDs into full ingredient detail for display
    target_detail = get_ingredient(result["target"])
    if target_detail is None:
        target_detail = {"name": NO_ACTIVE_MESSAGE, "vehicle": "-", "mechanism": "-", "source": "-"}

    return {
        "cleanser": get_ingredient(result["cleanser"]),
        "target": target_detail,
        "moisturizer": get_ingredient(result["moisturizer"]),
        "rules_applied": rules_applied,
    }
