# SIH26143 — Idea Deck Content Spec (Judge-Rubric Aligned)

**How to use:** Every text block below is paste-ready. Coordinates are hints for a 20in × 11.25in (16:9) canvas. Rules honored: fixed template headers untouched · max 6 slides · points/diagrams only · no paragraphs.

---

## SLIDE 1 — Title Page (fix only)
- Replace `[Insert Team ID]` with your real Team ID from the SIH portal.
- Keep everything else as-is.

---

## SLIDE 2 — Proposed Solution (header stays)

### Zone A — Problem strip (top, y≈2.0in)
```
• India: 7,500 km coastline, ~75% of oil arrives by sea — zero automated spill-source attribution today
• Ennore 2017: two ships, 251 tonnes spilled, years of litigation — culprit identification was manual guesswork
```

### Zone B — Hero pipeline band (center, y≈4–7in) ← replaces AI mosaic
4 native chevron/arrow shapes left→right:

| Step | Label | Sub-line |
|---|---|---|
| 1 | **DETECT** | U-Net finds slick polygons in Sentinel-1 SAR |
| 2 | **REWIND** | OpenDrift runs ocean physics backwards to origin zone |
| 3 | **ATTRIBUTE** | AIS tracks cross-scored: proximity, heading, dark-window |
| 4 | **PROVE** | Ranked suspect dossier with confidence, ready as evidence |

### Zone C — Uniqueness box (right or bottom band, y≈8–10in)  [rubric: INNOVATION]
```
WHY NOBODY ELSE HAS THIS
• Only pipeline that reasons BACKWARDS in time from slick physics
• Catches "dark vessels" that switched AIS off during the spill window
• EU's CleanSeaNet needs analysts; ours runs end-to-end automatically & open-source
• India-first: sovereign capability instead of foreign service dependency
```

---

## SLIDE 3 — Technical Approach (header stays)

### Zone A — Architecture diagram (center, ~16×6in)
Insert `assets/architecture.svg` (crisp vector version of):

```
Sentinel-1 SAR (GRD, free)
   → Preprocess: calibrate · speckle filter · land mask
   → U-Net segmentation (Zenodo-trained) → slick polygon GeoJSON
   → OpenDrift OpenOil backward hindcast (ensemble ×100)
        wind drift 1–6% · Ekman angle · Stokes drift
   → Origin probability map (PDF over sea surface)
   → AIS fusion scoring:  proximity .40 | trajectory .25 | dark-window .20 | anomaly .15
   → Ranked suspect vessels → Dashboard + PDF case file
```

### Zone B — Tech chips row (bottom, y≈9.5–10.5in)
```
PyTorch · segmentation_models_pytorch | FastAPI · MongoDB | React · Leaflet
OpenDrift | Copernicus Marine · ERA5 | MarineCadastre AIS
```

---

## SLIDE 4 — Feasibility & Viability (header stays)

### Zone A — Data-risk table (left half)  [rubric: FEASIBILITY]
```
DATA          SOURCE                      COST     STATUS
SAR images    Sentinel-1 Copernicus       Free     Named in PS itself
Training set  Zenodo Parts I–III + SOS    Free     3,500+ annotated scenes
AIS tracks    MarineCadastre / PS-provided Free    Synthetic AIS permitted by PS
Ocean+wind    CMEMS · ERA5 (cdsapi)       Free     Scripted download ready
→ Data risk: ZERO — every input is free & problem-statement-sanctioned
```

### Zone B — Risk → Mitigation (right top)
```
Look-alike slicks  → dual-pol features + dedicated classes (ship wake/biogenic)
AIS gaps           → synthetic-AIS evaluation track sanctioned by PS
Drift uncertainty  → ensemble spread reported as confidence %, never single guess
Compute limits     → Colab-class GPU sufficient; inference <5 min per scene
```

### Zone C — Execution timeline bar (full width bottom, y≈8.5–10.5in)  [rubric: TIMELINE — most-missed criterion]
```
W1  data pipeline + baseline U-Net      W2  drift engine + ensemble
W3  AIS fusion + scoring API            W4  dashboard + case-file export
W5  validation (MSC ELSA III Kochi)     W6  hardening + demo rehearsal
Milestone proof: working prototype already live at submission time
```

### Zone D — Real screenshot (small frame, right mid)
Insert `assets/dashboard_map.png` — caption: `Live prototype: slick → suspects on map`.

---

## SLIDE 5 — Impact & Benefits (header stays)

### Stat banner (top, y≈2–3in)
```
7,500 km coast  ·  75% of oil arrives by sea  ·  Indian systems today: 0
```

### Six benefit cards (2 rows × 3, y≈3.5–10in)  [rubric: IMPACT]

| Card | Text |
|---|---|
| Coast Guard | Response teams launch toward the *right* port/vessel within hours, not days |
| Legal evidence | MARPOL + Merchant Shipping Act §356J dossiers survive court scrutiny |
| Deterrence | Dark-vessel windows get flagged — polluters lose the cover of night |
| Blue Economy | Protects fisheries & tourism worth ₹ lakh-crore along Indian littoral |
| Sovereign tech | India joins EMSA-class nations; no foreign-service dependency |
| Open research | Pipeline public → academia & startups extend it nationwide |

---

## SLIDE 6 — Research & References (append these)
```
• Zenodo Parts I–III oil-spill SAR datasets — records 8346860 / 8253899 / 13761290
• Refined SOS dataset — zenodo.org/records/15298010
• MSC ELSA III (Kochi, May 2025) GNOME backtracking case study — validation scenario
• NATPOLREX-X national pollution-response exercise — PIB release, 2025
• (keep all existing paper citations unchanged)
```

---

## SLIDE 7 — DELETE ENTIRELY
Then: **File → Export → PDF** (upload PDF only) · verify final deck = exactly 6 slides.
