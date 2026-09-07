# Step 07 — SAR Oil-Spill Observation & Detection (detect_slick / characterize_slick)

## REAL SENTINEL-1 PROCESSED: **NO**

This step demonstrates the **offline/demo path** (`LOCAL_FIXTURE` and `SYNTHETIC`),
**not** real Sentinel-1. No Copernicus Data Space credentials
(`CDSE_USERNAME` / `CDSE_PASSWORD`) are configured in this environment, so the
`REAL_SENTINEL1` provider is unavailable (it reports a precise blocker rather
than substituting a fixture). Real-data processing is **credential-gated** and
the architecture wires the seam for it; it is simply not exercised here.

## Scientific Honesty Constraints (enforced end-to-end)
- A fixture/synthetic scene is **never labelled as real Sentinel-1**. Provenance
  is a frozen `ProvenanceState` (`REAL_SENTINEL1`, `CACHED_SENTINEL1`,
  `LOCAL_FIXTURE`, `SYNTHETIC`, `UNAVAILABLE`) propagated verbatim Python → Spring
  Boot → MongoDB → the UI.
- The detector never **fabricates** detections: a plain no-feature scene yields
  **zero** candidates (tested).
- **Age is not estimated**: a single scene provides no temporal basis, so
  `age_available=false` and a warning is emitted instead of inventing a number.
- A dark SAR feature is **not uniquely oil**: candidates are classified
  `OIL_CANDIDATE` / `UNCERTAIN` / `LOOK_ALIKE / REJECTED` with a confidence, and
  look-alikes (low-wind/rain-cell, biogenic) carry explicit hints.

## What was built & verified

### Scientific service (Python/FastAPI)
- `app/sar/` — contract, config, preprocess, fixture, scenes, pipeline, and a
  self-contained **classical dark-spot detector** (`detectors/classical.py` +
  `_contour.py`, no cv2/skimage/onnx dependency).
- Detector uses a **scene-calibrated adaptive sea reference**
  (contaminant-robust `np.nanmedian` over valid sea pixels − `depth_offset_db`)
  plus a **coastal land buffer** that eliminates a border artifact.
- Endpoints: `GET /api/sar/preview` (honest availability of every source/detector),
  `POST /api/sar/detect` (runs the full observation). APP_VERSION `0.3.0`.
- Verified `process_observation(source='LOCAL_FIXTURE')` → `COMPLETED`,
  **3 candidates**:
  - `OIL_CANDIDATE` — 5406 px, AR 3.80, conf 0.78, 64.28 km²
  - `LOOK_ALIKE` (circular, low-wind/rain hint) — 969 px, AR 1.04, conf 0.35, 11.43 km²
  - `LOOK_ALIKE` (small speck) — 101 px, AR 1.09, conf 0.35, 1.13 km²
  - Plain scene → **0 candidates**. Tests pass: **32** total in scientific suite.

### Backend (Spring Boot)
- `SarService` orchestrates: broadcast `sar_observation.started` → WebClient POST
  to Python → persist lightweight `sar_observation` metadata (no raster) → broadcast
  `sar_observation.completed` with a map-friendly result, or `failed`. Provenance
  preserved exactly.
- Endpoints: `POST /{id}/sar/detect`, `GET /{id}/sar/observations` (replay state).
- Fixed a Mongo `MappingInstantiationException` by storing candidates/scene
  footprint as **plain maps** (Jackson `ObjectNode` has no no-arg constructor).
- Tests pass: **39** total in backend suite.

### Frontend (React / MapLibre + deck.gl)
- `useSarLayers()` renders the scene footprint and each slick candidate as filled
  deck.gl polygons (colour by classification) + centroid markers, gated by the
  map-store layer catalogue (`sarSlicks` / `sarFootprint`).
- `SarObservationPanel` shows provenance chip (REAL/CACHED/DEMO/SYNTHETIC/
  UNAVAILABLE), confidence, slick area, honest age, and the candidate list with
  look-alike warnings; auto-loads persisted observations on mount.
- Verified via CDP browser: page renders with **0 console errors**; the panel
  shows the persisted `DEMO FIXTURE` observation — `OIL CANDIDATE conf 0.78 ·
  64.28 km² aspect 3.80` and two `LOOK_ALIKE` — once a simulation is active.
- `tsc -b` clean, `vite build` succeeds.

## Verified live end-to-end
1. Create simulation → `POST /api/simulation/{id}/sar/detect`
   → status `completed`, `source_state=LOCAL_FIXTURE`, `age_available=false`.
2. `GET /{id}/sar/observations` returns the persisted 3-candidate record with
   `sceneFootprint` (72.0,15.0 / 72.32,14.68 bbox) and per-candidate geometry.

## Key limitations (documented, not hidden)
- Real Sentinel-1 requires CDSE credentials and a chosen scene; out of scope here.
- Age is unavailable (single scene, no temporal basis).
- Classical detector cannot prove oil; it reports confidence + look-alike hints.
- ONNX segmentation detector is a clean seam but no weights are vendored
  (`onnx_available=false` → documented fallback to classical).

## Key references
- Sentinel-1 GRD dark-spot detection methodology (VV, low incidence).
- Look-alike discrimination: dark SAR features are not uniquely oil
  (low wind, rain cells, biogenic slicks).
