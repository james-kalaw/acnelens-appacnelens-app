"""Builds the dermatologist validation kit (Phase 4.2 of the technical plan).

Usage: python validation/make_kit.py TEST_DIR SCIN_DIR APP_PREDICTIONS_CSV OUT_DIR

Creates in OUT_DIR:
  photos/AL-001.jpg ...            blind photos (random order, no metadata, no labels)
  answer_key.csv                   DO NOT show to the dermatologist
  AcneLens_Scoring.xlsx            type the dermatologist's labels -> all metrics
  packet.html / rating_sheet.html  rendered to PDF by make_pdfs.cjs
"""
import csv, os, random, sys
from PIL import Image, ImageOps
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

LABELS = ["Clear Skin", "Non-Inflammatory", "Inflammatory"]
SEED = 4242


def main(test_dir, scin_dir, app_csv, out):
    app = {r["file"]: r for r in csv.DictReader(open(app_csv))}
    items = []
    for lab in LABELS:
        for f in sorted(os.listdir(os.path.join(test_dir, lab))):
            items.append(dict(src=os.path.join(test_dir, lab, f), key=f"{lab}/{f}", source="Held-out curated test image", dataset_label=lab))
    for f in sorted(os.listdir(scin_dir)):
        items.append(dict(src=os.path.join(scin_dir, f), key=f"SCIN/{f}", source="SCIN real-world phone photo",
                          dataset_label="(acne - SCIN gives no 3-class label)"))
    random.Random(SEED).shuffle(items)
    os.makedirs(os.path.join(out, "photos"), exist_ok=True)
    for i, it in enumerate(items, 1):
        it["id"] = f"AL-{i:03d}"
        a = app[it["key"]]
        it.update(p_clear=float(a["p_clear"]), p_noninf=float(a["p_noninf"]), p_inf=float(a["p_inf"]), ai=a["app_result"])
        im = ImageOps.exif_transpose(Image.open(it["src"])).convert("RGB")
        im.thumbnail((1200, 1200))
        im.save(os.path.join(out, "photos", it["id"] + ".jpg"), quality=92)   # saved without EXIF
    with open(os.path.join(out, "answer_key.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ID", "source", "dataset_label", "app_result", "p_clear", "p_noninf", "p_inf", "original_file"])
        for it in items:
            w.writerow([it["id"], it["source"], it["dataset_label"], it["ai"], it["p_clear"], it["p_noninf"], it["p_inf"], it["key"]])
    write_xlsx(items, os.path.join(out, "AcneLens_Scoring.xlsx"))
    write_html(items, out)
    print(len(items), "photos ->", out)


def write_xlsx(items, path):
    n = len(items); last = n + 1
    wb = Workbook()
    ink = PatternFill("solid", fgColor="16363B"); yellow = PatternFill("solid", fgColor="FFF4C2"); sand = PatternFill("solid", fgColor="F6EEE7")
    hfont = Font(bold=True, color="FFFFFF"); bold = Font(bold=True); thin = Side(style="thin", color="D9D9D9")
    # --- README
    ws = wb.active; ws.title = "README"
    lines = [
        ("AcneLens — dermatologist validation scoring", True),
        ("1. The dermatologist labels every photo on the paper Blind Rating Sheet WITHOUT seeing the AI's answers.", False),
        ("2. Afterwards, type each label into sheet '1 Ratings', column B (pick from the drop-down). Use 'Cannot tell' if the doctor marked a photo as not gradable.", False),
        ("3. Sheet '2 Results' then shows the Doctor Match Rate, Cohen's kappa (Verified Agreement Score), the confusion matrix and per-class results.", False),
        ("4. Sheet '3 Threshold (4.1a)' fills the confidence-threshold table of Section 4.1a using the dermatologist's labels as the truth.", False),
        ("5. Copy the yellow 'validation.json' cell from '2 Results' into docs/validation.json on GitHub to update the in-app badge (see guides/03).", False),
        ("Column C (AI result) and the p_ columns were produced by the deployed AcneLens app on the same photos. Do not show them to the dermatologist.", False),
        ("Labeling rule agreed for this study: if ANY inflammatory lesion (papule, pustule, nodule, cyst) is visible, the photo is Inflammatory. "
         "Non-Inflammatory = only blackheads/whiteheads. Clear Skin = no visible acne lesion.", False),
    ]
    for i, (t, b) in enumerate(lines, 1):
        c = ws.cell(i, 1, t); c.font = Font(bold=b, size=14 if b else 11); c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 120
    # --- 1 Ratings
    r = wb.create_sheet("1 Ratings")
    head = ["Photo ID", "Dermatologist label", "AI result (app)", "Match?", "Dataset label (reference)", "Source", "p_clear", "p_noninf", "p_inf", "App label (check)", "Top non-inflammatory prob"]
    for j, h in enumerate(head, 1):
        c = r.cell(1, j, h); c.font = hfont; c.fill = ink; c.alignment = Alignment(wrap_text=True, vertical="center")
    for i, it in enumerate(items, 2):
        r.cell(i, 1, it["id"]).font = bold
        r.cell(i, 2).fill = yellow
        r.cell(i, 3, it["ai"])
        r.cell(i, 4, f'=IF(OR(B{i}="",B{i}="Cannot tell"),"",IF(B{i}=C{i},"Yes","No"))')
        r.cell(i, 5, it["dataset_label"]); r.cell(i, 6, it["source"])
        for j, k in ((7, "p_clear"), (8, "p_noninf"), (9, "p_inf")):
            r.cell(i, j, round(it[k], 4)).number_format = "0.000"
        r.cell(i, 10, f'=IF(I{i}>=1/3,"Inflammatory",IF(G{i}>=H{i},"Clear Skin","Non-Inflammatory"))')
        r.cell(i, 11, f"=MAX(G{i},H{i})").number_format = "0.000"
        for j in range(1, 12):
            r.cell(i, j).border = Border(bottom=thin)
    dv = DataValidation(type="list", formula1='"Clear Skin,Non-Inflammatory,Inflammatory,Cannot tell"', allow_blank=True)
    r.add_data_validation(dv); dv.add(f"B2:B{last}")
    r.conditional_formatting.add(f"D2:D{last}", FormulaRule(formula=[f'D2="No"'], fill=PatternFill("solid", fgColor="FBE4DF")))
    r.conditional_formatting.add(f"D2:D{last}", FormulaRule(formula=[f'D2="Yes"'], fill=PatternFill("solid", fgColor="E1F0EA")))
    for col, wdt in zip("ABCDEFGHIJK", [11, 22, 20, 9, 30, 28, 9, 9, 9, 18, 12]):
        r.column_dimensions[col].width = wdt
    r.freeze_panes = "B2"
    # --- 2 Results
    s = wb.create_sheet("2 Results")
    B, C = f"'1 Ratings'!$B$2:$B${last}", f"'1 Ratings'!$C$2:$C${last}"
    E, F = f"'1 Ratings'!$E$2:$E${last}", f"'1 Ratings'!$F$2:$F${last}"
    s["A1"] = "Results (fill sheet '1 Ratings' column B first)"; s["A1"].font = Font(bold=True, size=14)
    s["A3"], s["B3"] = "Photos rated (excluding blank / Cannot tell)", f'=COUNTIF({B},"Clear Skin")+COUNTIF({B},"Non-Inflammatory")+COUNTIF({B},"Inflammatory")'
    s["A4"], s["B4"] = "Marked 'Cannot tell'", f'=COUNTIF({B},"Cannot tell")'
    s["A5"], s["B5"] = "Matches (doctor = AI)", f'=SUMPRODUCT(({B}<>"")*({B}<>"Cannot tell")*({B}={C}))'
    s["A6"], s["B6"] = "Doctor Match Rate (raw agreement)", "=IF(B3=0,\"\",B5/B3)"
    s["A7"], s["B7"] = "  95% CI low (Wilson)", "=IF(B3=0,\"\",(B6+1.96^2/(2*B3)-1.96*SQRT(B6*(1-B6)/B3+1.96^2/(4*B3^2)))/(1+1.96^2/B3))"
    s["A8"], s["B8"] = "  95% CI high (Wilson)", "=IF(B3=0,\"\",(B6+1.96^2/(2*B3)+1.96*SQRT(B6*(1-B6)/B3+1.96^2/(4*B3^2)))/(1+1.96^2/B3))"
    for c in ("B6", "B7", "B8"):
        s[c].number_format = "0.0%"
    s["A10"] = "Confusion matrix — rows: DERMATOLOGIST, columns: AI (app)"; s["A10"].font = bold
    for j, lab in enumerate(LABELS):
        s.cell(11, 2 + j, lab).font = bold; s.cell(12 + j, 1, lab).font = bold
    s.cell(11, 5, "Total").font = bold; s.cell(15, 1, "Total").font = bold
    for i, dl in enumerate(LABELS):
        for j, al in enumerate(LABELS):
            s.cell(12 + i, 2 + j, f'=COUNTIFS({B},"{dl}",{C},"{al}")')
        s.cell(12 + i, 5, f"=SUM(B{12 + i}:D{12 + i})")
    for j in range(3):
        col = "BCD"[j]; s.cell(15, 2 + j, f"=SUM({col}12:{col}14)")
    s["E15"] = "=SUM(E12:E14)"
    s["A17"], s["B17"] = "Observed agreement (po)", "=IF(E15=0,\"\",(B12+C13+D14)/E15)"
    s["A18"], s["B18"] = "Chance agreement (pe)", "=IF(E15=0,\"\",(E12*B15+E13*C15+E14*D15)/E15^2)"
    s["A19"], s["B19"] = "Verified Agreement Score (Cohen's kappa)", "=IF(E15=0,\"\",IF(B18=1,1,(B17-B18)/(1-B18)))"
    s["A20"], s["B20"] = "Interpretation (Landis & Koch)", ('=IF(B19="","",IF(B19<0,"Poor",IF(B19<=0.2,"Slight",IF(B19<=0.4,"Fair",'
                                                             'IF(B19<=0.6,"Moderate",IF(B19<=0.8,"Substantial","Almost perfect"))))))')
    for c in ("B17", "B18", "B19"):
        s[c].number_format = "0.000"
    s["A22"] = "Per class (truth = dermatologist)"; s["A22"].font = bold
    s["B22"], s["C22"], s["D22"] = "AI caught (sensitivity)", "AI precision", "Photos"
    for i, lab in enumerate(LABELS):
        rr = 23 + i; s.cell(rr, 1, lab)
        dcell = f"{'BCD'[i]}{12 + i}"
        s.cell(rr, 2, f"=IF(E{12 + i}=0,\"\",{dcell}/E{12 + i})").number_format = "0.0%"
        s.cell(rr, 3, f"=IF({'BCD'[i]}15=0,\"\",{dcell}/{'BCD'[i]}15)").number_format = "0.0%"
        s.cell(rr, 4, f"=E{12 + i}")
    s["A27"], s["B27"] = "SAFETY: Inflammatory photos the AI called milder", "=B14+C14"
    s["A28"], s["B28"] = "Over-calls: milder photos the AI called Inflammatory", "=D12+D13"
    s["A27"].font = bold
    s["A30"] = "Subgroups"; s["A30"].font = bold
    for k, (name, src) in enumerate((("Held-out curated test images", "Held-out curated test image"), ("SCIN real-world phone photos", "SCIN real-world phone photo"))):
        rr = 31 + k
        s.cell(rr, 1, f"Doctor Match Rate — {name}")
        s.cell(rr, 2, f'=IFERROR(SUMPRODUCT(({F}="{src}")*({B}<>"")*({B}<>"Cannot tell")*({B}={C}))/SUMPRODUCT(({F}="{src}")*({B}<>"")*({B}<>"Cannot tell")),"")').number_format = "0.0%"
    s["A33"], s["B33"] = "Doctor vs dataset label agreement (label quality check, curated images)", (
        f'=IFERROR(SUMPRODUCT(({F}="Held-out curated test image")*({B}<>"")*({B}<>"Cannot tell")*({B}={E}))/SUMPRODUCT(({F}="Held-out curated test image")*({B}<>"")*({B}<>"Cannot tell")),"")')
    s["B33"].number_format = "0.0%"
    s["A35"] = "Paste into docs/validation.json (replace the matching lines):"; s["A35"].font = bold
    q = '""'   # a literal double quote inside an Excel string
    s["A36"] = ('=IF(B3=0,"(enter ratings first)","' + q + 'status' + q + ': ' + q + 'validated' + q + ', ' + q + 'doctor_match_rate' + q + ': "'
                '&TEXT(ROUND(B6*100,1),"0.0")&", ' + q + 'verified_agreement_score' + q + ': "&TEXT(ROUND(B19,2),"0.00")&", '
                + q + 'images_reviewed' + q + ': "&B3&",")')
    s["A36"].fill = yellow; s["A36"].alignment = Alignment(wrap_text=True)
    s.column_dimensions["A"].width = 62
    for col in "BCDE":
        s.column_dimensions[col].width = 20
    # --- 3 Threshold sweep
    t = wb.create_sheet("3 Threshold (4.1a)")
    I, K, J = f"'1 Ratings'!$I$2:$I${last}", f"'1 Ratings'!$K$2:$K${last}", f"'1 Ratings'!$J$2:$J${last}"
    t["A1"] = "Section 4.1a — confidence threshold sweep (truth = dermatologist label)"; t["A1"].font = Font(bold=True, size=13)
    t["A2"] = "App rule: Inflammatory if P(Inflammatory) >= 1/3 (never hidden by the threshold); otherwise the top class is shown only if its probability >= the threshold."
    for j, h in enumerate(["Candidate threshold", "Missed Errors (shown but wrong)", "Unnecessary Rejections (correct but rejected)", "Shown to user"], 1):
        c = t.cell(4, j, h); c.font = hfont; c.fill = ink; c.alignment = Alignment(wrap_text=True)
    valid = f'({B}<>"")*({B}<>"Cannot tell")'
    for k, thr in enumerate([0.5, 0.6, 0.7, 0.8, 0.9]):
        rr = 5 + k
        t.cell(rr, 1, thr).number_format = "0%"
        passed = f"((({I}>=1/3)+({K}>=A{rr}))>0)"
        t.cell(rr, 2, f"=SUMPRODUCT({valid}*{passed}*({J}<>{B}))")
        t.cell(rr, 3, f"=SUMPRODUCT({valid}*(1-{passed})*({J}={B}))")
        t.cell(rr, 4, f"=SUMPRODUCT({valid}*{passed})")
    t["A11"] = "Deployed setting: 50% (chosen on the separate validation set before testing)."
    for col, wdt in zip("ABCD", [20, 30, 36, 16]):
        t.column_dimensions[col].width = wdt
    wb.save(path)


def write_html(items, out):
    css = """<style>@page{size:A4;margin:14mm}body{font-family:Helvetica,Arial,sans-serif;color:#16363B;font-size:11pt}
    h1{font-size:20pt;margin:0 0 6pt}h2{font-size:14pt;margin:16pt 0 6pt}.muted{color:#5F7376}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.ph{break-inside:avoid;border:1px solid #ddd;border-radius:6px;padding:4mm;text-align:center}
    .ph img{width:78mm;height:78mm;object-fit:contain;background:#f4f4f4}.ph b{display:block;font-size:16pt;margin-top:2mm}
    .pb{break-after:page}table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:4.2pt 6pt;font-size:10.5pt}
    th{background:#16363B;color:#fff;text-align:left}.box{display:inline-block;width:11pt;height:11pt;border:1.4pt solid #16363B;vertical-align:-2pt;margin-right:4pt}
    .rule{border:1.5px solid #E2725B;border-radius:6px;padding:8pt 10pt;background:#FFF7F4}.sig td{height:26pt}</style>"""
    ids = [it["id"] for it in items]
    intro = """<h1>AcneLens — Blind Photo Packet</h1><p class="muted">For the dermatologist. Photos are in random order and carry no labels or AI results.</p>
      <div class="rule"><b>Task.</b> For each photo, choose ONE category on the Blind Rating Sheet:<br>
      <b>Clear Skin</b> — no visible acne lesion &nbsp;·&nbsp; <b>Non-Inflammatory</b> — only blackheads and/or whiteheads &nbsp;·&nbsp;
      <b>Inflammatory</b> — ANY papule, pustule, nodule or cyst is visible (even if comedones are also present).<br>
      Mark <b>Cannot tell</b> only if the photo is not gradable.</div>
      <p class="muted" style="margin-top:10pt">10 photos (from the Skin Condition Image Network, SCIN, Google Research; SCIN Data Use License) are real-world phone photos and were modified only by cropping. Other photos come from public acne research datasets.</p>"""
    pages = [ids[i:i + 4] for i in range(0, len(ids), 4)]
    body = "".join(f'<div class="grid {"pb" if k < len(pages) - 1 else ""}">' + "".join(
        f'<div class="ph"><img src="photos/{i}.jpg"><b>{i}</b></div>' for i in pg) + "</div>" for k, pg in enumerate(pages))
    open(os.path.join(out, "packet.html"), "w").write(f"<!doctype html><meta charset=utf-8>{css}<div class=pb>{intro}</div>{body}")
    rows = "".join(f"<tr><td><b>{i}</b></td>" + "".join(f'<td><span class="box"></span>{l}</td>' for l in ["Clear", "Non-Inflam.", "Inflam.", "Cannot tell"]) +
                   "<td style='width:30%'></td></tr>" for i in ids)
    sheet = f"""<!doctype html><meta charset=utf-8>{css}<h1>AcneLens — Blind Rating Sheet</h1>
      <p>Dermatologist: ______________________________ &nbsp; PRC License No.: ______________ &nbsp; Date: ____________</p>
      <div class="rule"><b>Labeling rule.</b> Inflammatory = any papule, pustule, nodule or cyst visible. Non-Inflammatory = only blackheads/whiteheads.
      Clear = no visible acne. Please label without looking at the AcneLens app or its results. Tick one box per photo.</div>
      <table style="margin-top:8pt"><tr><th>Photo</th><th colspan=4>Category (tick one)</th><th>Notes (optional)</th></tr>{rows}</table>
      <div style="break-before:page"></div><h1>Validation Certificate</h1>
      <p>I, the undersigned licensed dermatologist, independently classified the {len(ids)} photographs of the AcneLens Blind Photo Packet into
      Clear Skin, Non-Inflammatory acne, or Inflammatory acne. I did <b>not</b> see the AcneLens application's classifications before completing my ratings.
      My ratings were then compared photo-by-photo with the application's results by the researchers.</p>
      <table class="sig"><tr><td style="width:40%">Name</td><td></td></tr><tr><td>PRC License No.</td><td></td></tr><tr><td>Clinic / hospital affiliation</td><td></td></tr>
      <tr><td>Date of review</td><td></td></tr><tr><td>Doctor Match Rate (filled in by researchers)</td><td></td></tr>
      <tr><td>Verified Agreement Score — Cohen's kappa (filled in by researchers)</td><td></td></tr><tr><td>Comments</td><td style="height:60pt"></td></tr>
      <tr><td>Signature</td><td style="height:40pt"></td></tr></table>"""
    open(os.path.join(out, "rating_sheet.html"), "w").write(sheet)


if __name__ == "__main__":
    main(*sys.argv[1:5])
