"""
Table B: Ingredient Master Table (The Knowledge Base)

Anchored to the 2024 American Academy of Dermatology (AAD) Guidelines of
Care for the Management of Acne Vulgaris:

Reynolds RV, Yeung H, Cheng CE, Cook-Bolden F, Desai SR, Druby KM,
Freeman EE, Keri JE, Stein Gold LF, Tan JKL, Tollefson MM, Weiss JS,
Wu PA, Zaenglein AL, Han JM, Barbieri JS. Guidelines of care for the
management of acne vulgaris. J Am Acad Dermatol. 2024;90(5):1006.e1-1006.e30.
https://doi.org/10.1016/j.jaad.2023.12.017

IDs are prefixed by category (TGT / CLN / MST) so no identifier is ever
reused across unrelated products -- this mirrors Table B1/B2/B3 exactly
as documented in Phase 2.
"""

# B1. Target Actives
TARGETS = {
    "TGT-01": {
        "name": "Benzoyl Peroxide 2.5%",
        "vehicle": "Gel / Lotion",
        "mechanism": "Bactericidal",
        "source": "AAD 2024 -- strong recommendation",
    },
    "TGT-02": {
        "name": "Adapalene 0.1% (topical retinoid)",
        "vehicle": "Gel",
        "mechanism": "Comedolytic, anti-inflammatory",
        "source": "AAD 2024 -- strong recommendation (topical retinoids)",
    },
    "TGT-03": {
        "name": "Salicylic Acid 0.5-2%",
        "vehicle": "Liquid / Gel",
        "mechanism": "Comedolytic",
        "source": "AAD 2024 -- conditional recommendation (low evidence grade)",
    },
    "TGT-04": {
        "name": "Azelaic Acid 15-20%",
        "vehicle": "Gel / Cream",
        "mechanism": "Comedolytic, antibacterial, anti-inflammatory; reduces post-acne dyspigmentation",
        "source": "AAD 2024 -- conditional recommendation; noted benefit for sensitive skin and darker skin tones",
    },
    "TGT-05": {
        "name": "Antioxidant (e.g., Niacinamide) -- Maintenance",
        "vehicle": "Serum / Lotion",
        "mechanism": "General preventive skin maintenance",
        "source": "Not an AAD treatment recommendation; general dermatologic maintenance practice",
    },
}

# B2. Cleansers
CLEANSERS = {
    "CLN-01": {
        "name": "Salicylic Acid Wash 2%",
        "vehicle": "Foaming Gel",
        "mechanism": "Comedolytic cleansing",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
    "CLN-02": {
        "name": "Hydrating Cream Cleanser",
        "vehicle": "Cream / Lotion",
        "mechanism": "Non-stripping cleansing",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
    "CLN-03": {
        "name": "Gentle Fragrance-Free Cleanser",
        "vehicle": "Foam / Liquid",
        "mechanism": "Non-irritating cleansing",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
}

# B3. Moisturizers
MOISTURIZERS = {
    "MST-01": {
        "name": "Oil-Free Gel Moisturizer",
        "vehicle": "Gel",
        "mechanism": "Lightweight hydration, non-comedogenic",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
    "MST-02": {
        "name": "Ceramide-Rich Cream",
        "vehicle": "Rich Cream",
        "mechanism": "Barrier repair, deep hydration",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
    "MST-03": {
        "name": "Lightweight Lotion",
        "vehicle": "Lotion",
        "mechanism": "Balanced hydration",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
    "MST-04": {
        "name": "Fragrance-Free Barrier Repair Cream",
        "vehicle": "Rich Cream",
        "mechanism": "Barrier repair, minimal irritant load",
        "source": "Thiboutot et al., Intl Expert Consensus on Dermocosmetics in Acne, JEADV 2024",
    },
}


def get_ingredient(ingredient_id):
    """Look up full details for any ingredient ID across all three categories.
    Returns None if the ID doesn't exist in any table (should never happen
    if rules_engine.py only ever references valid IDs)."""
    if ingredient_id is None:
        return None
    for table in (TARGETS, CLEANSERS, MOISTURIZERS):
        if ingredient_id in table:
            return table[ingredient_id]
    return None
