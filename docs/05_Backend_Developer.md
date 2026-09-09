# ⚙️ Member 5 — Backend Developer

> **PS:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO, Space Tech, Software)
> **Your one-line job:** Be the engine room — wrap ML inference, physics simulations and suspect scoring behind clean FastAPI endpoints that the frontend can consume without ever knowing the science underneath.

---

## 🎯 Your Mission in Plain Words

Frontend asks: *"give me incident #7 with its slick, the rewind frames, and ranked suspects."*
You orchestrate: call the ML guy's model → hand polygons to the physics guy's OpenDrift script → fuse outputs with clean AIS data → score & rank ships → store everything in MongoDB → serve JSON. You already have a working base: `backend/main.py` (FastAPI + Motor + demo zones) — **extend it, don't rewrite it.**

---

## 🏗️ Architecture

```
React (:5173) ──/api──► FastAPI (:8000)
                          ├── MongoDB (incidents, jobs, suspects)      [existing motor setup]
                          ├── ML service    → torch model → slick GeoJSON
                          ├── Drift runner  → subprocess → opendrift script → NetCDF/PDF frames
                          ├── Scoring       → factor fusion → ranked suspects
                          └── File store    → GeoJSON / KML exports
```

CORS for `localhost:5173` is already configured in `main.py` ✅. The Vite proxy `/api/* → :8000` is already set ✅.

## 📁 Proposed Layout

```
backend/
├── main.py                 ← existing; keep startup/shutdown + demo fallback
├── app/
│   ├── routers/            incidents.py, drift.py, suspects.py, export.py
│   ├── services/           ml_service.py, scoring.py, geo_io.py
│   ├── workers/            drift_runner.py   (subprocess wrapper for Physics' script)
│   └── schemas/            pydantic models = THE contract
├── models/                 model.pth (from ML teammate)
├── scripts/                run_drift.py --config params.json --slick slick.geojson (Physics owns logic, you own interface)
└── .env                    MONGO_URL=... DB_NAME=sih26143 MODEL_PATH=./models/model.pth
```

## 🔌 Endpoint Contract (lock this with Frontend Day 2)

| Method & Path | Request | Response |
|---|---|---|
| `GET /api/zones` *(exists)* | — | monitored zones list |
| `POST /api/incidents` | name, observedAt, slick GeoJSON upload (`python-multipart`) | `{id}` created in Mongo |
| `POST /api/detect/{incident_id}` | SAR scene file ref | runs segmentation → stores slick GeoJSON + confidence |
| `POST /api/drift/{incident_id}` | optional param overrides | `{job_id}` — starts background hindcast |
| `GET /api/jobs/{job_id}` | — | `{status, progress%, artifacts[]}` |
| `GET /api/suspects/{incident_id}` | — | `Suspect[]` ranked (schema below) |
| `GET /api/export/{incident_id}?fmt=geojson\|kml` | — | downloadable case-file bundle |

```jsonc
// GET /api/suspects/:id  (matches frontend types.ts exactly)
{ "suspects": [{
    "mmsi": "419001234", "vesselName": "MT EXAMPLE", "rank": 1, "score": 87.2,
    "factors": { "proximity": 0.91, "consistency": 0.78, "darkWindow": 0.83, "anomaly": 0.66 },
    "evidence": [ { "label": "AIS gap", "detail": "47 min within emission window" } ] }] }
```

---

## 🧵 Long Jobs Without Blocking (the core backend skill here)

Drift simulations take minutes. Pattern: FastAPI `BackgroundTasks` + a jobs registry:

```python
import asyncio, uuid
jobs: dict[str, dict] = {}          # or a mongo collection

@app.post("/api/drift/{incident_id}")
async def run_drift(incident_id: str, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "progress": 0}
    bg.add_task(drift_job, incident_id, job_id)
    return {"job_id": job_id}

def drift_job(incident_id: str, job_id: str):
    jobs[job_id]["status"] = "running"
    proc = subprocess.run(
        ["python", "scripts/run_drift.py",
         "--slick", f"store/{incident_id}/slick.geojson",
         "--config", "params.json",
         "--out",  f"store/{incident_id}/hindcast.nc"],
        capture_output=True, text=True)
    jobs[job_id].update(status="done" if proc.returncode == 0 else "failed",
                        artifacts=[f"store/{incident_id}/hindcast.nc"])
```

Frontend polls `/api/jobs/{id}` every ~2 s. Keep heavy science in the **subprocess** so a crash never kills the API.

> 🪟 **Windows reality check:** `pip install opendrift` on native Windows often fights (GDAL/Fiona wheels). Options that work: dedicated conda env or WSL. Isolating via subprocess means you can even point to a venv's python explicitly: `[venv_python, "scripts/run_drift.py", ...]`.

## 🤖 Serving the ML Model

```python
# services/ml_service.py — load ONCE at startup
model = torch.load(settings.MODEL_PATH, map_location="cpu").eval()

def detect(scene_tiff_path: str):
    tiles = tile_scene(scene_tiff_path, size=512)         # rasterio
    mask  = infer(model, tiles)                           # batched, AMP if cuda
    polys = rasterio.features.shapes(mask)                # → shapely
    return to_geojson(polys, crs="EPSG:4326")             # confidence per polygon
```

Requirements to add: `pip install python-multipart aiofiles rasterio xarray netcdf4 shapely`

## 🗄️ MongoDB Schemas (Motor, async)

```js
incidents: { _id, name, observedAt, slickGeojson, sceneRef, status }
jobs:      { _id, incidentId, type:"drift", status, progress, artifacts[], log }
suspects:  { incidentId, mmsi, vesselName, score, factors{}, evidence[], computedAt }
```

Keep the existing DEMO-mode pattern from main.py (in-memory fallback when Mongo is down) — it has already saved demos before.

## 🧮 Scoring Fusion (ML teammate supplies weights config)

```python
WEIGHTS = json.load(open("params.json"))["weights"]     # {proximity:.40, consistency:.25, dark:.20, anomaly:.15}
score = 100 * sum(w * factors[k] for k, w in WEIGHTS.items())
suspects.sort(key=lambda s: -s["score"])               # rank 1..N, attach evidence chips
```

Origin-PDF proximity: sample each track point against the physics output heatmap grid (xarray → nearest-neighbor lookup).

Exports: GeoJSON native; KML via simple template (or `fastkml`). Ship `.shp` only if time permits (pyshp).

---

## 📅 Week-by-Week Plan

| Days | Task |
|---|---|
| 1–2 | Lock API contract w/ Frontend; incidents CRUD + file upload wired to Mongo |
| 3–5 | ml_service integration with ML teammate's weights; `/detect` end-to-end on a real Zenodo tile |
| 6–8 | Drift runner subprocess + jobs polling; Physics' script behind stable CLI |
| 9–10 | Scoring fusion over clean AIS Parquet + origin PDF; `/suspects` serving real rankings |
| 11–12 | Export bundle (GeoJSON/KML/case JSON); logging + basic error surfaces |
| 13–14 | Load test demo flow, seed demo incidents, backup mock mode, freeze |

## ⚠️ Pitfalls That Kill Teams

1. Rewriting main.py instead of extending — you lose the working CORS/demo-zone baseline.
2. Importing opendrift/torch INTO the API process — one segfault takes down everything; keep subprocesses.
3. Blocking event loop with sync file I/O — use `aiofiles`/threadpool for uploads.
4. No job timeout — a stuck simulation hangs frontend forever; add hard kill after N minutes.
5. Forgetting `.env` isn't committed but teammates need keys documented in `.env.example`.

## 🛡️ Judge Q&A (your domain)

- **Latency?** Detection seconds; drift minutes but async with progress — officer keeps working meanwhile.
- **Scaling?** Stateless API + queue-ready job design; swap dict→Redis/Celery post-hackathon without touching endpoints.
- **Security?** Upload validation, size caps, no shell interpolation into subprocess args, secrets only via env.
