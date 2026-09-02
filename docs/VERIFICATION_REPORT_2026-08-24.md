# ✅ VERIFIED SOURCES REPORT — SIH26143

> **Project:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO · Space Tech · Software)
> **Verification date:** Monday, 24 August 2026
> **Method:** Every item checked LIVE against official APIs/registries — Zenodo REST API, GitHub API, PyPI, npm registry, HuggingFace API, and providers' own pages. No guesses. Failed or drifted claims are flagged in §7.

---

## 1. Project Statement Summary

PS **SIH26143** (NTRO · Space Tech · Software): build an end-to-end, open-source pipeline that:

1. **DETECTS** oil slicks in Sentinel-1 SAR via U-Net segmentation,
2. **REWINDS** ocean physics backwards with OpenDrift to produce an origin probability map,
3. **ATTRIBUTES** the source vessel by fusing AIS tracks with the origin PDF (proximity / bearing / dark-window / anomaly scoring),
4. **PROVES** it with a ranked dossier + court-ready case file.

---

## 2. Training Datasets — ALL LIVE & FREE ✅

| Dataset | Verified proof | License |
|---|---|---|
| Zenodo Part I `8346860` | API: open access; 1,200 oil imgs + masks; file = **40,712,942,445 bytes (40.7 GB exactly as docs claim)** | CC-BY-4.0 |
| Zenodo Part II `8253899` | API: open; 685 no-oil + 685 lookalike, 2048×2048×2 TIFF | CC-BY-4.0 |
| Zenodo Part III `13761290` | API: open; test set 150 oil / 150 lookalike / 150 clean; file = 9.86 GB (docs said 9.9 ✓); 1,900+ downloads | CC-BY-4.0 |
| Refined-SOS `15298010` | API: "Refined Deep-SAR Oil Spill dataset", published 2025-04-28; images.zip + masks.zip downloadable | CC-BY-4.0 |
| DARTIS PANGAEA `10.1594/PANGAEA.980773` | Confirmed by PANGAEA record + ESSD paper + B2FIND: **"OpenAccess: true"**, 2,290 no-oil patches (exact match); code repo `yi-jie-yang/dataset_DARTIS_2019` on GitHub | CC-BY-4.0 |
| CSIRO `csiro:57430` | Portal record live: **N=5,630 chips (exact match)**, DOI 10.25919/4v55-dn16, "metadata and files available to the public" | CC-BY-SA-4.0 |

---

## 3. Satellite / Ocean / Wind / AIS Data — ALL LIVE & FREE ✅

| Source | Verified proof | Cost |
|---|---|---|
| Copernicus Data Space Ecosystem (Sentinel-1 GRD) | Site live: "free instant access… free and open data policy"; register → download | Free (registration) |
| CMEMS currents `GLOBAL_ANALYSISFORECAST_PHY_001_024`, dataset `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m` | Product page + official PUM PDF confirm exact ID; 1/12° ≈ 8 km grid as docs claim; data updated daily through June 2026 | Free (registration) |
| `copernicusmarine` toolbox | PyPI v2.4.1 live; GitHub `mercator-ocean/copernicus-marine-toolbox`, pushed 2026-08-24 (today), EUPL-1.2 | Free |
| ERA5 winds (CDS) | CDS page updated 2026-08-24 (today); hourly, 1940→present; DOI 10.24381/cds.adbb2d47 | Free (CC-BY) |
| `cdsapi` client | GitHub `ecmwf/cdsapi`, Apache-2.0, active | Free |
| NOAA MarineCadastre AIS | Live download index for 2025 + FAQ updated May 2026 | Free (US Gov) |

---

## 4. Core Software — ALL EXIST, ACTIVE, FREE ✅

| Tool | Proof (GitHub API / PyPI, checked 2026-08-24) | License ⚠️ |
|---|---|---|
| OpenDrift / OpenOil | Pushed **2026-08-21**; PyPI v1.14.10, Python ≥ 3.9. **Backward tracking proven in source**: `if self.time_step.days < 0 # Backwards simulation`; official docs: "Can simulate backwards in time (negative time step)" + Leeway-backtracking example with `time_step=-900` | **GPL-2.0** — fine if project is open-sourced / kept as separate subprocess (it already is, per Backend doc) |
| segmentation-models-pytorch | 11.7k★, pushed today | MIT |
| pytorch-grad-cam | 12.9k★, active | MIT |
| MovingPandas | BSD-3-Clause, active; `TrajectoryStopDetector` verified in tutorials; Danish Maritime Authority AIS ship-data tutorial verified live | BSD-3 |
| albumentations | PyPI v2.0.8, MIT (old GitHub repo archived — package still maintained on PyPI) | MIT |
| rasterio, scikit-learn, FastAPI, torch | All active; sklearn BSD-3, FastAPI MIT (101k★) | Free |

---

## 5. Model Fallbacks & Method Reference Repos ✅

- **links-ads/sar-oilspill-detection HF Space** — exists (API verified): MIT license, `assets/models/model.onnx` downloadable → Plan-B inference works.
  ⚠️ Runtime currently **PAUSED** ("live demo online" is not running right now — anyone can resume it, but do not promise a live demo in the pitch).
- **jinhonav/SAR_Oil_Spill_Segmentation_Deeplearning** — exists, created Jun 2026, Jupyter notebooks, DeepLabV3 + hard-negatives (matches doc description). Raw LICENSE fetched: **genuine MIT** (Copyright (c) 2026 jinhonav).

---

## 6. Validation Scenario & References ✅

- **MSC ELSA III paper:** *"Harnessing cloud-based SAR earth observation and GNOME numerical simulation for modelling the MSC ELSA III oil spill trajectory: Insight from the Kochi coast in south-eastern Arabian sea"* — Bhattacharya et al., *Regional Studies in Marine Science*, **DOI 10.1016/j.rsma.2026.104844**, PII S235248552600099X confirmed; uses NOAA GNOME ✅.
  Incident corroborated by Kerala SDMA (sank 0750 h, 25 May 2025, position 09°18.75′N 076°08.16′E) + Reuters.
- **INCOIS OOSA** (`oosa.incois.gov.in`) — live portal; forward-only trajectory advisories up to 96 h using GNOME → confirms the "complementary, backward-attribution" positioning.
- **EMSA CleanSeaNet** — live since 2007, but analyst-in-the-loop and restricted to participating States → "automated, open-source, India-first" differentiation holds.

---

## 7. Frontend Stack (npm registry, verified 2026-08-24)

| Package | License |
|---|---|
| react | MIT |
| leaflet | BSD-2-Clause |
| react-leaflet | **Hippocratic-2.1** (free for students/hackathon use; only bars harmful commercial use) |
| recharts | MIT |
| lucide-react | ISC |
| motion | MIT |
| axios | MIT |
| html2canvas | MIT |
| jspdf / jspdf-autotable | MIT |

MongoDB server is SSPL — free to *use* in this project (only restricts reselling it as a DB service).

---

## 8. ⚠️ Corrections To Apply In Docs / Deck

1. **MarineCadastre format changed:** since ~2024 files are **daily national `.csv.zst`** (not per-UTM-zone ZIPs). Update Playbook E in `02_Data_Environment_Researcher.md`.
2. **HF demo paused** — say "weights downloadable (MIT)" instead of "live demo online".
3. **ELSA III paper date:** published **12 Feb 2026**, not Mar 2026.
4. **OpenDrift license is GPL-2.0** — fine for SIH (project will be open-source anyway), but state it correctly if judges ask.

Everything else checks out exactly — including byte-level file sizes and image counts. The stack is 100% real, current, and free for student use.
