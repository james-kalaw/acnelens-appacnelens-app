"""
AcneLens -- minimal working Streamlit app.

This wires together:
  - model_utils.py   (Phase 1: AI classification + 70% confidence gate)
  - rules_engine.py  (Phase 2: Table C1/C2 recommendation logic)
  - ingredients.py   (Phase 2: Table B ingredient details)

This is a functional first version using Streamlit's session_state to
move through steps (Upload -> Quiz -> Results). It intentionally keeps
one simple linear script rather than the full multi-page Figma layout --
once this works end-to-end, the visual polish (dropdown styling,
personalization tag placement, etc.) can be layered on without touching
the underlying logic.

Before running: place your downloaded keras_model.h5 and labels.txt in
this same folder.
"""

import streamlit as st
from PIL import Image

from model_utils import classify_image
from rules_engine import get_recommendation

st.set_page_config(page_title="AcneLens", page_icon="\U0001FAF6")

# ---------------- Session state setup ----------------
if "step" not in st.session_state:
    st.session_state.step = "upload"
if "classification_result" not in st.session_state:
    st.session_state.classification_result = None
if "quiz_answers" not in st.session_state:
    st.session_state.quiz_answers = {}

st.title("AcneLens")
st.caption("AcneLens is a guidance tool, not a medical diagnosis.")

# ---------------- STEP 1: Photo upload + quality gate ----------------
if st.session_state.step == "upload":
    st.subheader("Take or upload a close-up photo of the affected area")
    uploaded_file = st.file_uploader("Upload a photo", type=["jpg", "jpeg", "png"])

    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(image, caption="Your photo", use_container_width=True)

        with st.spinner("Analyzing photo..."):
            result = classify_image(image)

        if not result["passed_gate"]:
            st.error(
                f"Photo is a bit unclear (top confidence was only "
                f"{result['confidence']}%). Please retake it with better "
                f"lighting and a steady hand -- AcneLens won't guess on an "
                f"unclear photo."
            )
            with st.expander("Debug: raw scores for all classes"):
                st.json(result["all_scores"])
        else:
            st.success(f"Detected: {result['predicted_class']} ({result['confidence']}% confidence)")
            st.session_state.classification_result = result
            if st.button("Continue to Quiz"):
                st.session_state.step = "quiz"
                st.rerun()

# ---------------- STEP 2: Post-photo quiz ----------------
elif st.session_state.step == "quiz":
    st.subheader("A few quick questions")

    lesion = st.selectbox(
        "Which of these looks closest to what you're seeing on your skin?",
        ["Blackheads", "Whiteheads", "Papules", "Pustules", "Cysts", "Nodule"],
        help="This is for your own reference only -- it does not affect your recommendation.",
    )
    skin_type = st.selectbox(
        "How would you describe your skin most of the time?",
        ["Oily", "Dry", "Combination", "Normal"],
    )
    sensitivity = st.selectbox(
        "How does your skin usually react to new products?",
        ["Resilient", "Highly Sensitive"],
    )
    active_usage = st.selectbox(
        "Are you currently using any strong acne treatments (retinoids, benzoyl peroxide, peels)?",
        ["No", "Yes"],
    )

    if st.button("See My Results"):
        st.session_state.quiz_answers = {
            "lesion_self_report": lesion,
            "skin_type": skin_type,
            "sensitivity": sensitivity,
            "active_usage": active_usage,
        }
        st.session_state.step = "results"
        st.rerun()

    if st.button("\u2190 Back"):
        st.session_state.step = "upload"
        st.rerun()

# ---------------- STEP 3: Results ----------------
elif st.session_state.step == "results":
    classification = st.session_state.classification_result["predicted_class"]
    answers = st.session_state.quiz_answers

    st.subheader(f"AI Classification: {classification}")
    st.caption(f"You reported seeing: {answers['lesion_self_report']}")

    st.markdown(f"**Personalized for:** {answers['skin_type']} skin \u00b7 {answers['sensitivity']}")

    recommendation = get_recommendation(
        ai_classification=classification,
        skin_type=answers["skin_type"],
        sensitivity_level=answers["sensitivity"],
        active_usage=answers["active_usage"],
    )

    st.markdown("### Recommended Routine")
    st.write(f"**Cleanser:** {recommendation['cleanser']['name']}")
    st.write(f"**Target Treatment:** {recommendation['target']['name']}")
    st.write(f"**Moisturizer:** {recommendation['moisturizer']['name']}")

    if classification == "Inflammatory":
        st.warning(
            "Your results suggest inflammatory acne. While this routine can help "
            "manage mild cases, we recommend consulting a licensed dermatologist, "
            "especially if you notice cysts, nodules, or scarring."
        )

    with st.expander("Which rules were applied? (for testing/debugging)"):
        st.write(recommendation["rules_applied"])

    if st.button("Start Over"):
        st.session_state.step = "upload"
        st.session_state.classification_result = None
        st.session_state.quiz_answers = {}
        st.rerun()
