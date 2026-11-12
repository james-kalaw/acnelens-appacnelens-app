"""Builds validation/AcneLens_Filipino_Translation_Review.xlsx from docs/assets/js/i18n.js
so a fluent Filipino speaker can check every sentence (English next to Filipino).
Usage: python3 validation/make_translation_review.py"""
import json, os, subprocess
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
JS = r"""
globalThis.localStorage={getItem:()=>null,setItem(){}};
Object.defineProperty(globalThis,"navigator",{value:{languages:["en"]}});globalThis.document={documentElement:{}};
const {STR}=await import("./docs/assets/js/i18n.js");const {INGREDIENTS}=await import("./docs/assets/js/rules.js");
const en={...STR.en};for(const [id,x] of Object.entries(INGREDIENTS)) en["ing."+id]=x.name+" — "+x.mechanism;
console.log(JSON.stringify({en,fil:STR.fil}));"""
data = json.loads(subprocess.run(["node", "--input-type=module", "-e", JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
SECTIONS = [("sp.", "Opening screen"), ("ob.", "Welcome screen"), ("home.", "Home"), ("status.", "Home"), ("install.", "Home"),
            ("frame.", "Framing the photo"), ("q.", "Photo quality"), ("qt.", "Photo quality"), ("rt.", "Retake messages"),
            ("an.", "Analyzing"), ("quiz.", "Quiz"), ("q1.", "Quiz"), ("q2.", "Quiz"), ("q3.", "Quiz"), ("q4.", "Quiz"),
            ("les.", "Quiz – lesion descriptions"), ("skin.", "Quiz"), ("sens.", "Quiz"), ("act.", "Quiz"),
            ("adv.", "SAFETY – dermatologist warnings"), ("cls.", "Results"), ("res.", "Results"), ("step.", "Results"), ("none.", "Results"),
            ("badge.", "Results"), ("ing.", "Ingredients (name stays English)"), ("m02.", "Safety rules"), ("rule.", "Safety rules"),
            ("sv.", "Journal"), ("rf.", "Journal"), ("jr.", "Journal"), ("toast.", "Short messages"), ("set.", "Settings"),
            ("theme.", "Settings"), ("tab.", "Bottom tabs"), ("common.", "Buttons"), ("how.", "How AcneLens decides"),
            ("val.", "How we tested it"), ("refs.", "References"), ("priv.", "Privacy"), ("disc.", "SAFETY – disclaimer"),
            ("cred.", "Credits"), ("inst.", "Install instructions")]
def section(k):
    return next((n for p, n in SECTIONS if k.startswith(p)), "Other")
strip = lambda s: s.replace("<b>", "").replace("</b>", "").replace("<em>", "").replace("</em>", "").replace("<i>", "").replace("</i>", "").replace("&amp;", "&")
wb = Workbook(); ws = wb.active; ws.title = "Review"
ws.append(["How to use: read each Filipino sentence next to its English meaning. Mark OK or Change; write the better wording in column F. "
           "Scientific terms (Clear Skin, Non-Inflammatory, Inflammatory, lesion names, ingredient names, Oily/Dry/Combination/Normal, Resilient/Highly sensitive) "
           "intentionally stay in English. Rows marked SAFETY matter most. Placeholders like {pct} are filled in by the app — keep them."])
ws.merge_cells("A1:G1"); ws["A1"].alignment = Alignment(wrap_text=True, vertical="top"); ws.row_dimensions[1].height = 62
head = ["#", "Section", "Key", "English", "Filipino (app)", "Reviewer: better wording (if any)", "OK / Change"]
ws.append(head)
ink = PatternFill("solid", fgColor="16363B"); yellow = PatternFill("solid", fgColor="FFF4C2"); red = PatternFill("solid", fgColor="FBE4DF")
for j in range(1, 8):
    c = ws.cell(2, j); c.font = Font(bold=True, color="FFFFFF"); c.fill = ink; c.alignment = Alignment(wrap_text=True)
thin = Side(style="thin", color="D9D9D9")
order = sorted(data["fil"].keys(), key=lambda k: (SECTIONS.index(next((x for x in SECTIONS if k.startswith(x[0])), SECTIONS[-1])), k))
n = 0
for k in order:
    if data["en"].get(k) == data["fil"][k] and not k.startswith("ing."):
        continue  # identical in both languages (terms kept in English) — nothing to review
    n += 1; sec = section(k)
    ws.append([n, sec, k, strip(data["en"].get(k, "")), strip(data["fil"][k]), "", ""])
    r = ws.max_row
    for j in range(1, 8):
        ws.cell(r, j).alignment = Alignment(wrap_text=True, vertical="top"); ws.cell(r, j).border = Border(bottom=thin)
    ws.cell(r, 6).fill = yellow; ws.cell(r, 7).fill = yellow
    if sec.startswith("SAFETY"):
        for j in (1, 2): ws.cell(r, j).fill = red
dv = DataValidation(type="list", formula1='"OK,Change"', allow_blank=True); ws.add_data_validation(dv); dv.add(f"G3:G{ws.max_row}")
for col, w in zip("ABCDEFG", [5, 22, 18, 52, 52, 40, 11]): ws.column_dimensions[col].width = w
ws.freeze_panes = "D3"
info = wb.create_sheet("Reviewer")
for i, (a, b) in enumerate([("Reviewer name", ""), ("Role (e.g., Filipino teacher)", ""), ("Date reviewed", ""), ("Signature", ""),
                            ("Sentences reviewed", n), ("Note", "After review, send the changed rows back so the app text can be updated before the dermatologist consult.")], 1):
    info.cell(i, 1, a).font = Font(bold=True); info.cell(i, 2, b)
info.column_dimensions["A"].width = 30; info.column_dimensions["B"].width = 80
out = os.path.join(ROOT, "validation", "AcneLens_Filipino_Translation_Review.xlsx"); wb.save(out)
print(n, "sentences ->", out)
