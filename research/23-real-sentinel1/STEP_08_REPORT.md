# Step 08 — REAL SENTINEL-1 VALIDATION + SAR DETECTOR HARDENING

## REAL SENTINEL-1 **MEASUREMENT** PROCESSED: **NO** (download still blocked)

This step converts the Step 07 SAR prototype into a scientifically defensible
real-Sentinel-1 **investigation** pipeline and hardens the detector. Crucially:

* **Real Sentinel-1 GRD product *discovery* is now LIVE and validated** — the
  anonymous Copernicus Data Space **STAC catalog search** is exercised from this
  machine and returns genuine Sentinel-1 GRD products over the Arabian Sea AOI.
* **Real GRD *download / processing* remains blocked** because no
  `CDSE_USERNAME` / `CDSE_PASSWORD` are configured. Download on CDSE is always
  authenticated; there is no legitimate credential-free path to GRD measurement
  data. We document the blocker, implement the credential-gated download seam,
  and do **not** fabricate a "real processed" result.

This report distinguishes — with sources — official Copernicus documentation,
community GitHub tooling, published literature, and our own engineering
judgement, so judges can see exactly what is real, what is assumption, and what
is a documented blocker.

---

## 1. Objective & scope
Turn the Step 07 SAR prototype (fixture/synthetic only) into a real-data-ready
investigation pipeline:
1. **Real Sentinel-1 access** — implement the current, honest discovery path
   (anonymous STAC) and a credential-gated download seam (OData).
2. **Detector hardening** — add the physical signal (local backscatter contrast)
   and incidence-angle qualification that make the classical detector more
   defensible, while preserving determinism and Step 07 behaviour.
3. **Honest provenance** — real / cached / fixture / synthetic / unavailable are
   never conflated; no fabricated real results.
4. **ML realism** — decide whether SegFormer/ONNX is justified *now* (it is not)
   and document it as future work with blockers.

## 2. Scientific honesty constraints (enforced end-to-end)
- Provenance is a frozen `ProvenanceState` (`REAL_SENTINEL1`, `CACHED_SENTINEL1`,
  `LOCAL_FIXTURE`, `SYNTHETIC`, `UNAVAILABLE`) propagated verbatim
  Python → Spring Boot → MongoDB → UI. A fixture/synthetic scene is **never**
  labelled as real Sentinel-1.
- The catalog path is **not** a fabricated "real detection": it returns real STAC
  *product metadata* (over which our detector is *not* claimed to run), and a
  failed/unreachable search returns a structured `unavailable` report with the
  blocker — never a fabricated scene.
- The detector never **fabricates** detections (plain scene → 0 candidates, tested).
- **Age** is still not estimated from a single scene (`age_available=false`).
- A dark SAR feature is **not uniquely oil**; candidates carry a classification;
  the new **contrast** metric is the primary physical discriminator.
- **No credentials are embedded** in code, logs, Git, or screenshots (env-only).

## 3. Current go/no-go status of every SAR source/detector
`GET /api/sar/preview` (verified live, this machine):

| Source / detector | Status | Note |
|---|---|---|
| `local_fixture` | AVAILABLE | committed demo scene (SYNTHETIC/DEMO). |
| `synthetic` | AVAILABLE | deterministic generated scene. |
| `cached_sentinel1` | UNAVAILABLE | set `SAR_CACHE_DIR` to a real scene cache. |
| `real_sentinel1` | **UNAVAILABLE** | missing `CDSE_USERNAME`/`CDSE_PASSWORD`; anonymous **STAC catalog search available** via `GET /api/sar/catalog`. |
| `classical_dark_spot` | AVAILABLE | deterministic, offline, **contrast-gated** v2. |
| `onnx` | UNAVAILABLE | no `SAR_ONNX_MODEL` artifact configured. |

## 4. Real Sentinel-1 discovery: LIVE anonymous STAC search (validated)
The current (Sep 2026) maintained CDSE discovery API is **STAC**. Legacy
`sentinelsat`/DHuS (SciHub) is **deprecated/archived** and does not work against
CDSE. STAC **search is anonymous**; download is authenticated. Source: official
CDSE docs (`documentation.dataspace.copernicus.eu/APIs.html`, `/APIs/STAC.html`,
`/APIs/OData.html`, `/APIs/Token.html`).

**Implementation** — `scientific-service/app/sar/catalog.py`:
* `POST https://stac.dataspace.copernicus.eu/v1/search` with `collections=[
  sentinel-1-grd]`, `bbox`, `datetime`, and a **CQL2-JSON** filter
  (`filter-lang: "cql2-json"`). (The legacy `cql2-text` string form is rejected
  by the current API — empirically verified; the working form is CQL2-JSON dict.)
* SAR polarization is an *array* property (e.g. `["VV","VH"]`); array-vs-scalar
  equality is rejected, so the query filters by acquisition mode and we filter
  `VV` by **containment** in Python — still honest (we select, we never fake).
* On network/catalog failure the endpoint returns `status=unavailable` with the
  exact blocker and **zero** products — it never substitutes a fixture.

**Live result (this machine, 3 Sep 2026)** — `GET /api/sar/catalog` returned
`status=available`, **6 real Sentinel-1 GRD products** over bbox
`[71,13,74,16]` (Arabian Sea shelf, Gujarat coast) in the last 30 days:

| Acquisition time (UTC) | Orbit | Polarization | Mode | Satellite |
|---|---|---|---|---|
| 2026-09-01T00:55:20 | descending | VV,VH | IW | S1D |
| 2026-09-01T00:54:55 | descending | VV,VH | IW | S1D |
| 2026-08-20T00:55:19 | descending | VV,VH | IW | S1D |
| 2026-08-20T00:54:54 | descending | VV,VH | IW | S1D |
| 2026-08-08T00:55:19 | descending | VV,VH | IW | S1D |
| 2026-08-08T00:54:54 | descending | VV,VH | IW | S1D |

This proves the real-data catalog is reachable, that real VV+VH IW GRD products
are available over our study region on a ~12-day cadence, and that the current
operational constellation includes **Sentinel-1D** (consistent with S1C having
become operational from Jan 2025 and the constellation having since expanded;
S1B was decommissioned in Dec 2021 — official CDSE mission status).

## 5. Credential-gated download seam (not executed — no credentials)
`CachedSentinel1Provider` requires `SAR_CACHE_DIR`; `RealSentinel1Provider`
requires `CDSE_USERNAME`/`CDSE_PASSWORD`. The provider:
1. Finds a real product by the same STAC search (never invents a scene id).
2. Requests an **OAuth2 token** at
   `identity.dataspace.copernicus.eu/.../token` (client `cdse-public`,
   `grant_type=password`) built **only from the environment**.
3. Would stream the OData `Products({id})/$zip` (or `$value`) to `SAR_CACHE_DIR`
   and parse the SAFE measurement to a normalised `SarScene` via
   `app/sar/preprocess` (the documented integration point, covered by tests).

Without credentials the provider raises `SarSourceError` and the pipeline
reports `status=unavailable` with the precise blocker (verified via
`POST /api/sar/detect {source: REAL_SENTINEL1}` → `unavailable`, 0 candidates).
No code path fabricates a scene.

## 6. Detector hardening (classical dark-spot, v1.0.0 → v2.0.0)
Grounded in the SAR oil-spill literature (Solberg et al. 2007; Shu et al. 2010;
Mera et al. 2012; Alpers et al. 2017; ESA S1-GRD spec) and the CDSE S1 GRD specs.

**Changes (all additive — the segmentation and Step 07 candidate set are
unchanged, preserving the 9 existing SAR tests):**
1. **Local-contrast metric (new `contrast_db` field).** Per-candidate backscatter
   contrast against the scene's measured open-sea reference, dB. This is the
   primary physical signal that separates a real slick (6–17 dB) from a marginal
   dark region. Reported on every candidate: fixture OIL_CANDIDATE = **5.99 dB**,
   LOOK_ALIKE (circular) = **5.0 dB**, LOOK_ALIKE (small) = **5.5 dB**.
2. **Weak-contrast confidence gating.** Candidates with < 3 dB downgrade to
   ≤ 0.40 and are relabelled `UNCERTAIN` if they were `OIL_CANDIDATE` (with an
   explicit low-contrast warning); 3–5 dB limits oil confidence to ≤ 0.68. A
   nearly-invisible dark region can no longer be reported as a confident slick.
3. **Incidence-angle qualification (new optional `incidence_deg`).** When a real
   GRD scene carries per-pixel incidence metadata, candidate mean incidence is
   recorded and low angles (< 25°) limit confidence (low incidence is associated
   with more look-alikes). Absent/invented values are `None` (verified: fixture
   → `None`; synthetic incidence scene → exact mean).
4. **Look-alike handling preserved & now contrast-aware.** Compact regions keep
   the low-wind/rain hint; weak contrast is flagged as a borderline signature.

**Honest position:** this is *candidate flagging with quantified, physically
grounded confidence*, not oil confirmation. A tuned classical threshold (e.g.
Park et al. 2024: F1≈0.80 on dark-spot detection) is a defensible baseline with
zero training-data cost.

## 7. ML (SegFormer / ONNX) decision — NOT justified now, documented as future
Research (Sep 2026) found:
* **No public downloadable weights + dataset combination** exists for
  Sentinel-1 SAR oil-spill segmentation. ROBORDER/M4D (used to train the cited
  SegFormer-B2, Oil IoU ≈ 0.566) is **request-only**, not public. DARTIS
  (CC BY 4.0) is object-level, not 5-class. Peruvian Coastal (CC BY 4.0) has
  pixel masks but no published SegFormer weights.
* **Domain shift degrades ML badly** on cross-domain zero-shot evaluation
  (FCS-Net: Oil IoU 89.6% → 42.9%; SegFormer worse). Running a model trained on
  Mediterranean/Gulf data on Indian-Ocean scenes is likely no better than a
  tuned classical threshold, without any public checkpoint to actually deploy.
* **The look-alike problem is unsolved by ML** — it is the same physical
  ambiguity in any architecture.

**Decision:** keep and harden the **classical detector**; keep the ONNX detector
as a documented seam (`SAR_ONNX_MODEL` gates it) and record SegFormer as future
work with blockers (dataset access, domain shift, no public weights, ~8 GPU-h
training + network).

## 8. Touched components & verification
**Scientific service (Python/FastAPI):**
* `app/sar/contract.py` — `SlickCandidate.contrast_db`, `.incidence_deg`;
  `SarScene.incidence_deg` optional field.
* `app/sar/detectors/classical.py` — v2.0.0 contrast + incidence gating.
* `app/sar/catalog.py` — STAC search + OData seam + `report_catalog_availability`.
* `app/sar/scenes.py` — real provider credential-gated download; cache note.
* `app/sar/config.py` — `sar_cache_dir`, updated availability report.
* `app/main.py`, `app/models/sar.py` — `/api/sar/catalog`, `contrast_db`/`incidence_deg`.
* **Tests: 40 passed** (32 Step-07 + 8 new Step-08: catalog helpers, catalog
  endpoint honesty, real-source gating, contrast reporting, weak-contrast
  downgrade, incidence qualification).

**Backend (Spring Boot):**
* `SarService.buildCandidates` passes through `contrast_db`/`incidence_deg`.
  **Tests: 39 passed.**

**Frontend (React / MapLibre + deck.gl):**
* `contrast_db` surfaced as `Δσ⁰ x.x dB` per candidate row.
  **`tsc -b` clean, `vite build` succeeds.**

## 9. Live end-to-end verification (this machine)
1. `GET /api/sar/catalog` → `available`, 6 real S1D GRD products (above).
2. `POST /api/sar/detect` (fixture) → `completed`, `LOCAL_FIXTURE`, detector
   `classical_dark_spot v2.0.0`, conf 0.49; candidates report contrast
   (OIL 5.99 dB / LOOK 5.0 / 5.5 dB), incidence `None`.
3. `POST /api/sar/detect` (`REAL_SENTINEL1`) → status `unavailable`, 0 candidates.
4. Backend proxy `POST /api/simulation/{id}/sar/detect` → `completed` with the
   same contrast fields; `GET /{id}/sar/observations` reads back cleanly.

## 10. Key limitations (documented, not hidden)
- **GRD download/processing blocked** — no CDSE credentials; download is always
  authenticated. Real *measurement* data is not processed this step.
- Our real "validation" is **discovery-level** (real product metadata), not a
  detection on real pixels; the detector is validated on fixtures/synthetic.
- The contrast/incidence logic is heuristic and scene-calibrated; it is not a
  calibrated CFAR and has no ground-truth validation against real spills here.
- Age and thickness remain unavailable.

## 11. Key references
**Official (Copernicus / ESA):**
- CDSE APIs & status: https://documentation.dataspace.copernicus.eu/APIs.html
- CDSE STAC: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- CDSE OData: https://documentation.dataspace.copernicus.eu/APIs/OData.html
- CDSE Token/auth: https://documentation.dataspace.copernicus.eu/APIs/Token.html
- CDSE Sentinel-1 data: https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel1.html
- CDSE quotas: https://documentation.dataspace.copernicus.eu/Quotas.html
- openEO oil-spill example (preprocessing basis):
  https://documentation.dataspace.copernicus.eu/APIs/openEO/openeo-community-examples/python/OilSpill/
- Filipponi (2019), *Sentinel-1 GRD Preprocessing Workflow*, MDPI Proceedings 18:11. DOI 10.3390/ECRS-3-06201

**Community tooling (GitHub / PyPI):**
- `cdse-client` (active CDSE client, STAC+OData, MIT): https://github.com/VTvito/cdse-client
- `xarray-sentinel` (SAFE reader, Apache-2.0): https://github.com/bopen/xarray-sentinel
- Note: `sentinelsat` is archived and does **not** work with CDSE.

**Literature:**
- Solberg, Brekke & Husøy (2007), *Oil spill detection in SAR imagery* (Bayesian multi-rule).
- Shu et al. (2010), *Dark-spot detection from SAR intensity imagery*, RSE 114:996–1006.
- Mera et al. (2012), wind-integrated adaptive thresholding, *IEEE TGRS*.
- Alpers et al. (2017), *Oil spill detection by imaging radars: challenges and pitfalls*, RSE 201:133–147.
- Park et al. (2024), semi-empirical dark-spot threshold (F1≈0.80), *IEEE GRSL*. DOI 10.1109/lgrs.2024.3355464
- FCS-Net cross-domain results: DOI 10.3390/jmse14020168

**Datasets (ML future work):**
- DARTIS (Kaggle/PANGAEA, CC BY 4.0); PERUVIAN COASTAL (IEEE DataPort, CC BY 4.0);
  SOS (Zenodo, research use). ROBORDER/M4D — request-only, not public.

**Source labelling:** Sections marked *official* are from the official URLs above;
*community* from the linked GitHub/PyPI; *literature* from the cited papers; the
engineering decisions (contrast gating thresholds, CQL2-JSON form, containment
filter) are our own judgement and are flagged as such in the text.
