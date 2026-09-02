"""Directly improve SIH-Oil-Spill-Idea.pptx in place.
- Backup original once -> SIH-Oil-Spill-Idea_BACKUP_original.pptx
- Slides 2-5: remove AI-mosaic shapes (1536x1024 picture fills) + stray notes,
  inject rubric-aligned native content
- Slide 6: append dataset/validation references
- Slide 7: delete (template instructions page)
"""
import shutil, sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.dml import MSO_FILL
from pptx.oxml.ns import qn

PPTX = Path(r"C:\Users\yoges\OneDrive\Desktop\SIH26143_OIL_DUMP\SIH-Oil-Spill-Idea.pptx")
BACKUP = PPTX.with_name("SIH-Oil-Spill-Idea_BACKUP_original.pptx")
SHOT = Path(r"C:\Users\yoges\OneDrive\Desktop\SIH26143_OIL_DUMP\docs\assets\dashboard_map.png")

C = dict(
    navy="1E40AF", navy_d="1E3A8A", blue_e="DBEAFE",
    teal="0F766E", teal_d="115E59", teal_e="CCFBF1",
    purple="6D28D9", purple_d="5B21B6", purple_e="EDE9FE",
    amber="B45309", amber_d="92400E", amber_e="FEF3C7",
    green="166534", green_d="14532D", green_e="DCFCE7",
    slate="334155", gray="64748B", gray_f="F1F5F9", white="FFFFFF",
)
def rgb(k): return RGBColor.from_string(C[k])
def IN(v): return Emu(int(v * 914400))

def remove(sh):
    el = sh._element
    el.getparent().remove(el)

def is_ai_mosaic(sh):
    try:
        return sh.fill.type == MSO_FILL.PICTURE
    except Exception:
        return False

def style_tf(tf, lines, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE):
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for i, (txt, size, bold, color, sp_before) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if sp_before: p.space_before = Pt(sp_before)
        r = p.add_run(); r.text = txt
        f = r.font; f.size = Pt(size); f.bold = bold
        f.color.rgb = rgb(color); f.name = "Segoe UI"

def add_textbox(slide, l, t, w, h, lines, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(IN(l), IN(t), IN(w), IN(h))
    style_tf(tb.text_frame, lines, align, anchor)
    return tb

def add_card(slide, l, t, w, h, fill, line, lines, radius=0.07,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE):
    sp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(l), IN(t), IN(w), IN(h))
    try: sp.adjustments[0] = radius
    except Exception: pass
    sp.fill.solid(); sp.fill.fore_color.rgb = rgb(fill)
    sp.line.color.rgb = rgb(line); sp.line.width = Pt(1.75)
    sp.shadow.inherit = False
    style_tf(sp.text_frame, lines, align, anchor)
    return sp

def add_chevron(slide, l, t, w, h, fill, lines):
    sp = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, IN(l), IN(t), IN(w), IN(h))
    sp.fill.solid(); sp.fill.fore_color.rgb = rgb(fill)
    sp.line.color.rgb = rgb("white"); sp.line.width = Pt(1.5)
    sp.shadow.inherit = False
    style_tf(sp.text_frame, lines)
    return sp

def arrow(slide, cx, cy, ch="▶"):
    add_textbox(slide, cx - 0.30, cy - 0.28, 0.60, 0.56,
                [(ch, 22, True, "gray", 0)], PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)

def clear_content(slide):
    removed = 0
    for sh in list(slide.shapes):
        txt = sh.text_frame.text.lower() if sh.has_text_frame else ""
        if "yahan" in txt or is_ai_mosaic(sh):
            remove(sh); removed += 1
    return removed

prs = Presentation(str(PPTX))
W, H = prs.slide_width, prs.slide_height
print(f"Deck: {len(prs.slides)} slides | {IN(W)/914400:.2f} x {IN(H)/914400:.2f} in")
if not BACKUP.exists():
    shutil.copy2(PPTX, BACKUP); print(f"Backup created: {BACKUP.name}")

# ---------- SLIDE 2 : Proposed Solution ----------
s = prs.slides[1]
print("S2 removed:", clear_content(s))
add_textbox(s, 0.7, 1.80, 18.6, 1.30, [
    ("\u2022 India: 7,500 km coastline, ~75% of oil arrives by sea \u2014 zero automated spill-source attribution today", 15, False, "slate", 0),
    ("\u2022 Ennore 2017: two ships, 251 tonnes spilled, years of litigation \u2014 culprit identification was manual guesswork", 15, False, "slate", 6),
])
steps = [("1 \u00b7 DETECT", "U-Net finds slick polygons\nin Sentinel-1 SAR", "navy"),
         ("2 \u00b7 REWIND", "OpenDrift runs ocean physics\nbackwards to origin zone", "teal"),
         ("3 \u00b7 ATTRIBUTE", "AIS tracks cross-scored:\nproximity \u00b7 heading \u00b7 dark-window", "purple"),
         ("4 \u00b7 PROVE", "Ranked suspect dossier\nwith confidence %, court-ready", "green")]
for i, (t, sub, col) in enumerate(steps):
    subs = sub.split("\n")
    lines = [(t, 18, True, "white", 0)] + [(x, 11.5, False, "white", 3) for x in subs]
    add_chevron(s, 0.7 + i * 4.68, 3.55, 4.90, 1.95, col, lines)
uniq_lines = [("WHY NOBODY ELSE HAS THIS", 16, True, "amber_d", 0),
    ("\u2022 Only pipeline that reasons BACKWARDS in time from slick physics", 12.5, False, "slate", 8),
    ("\u2022 Catches \"dark vessels\" that switched AIS off during the spill window", 12.5, False, "slate", 4),
    ("\u2022 EU's CleanSeaNet needs analysts; ours runs end-to-end automatically & open-source", 12.5, False, "slate", 4),
    ("\u2022 India-first: sovereign capability instead of foreign service dependency", 12.5, False, "slate", 4)]
add_card(s, 0.7, 6.05, 11.35, 4.15, "amber_e", "amber", uniq_lines,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
add_card(s, 12.40, 6.05, 6.90, 4.15, "green_e", "green",
    [("OUTCOME", 16, True, "green_d", 0),
     ("Anonymous slick \u2192 ranked suspect list", 16, True, "green_d", 10),
     ("in under 30 minutes", 16, True, "green_d", 2),
     ("with quantified uncertainty \u2014 not guesses", 12, False, "slate", 10)])

# ---------- SLIDE 3 : Technical Approach ----------
s = prs.slides[2]
print("S3 removed:", clear_content(s))
add_textbox(s, 0.87, 1.72, 8.0, 0.4, [("STAGE A \u00b7 DETECT", 12, True, "gray", 0)])
row1 = [("SENTINEL-1 SAR", ["GRD \u00b7 free \u00b7 C-band", "named inside the PS itself"], "blue_e", "navy", "navy_d"),
        ("PREPROCESS", ["calibrate \u00b7 speckle filter", "land mask"], "blue_e", "navy", "navy_d"),
        ("U-NET SEGMENTATION", ["Zenodo-trained \u00b7 dual-pol", "slick vs look-alike classes"], "teal_e", "teal", "teal_d"),
        ("SLICK POLYGONS", ["GeoJSON + confidence", "area \u00b7 shape features"], "teal_e", "teal", "teal_d")]
xs = [0.87, 5.52, 10.17, 14.82]
for i, (t, subs, fl, ln, tc) in enumerate(row1):
    lines = [(t, 15.5, True, tc, 0)] + [(x, 11, False, "slate", 3) for x in subs]
    add_card(s, xs[i], 2.15, 4.30, 1.70, fl, ln, lines)
for gx in (5.17 + 0.02, 9.82 + 0.02, 14.47 + 0.02):
    arrow(s, gx, 3.00)
arrow(s, xs[3] + 2.15, 4.55, "\u25bc")
add_textbox(s, 0.87, 4.78, 9.5, 0.4, [("STAGE B \u00b7 REWIND \u2192 ATTRIBUTE \u2192 PROVE   (flows right to left)", 12, True, "gray", 0)])
row2 = [(3, "OPEN DRIFT HINDCAST", ["BACKWARD ensemble \u00d7100", "wind drift 1\u20136% \u00b7 Ekman angle", "Stokes drift \u00b7 CMEMS + ERA5"], "purple_e", "purple", "purple_d"),
        (2, "ORIGIN MAP", ["probability surface over sea", "(PDF \u2014 never a single guess)", "hindcast window 2\u201312 h"], "purple_e", "purple", "purple_d"),
        (1, "AIS FUSION SCORING", ["proximity .40 \u00b7 trajectory .25", "dark-window .20 \u00b7 anomaly .15", "MarineCadastre tracks"], "amber_e", "amber", "amber_d"),
        (0, "SUSPECT DOSSIERS", ["ranked vessels + confidence %", "dashboard map view", "court-ready PDF case file"], "green_e", "green", "green_d")]
for idx, t, subs, fl, ln, tc in row2:
    lines = [(t, 15.5, True, tc, 0)] + [(x, 11, False, "slate", 3) for x in subs]
    add_card(s, xs[idx], 5.25, 4.30, 2.00, fl, ln, lines)
for gx in (5.17 + 0.02, 9.82 + 0.02, 14.47 + 0.02):
    arrow(s, gx, 6.25, "\u25c0")
chips = ["PyTorch \u00b7 smp", "FastAPI \u00b7 MongoDB", "React \u00b7 Leaflet",
         "OpenDrift", "CMEMS \u00b7 ERA5", "MarineCadastre AIS"]
for i, chp in enumerate(chips):
    add_card(s, 0.87 + i * 3.055, 7.85, 2.92, 0.62, "gray_f", "gray",
             [(chp, 11.5, True, "slate", 0)], radius=0.5)
add_textbox(s, 0.7, 8.85, 18.6, 0.5,
    [("All inputs free & PS-sanctioned \u00b7 inference < 5 min per scene on Colab-class GPU", 13, False, "slate", 0)],
    PP_ALIGN.CENTER)

# ---------- SLIDE 4 : Feasibility & Viability ----------
s = prs.slides[3]
print("S4 removed:", clear_content(s))
tblf = s.shapes.add_table(5, 4, IN(0.7), IN(1.9), IN(9.7), IN(3.4))
tbl = tblf.table
for c_i, wd in enumerate((1.9, 3.6, 1.0, 3.2)):
    tbl.columns[c_i].width = IN(wd)
data = [["DATA", "SOURCE", "COST", "STATUS"],
        ["SAR images", "Sentinel-1 Copernicus", "Free", "Named in PS itself"],
        ["Training set", "Zenodo Parts I\u2013III + SOS", "Free", "3,500+ annotated scenes"],
        ["AIS tracks", "MarineCadastre / PS-provided", "Free", "Synthetic AIS allowed by PS"],
        ["Ocean + wind", "CMEMS \u00b7 ERA5 (cdsapi)", "Free", "Scripted download ready"]]
for r_i, row in enumerate(data):
    tbl.rows[r_i].height = IN(0.62 if r_i else 0.5)
    for c_i, val in enumerate(row):
        cell = tbl.cell(r_i, c_i)
        cell.margin_top = cell.margin_bottom = Emu(27432)
        p = cell.text_frame.paragraphs[0]
        run = p.add_run(); run.text = val
        f = run.font; f.name = "Segoe UI"
        f.size = Pt(10.5 if r_i else 11); f.bold = r_i == 0
        f.color.rgb = rgb("white" if r_i == 0 else "slate")
        if r_i == 0:
            cell.fill.solid(); cell.fill.fore_color.rgb = rgb("navy")
add_card(s, 0.7, 5.50, 9.7, 0.80, "teal_e", "teal",
         [("DATA RISK: ZERO \u2014 every input free & sanctioned by the problem statement", 13.5, True, "teal_d", 0)])
risk_lines = [("RISK \u2192 MITIGATION", 15, True, "amber_d", 0),
    ("\u2022 Look-alike slicks \u2192 dual-pol features + dedicated look-alike classes", 11.5, False, "slate", 7),
    ("\u2022 AIS gaps \u2192 synthetic-AIS evaluation track sanctioned by PS", 11.5, False, "slate", 5),
    ("\u2022 Drift uncertainty \u2192 ensemble spread reported as confidence %", 11.5, False, "slate", 5),
    ("\u2022 Compute limits \u2192 Colab-class GPU sufficient; <5 min inference", 11.5, False, "slate", 5)]
add_card(s, 10.7, 1.9, 8.6, 3.50, "amber_e", "amber", risk_lines,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP)
if SHOT.exists():
    pic = s.shapes.add_picture(str(SHOT), IN(10.7), IN(5.62), height=IN(2.95))
    add_textbox(s, 16.15, 6.45, 3.2, 1.7,
        [("Live prototype", 12, True, "green_d", 0),
         ("already running:", 11, False, "slate", 2),
         ("slick \u2192 suspects on interactive map", 11, False, "slate", 2)])
add_textbox(s, 0.7, 7.42, 18.6, 0.45,
    [("EXECUTION TIMELINE \u2014 6 WEEKS TO WORKING SYSTEM", 15, True, "navy_d", 0)], PP_ALIGN.CENTER)
weeks = [("W1", "data pipeline + baseline U-Net"),
         ("W2", "drift engine + ensemble runs"),
         ("W3", "AIS fusion + scoring API"),
         ("W4", "dashboard + case-file export"),
         ("W5", "validation: MSC ELSA III Kochi"),
         ("W6", "hardening + demo rehearsal")]
wcols = ["navy", "teal", "purple", "amber", "green", "slate"]
for i, (wk, desc) in enumerate(weeks):
    add_card(s, 0.7 + i * 3.115, 7.95, 3.02, 1.85, wcols[i], "white",
             [(wk, 15, True, "white", 0), (desc, 10, False, "white", 3)], radius=0.10)
add_textbox(s, 0.7, 9.95, 18.6, 0.45,
    [("Milestone proof: working prototype live at submission time", 12.5, False, "gray", 0)], PP_ALIGN.CENTER)

# ---------- SLIDE 5 : Impact & Benefits ----------
s = prs.slides[4]
print("S5 removed:", clear_content(s))
add_card(s, 0.7, 1.85, 18.6, 1.10, "navy", "white",
    [("7,500 km coast  \u00b7  75% of oil arrives by sea  \u00b7  Indian automated systems today: 0",
      18, True, "white", 0)])
cards = [
    ("COAST GUARD", "Response teams launch toward the right port/vessel within hours \u2014 not days.", "blue_e", "navy_d"),
    ("LEGAL EVIDENCE", "MARPOL + Merchant Shipping Act \u00a7356J dossiers built to survive court scrutiny.", "teal_e", "teal_d"),
    ("DETERRENCE", "Dark-vessel windows flagged automatically \u2014 polluters lose cover of night.", "amber_e", "amber_d"),
    ("BLUE ECONOMY", "Protects fisheries & tourism worth \u20b9 lakh-crore along the Indian littoral.", "purple_e", "purple_d"),
    ("SOVEREIGN TECH", "India joins EMSA-class nations; zero dependency on foreign services.", "green_e", "green_d"),
    ("OPEN RESEARCH", "Pipeline public \u2192 academia & startups extend it nationwide.", "gray_f", "slate")]
for i, (t, body, fl, tc) in enumerate(cards):
    r_, c_ = divmod(i, 3)
    add_card(s, 0.7 + c_ * 6.31, 3.30 + r_ * 3.50, 5.98, 3.25, fl, tc,
             [(t, 16, True, tc, 0), (body, 12.5, False, "slate", 8)],
             align=PP_ALIGN.LEFT)

# ---------- SLIDE 6 : References ----------
s = prs.slides[5]
add_textbox(s, 0.7, 8.55, 18.6, 2.1, [
    ("ADDITIONAL DATASETS & VALIDATION (2024\u20132026)", 13, True, "navy_d", 0),
    ("\u2022 Zenodo oil-spill SAR Parts I\u2013III \u2014 records 8346860 / 8253899 / 13761290", 11.5, False, "slate", 6),
    ("\u2022 Refined SOS dataset \u2014 zenodo.org/records/15298010", 11.5, False, "slate", 4),
    ("\u2022 MSC ELSA III (Kochi, May 2025) GNOME backtracking study \u2014 validation scenario", 11.5, False, "slate", 4),
    ("\u2022 NATPOLREX-X national pollution-response exercise \u2014 PIB release, 2025", 11.5, False, "slate", 4)])

# ---------- SLIDE 7 : delete ----------
xml_lst = prs.slides._sldIdLst
ids = list(xml_lst)
if len(ids) >= 7:
    tgt = ids[6]
    prs.part.drop_rel(tgt.get(qn("r:id")))
    xml_lst.remove(tgt)
    print("Slide 7 deleted.")

prs.save(str(PPTX))
print("SAVED:", PPTX.name)
