# Oil Spill Detection & Vessel Attribution System — Developer Setup & Operations

The complete installation, configuration, verification and operations guide for the
`frontend` (React), `backend` (Spring Boot) and `scientific-service` (FastAPI + OpenDrift)
stack. Everything here is written to work on a **fresh clone** — no Docker required.

> If you only want the pitch-level picture, see the repository **[landing page](../README.md)**.

---

## Table of contents

1. [What you will run](#1-what-you-will-run)
2. [Prerequisites](#2-prerequisites)
3. [One-time repository setup](#3-one-time-repository-setup)
4. [Database — MongoDB](#4-database--mongodb)
5. [Install & run the services](#5-install--run-the-services)
   - 5.1 Scientific service (FastAPI)
   - 5.2 Backend (Spring Boot)
   - 5.3 Frontend (React / Vite)
6. [Environment configuration](#6-environment-configuration)
7. [Verify the stack](#7-verify-the-stack)
8. [API surface](#8-api-surface)
9. [Testing & CI checks](#9-testing--ci-checks)
10. [Windows convenience launchers](#10-windows-convenience-launchers)
11. [Troubleshooting](#11-troubleshooting)
12. [Production considerations](#12-production-considerations)

---

## 1. What you will run

| Service | Tech | Default port | Purpose |
|---|---|---|---|
| **frontend** | React 19 · Vite 6 · TypeScript 5.8 · maplibre-gl 4.7 · deck.gl 9.3 · zustand 5 | `3000` | Command Center + investigation workspaces + maps + report |
| **backend** | Spring Boot 3.3.5 · Java 17 · Maven · Spring Data MongoDB · raw-JSON WebSocket | `8082` | API gateway, simulation/investigation orchestration, event broadcast |
| **scientific-service** | FastAPI 0.115 · Python 3.12 · OpenDrift 1.14.11 (OpenOil) | `8000` | All scientific computation: drift, backtrack, SAR, AIS |
| **MongoDB** | Local daemon **or** Atlas M0 (free) | `27017` | Sole persistence layer |

```
Browser
   ▼  http://localhost:3000        (Vite dev server proxies /api and /ws to :8082)
Frontend  ───── REST /api ─────────▶  Backend ───── REST /api ─────▶  Scientific
            WS /ws/simulation/{id}      (FastAPI Python client)          service
            WS /ws/investigation/{id}        │  Spring Data               (OpenDrift)
                                             ▼
                                        MongoDB
```

---

## 2. Prerequisites

Verified combination for local development (Windows 11; the same steps work on
Linux/macOS with equivalent commands):

| Tool | Version verified | Purpose |
|---|---|---|
| **Node.js + npm** | Node 20 | Frontend toolchain |
| **Java** | JDK 17 | Backend runtime |
| **Maven** | 3.9+ | Backend build (`mvn`) |
| **Python** | 3.12 | Scientific service |
| **MongoDB** | 7.x local, or any Atlas M0 cluster | Persistence |

> Java 17 is the pom-configured target. Maven will build and run with a newer
> JDK, but 17 is what is verified. **No Docker, GDAL compilation or native
> toolchain is required** — the OpenDrift stack installs from wheels.

---

## 3. One-time repository setup

```bash
git clone https://github.com/PRATHAM-95/SIH26143_Oilguard.git
cd SIH26143_Oilguard

# Always copy, never edit, the templates -> real .env files:
copy oil-spill-system\.env.example oil-spill-system\.env   # Windows (cmd)
# cp oil-spill-system/.env.example oil-spill-system/.env   # Linux / macOS / PowerShell
```

The backend and scientific service both read environment variables / `.env`.
Real credentials belong only in `.env` — the file is git-ignored, so restart
your shell after editing, and **never commit it**.

---

## 4. Database — MongoDB

### Option A — local MongoDB (simplest)

1. Install MongoDB Community Server (`mongod` on your PATH).
2. Create a data folder and start the daemon:

   ```bash
   mongod --dbpath C:\data\mongodb        # Windows
   # mongod --dbpath ./data/mongodb        # Linux / macOS
   ```

3. Nothing to configure — the backend defaults to `mongodb://localhost:27017`
   with database `oilspill`. Confirm with `mongosh --eval "db.runCommand({ ping: 1 })"`.

### Option B — MongoDB Atlas (hosted)

1. Create a free M0 cluster at <https://www.mongodb.com/atlas>.
2. Create a database user, allowlist your IP, and copy the URI:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`.
3. Set it in `.env`:

   ```dotenv
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DATABASE=oilspill
   ```

Either option is fine; the backend health endpoint reports which one it reached
(`"mongodb": "UP"`).

---

## 5. Install & run the services

Open **three terminals**, all from the `oil-spill-system` directory.

### 5.1 Scientific service (FastAPI) — port 8000

```bash
cd scientific-service

python -m venv .venv
.\.venv\Scripts\activate            # Linux / macOS: source .venv/bin/activate

pip install -r requirements.txt            # lean base API deps (fast)
pip install -r requirements-science.txt    # OpenDrift / xarray / netCDF4 stack

uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Notes:

- Use `127.0.0.1`, not `localhost`, to avoid IPv6-first resolution surprises.
- Add `--reload` for development auto-reload.
- `requirements-science.txt` is the heavy stack (OpenDrift ≈ a few minutes of
  wheels); it is deliberately **separate** so the API layer stays lean and the
  science stack can be upgraded independently.
- Interactive API browser: http://localhost:8000/docs

### 5.2 Backend (Spring Boot) — port 8082

```bash
cd backend

# Development with live reload:
mvn spring-boot:run

# OR bake + run the production jar:
mvn -q clean package -DskipTests
java -jar target/app-0.1.0.jar
```

Notes:

- `application.yml` reads all endpoints from environment variables; default
  `PYTHON_SERVICE_URL=http://localhost:8000` matches the science service above.
- The backend auto-detects local MongoDB unless `MONGODB_URI` points at Atlas.
- The wide-open note in `WebCorsConfig.java` permits only localhost origins —
  see [Production considerations](#12-production-considerations) before exposing it.

### 5.3 Frontend (React / Vite) — port 3000

```bash
cd frontend

npm install
npm run dev
```

Notes:

- The Vite dev server proxies `/api` and `/ws` to the backend (see
  `vite.config.ts`), so the frontend works out of the box against `:8082`.
- On machines where the backend runs elsewhere, set `VITE_API_URL` / `VITE_WS_URL`
  in `frontend/.env.local`.
- Production build: `npm run build` (runs `tsc -b && vite build`).

---

## 6. Environment configuration

Workspace-origin template: `oil-spill-system/.env.example`. Copy to `.env` and fill in
only what you need — **a fully working demo needs no field filled**.

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `SPRING_PORT` | backend | `8082` | Backend HTTP port |
| `PYTHON_SERVICE_URL` | backend | `http://localhost:8000` | Scientific service base URL |
| `MONGODB_URI` | backend | `mongodb://localhost:27017` | Mongo connection string (local or Atlas) |
| `MONGODB_DATABASE` | backend | `oilspill` | Mongo database name |
| `PYTHON_FORWARD_DRIFT_PATH` | backend | `/api/forward-drift` | Drift endpoint path |
| `PYTHON_SAR_DETECT_PATH` / `PYTHON_SAR_PREVIEW_PATH` | backend | `/api/sar/detect` / `/api/sar/preview` | SAR paths |
| `PYTHON_BACKTRACK_PATH` | backend | `/api/backtrack` | Backtracking path |
| `PYTHON_AIS_QUERY_PATH` / `PYTHON_AIS_FILTER_PATH` / `PYTHON_AIS_SCORE_PATH` / `PYTHON_AIS_AVAILABILITY_PATH` | backend | `/api/ais/*` | AIS paths |
| `PYTHON_*_TIMEOUT` | backend | `120–180` | Per-call timeouts (seconds) |
| `VITE_API_URL` | frontend | `http://localhost:8082` | Backend base for direct calls |
| `VITE_WS_URL` | frontend | `ws://localhost:8082` | Backend WebSocket base |
| `FASTAPI_PORT` | science | `8000` | Uvicorn port (informational) |
| `CMEMS_USERNAME`, `CMEMS_PASSWORD`, `CMEMS_DATASET_ID` | science | — | Real ocean currents (Copernicus Marine). Register at <https://data.marine.copernicus.eu> |
| `CDS_API_URL`, `CDS_API_KEY` | science | `https://cds.climate.copernicus.eu/api` | Real ERA5 wind. Register at <https://cds.climate.copernicus.eu> (key format `<uid>:<api-key>`) |
| `GFW_API_KEY` | science | — | Real historical AIS (Global Fishing Watch, free non-commercial) |
| `AISSTREAM_TOKEN` | science | — | Real-time AIS feed |

**Provenance behaviour:** each optional provider reports `AVAILABLE`/`UNAVAILABLE`
through `GET /api/environment/availability` and `GET /api/ais/availability`. Missing
credentials do **not** break the demo — drift/backtrack fall back to deterministic
`CONTROLLED` forcing and SAR to labelled `FIXTURE` scenes, and every result carries
its real provenance string.

---

## 7. Verify the stack

With all three services up:

| Check | Command | Expected |
|---|---|---|
| Frontend serves | `curl http://localhost:3000` | HTML page |
| Backend health + Mongo | `curl http://localhost:8082/api/health` | `{"service":"oil-spill-backend","version":"0.1.0","mongodb":"UP","status":"UP"}` |
| Science health | `curl http://localhost:8000/health` | `{"status":"UP","service":"oil-spill-scientific-service","version":"0.5.0"}` |
| Backend → Python link | `curl http://localhost:8082/api/environment/ping-python` | `{"ok":true,"pythonStatus":"UP","pythonUrl":"http://localhost:8000"}` |
| Environment availability | `curl http://localhost:8000/api/environment/availability` | providers with AVAILABLE/UNAVAILABLE |
| AIS availability | `curl http://localhost:8000/api/ais/availability` | providers with REAL/CONTROLLED states |
| Mongo direct | `mongosh --eval "db.runCommand({ ping: 1 })"` | `ok: 1` |

Then open **http://localhost:3000** — the Command Center starts in a judge-safe
**DEMO drill** that runs the whole pipeline on labelled `CONTROLLED`/`FIXTURE`
data: SAR detection → environment → forward drift → backtracking → AIS →
attribution → conclusion, streamed live over WebSockets.

---

## 8. API surface

### 8.1 Backend (REST, prefix `/api`)

| Controller | Endpoints |
|---|---|
| Health | `GET /health` |
| Environment | `GET /environment/ping-python` |
| Simulation | `GET /simulation/{id}` · `POST /simulation/{id}/start` · `POST /simulation/{id}/advance` · `GET /simulation/{id}/vessels` · `POST /simulation/{id}/vessels/{vesselId}/move` · `POST /simulation/{id}/vessels/{vesselId}/spill` · `POST /simulation/{id}/forward-drift` · `POST /simulation/{id}/sar/detect` · `GET /simulation/{id}/sar/observations` · `POST /simulation/{id}/backtrack` · `GET /simulation/{id}/backtrack/runs` |
| Investigation | `POST /investigation/{incidentId}/start` · `GET /investigation/{id}` · `GET /investigation/{id}/steps` · `GET /investigation?simulationId=&incidentId=&status=` · `POST /investigation/{id}/retry` · `POST /investigation/{id}/cancel` · `POST /investigation/{id}/reveal` · `GET /investigation/{id}/report` |
| Attribution | `POST /attribution/run` · `GET /attribution/runs` · `GET /attribution/runs/{runId}` · `GET /attribution/providers` |
| Incidents | `GET/POST /incidents` (via `IncidentController`) |

### 8.2 Backend (WebSocket, raw JSON — not STOMP)

| Topic | Events |
|---|---|
| `/ws/simulation/{simulationId}` | `clock_update`, `vessel_moved`, `spill_released`, `oil_particles`, `forward_drift.{started,completed,failed}`, `sar_observation.{started,completed,failed}`, `backtracking.{started,completed,failed}`, `origin_estimated`, `ais_search.{started,completed,failed}`, `vessels_filtered`, `attribution.{started,completed}`, `vessel_scores_ready` |
| `/ws/investigation/{investigationId}` | `investigation_started`, `step_complete`, `origin_estimated`, `vessels_ranked`, `investigation_complete`, `investigation_failed`, `investigation_cancelled` |

### 8.3 Scientific service (FastAPI)

Interactive docs at **http://localhost:8000/docs**; root `GET /` lists all endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness + version |
| `GET /api/environment/availability` | Which real-data providers can run |
| `POST /api/forward-drift` · `GET /api/forward-drift/preview` | OpenOil forward drift (slick extent, mass balance, particles) |
| `POST /api/backtrack` | Ensemble backward trajectory + KDE source region + uncertainty |
| `GET /api/sar/preview` · `GET /api/sar/catalog` · `POST /api/sar/detect` | SAR availability, live Sentinel-1 GRD catalog (anonymous STAC), detection |
| `GET /api/ais/availability` · `POST /api/ais/query` · `POST /api/ais/filter` | AIS providers, track query, candidate filtering |
| `POST /api/score-vessels` | Frozen five-factor vessel attribution scoring |
| `POST /api/attribution/validate` | Controlled ground-truth recovery scenarios (never in live path) |

---

## 9. Testing & CI checks

```bash
# Backend — JUnit 5 (Spring Boot test slice)
cd backend
mvn test

# Scientific service — pytest suite (drift, backtrack, SAR, AIS, recovery)
cd scientific-service
.\.venv\Scripts\activate
python -m pytest -q

# Frontend — typecheck + production build
cd frontend
npm run build
```

Backend unit tests cover the attribution/backtrack/drift **services**, the
investigation state machine (executor + service), SAR service, and the
simulation controller/service. Scientific tests cover every module along with
controlled-recovery ground-truth scenarios.

---

## 10. Windows convenience launchers

Two PowerShell helpers at the repo root bring up the entire stack:

| Script | Behaviour |
|---|---|
| `start-stack.ps1` | One terminal, hidden background processes; skips anything already listening |
| `start-stack-visible.ps1` | Stops the four ports, opens one **visible** log window per service |

```powershell
powershell -ExecutionPolicy Bypass -File .\start-stack.ps1
```

> These are dev-machine convenience scripts — they currently hard-code absolute
> paths (VS Code's bundled JRE, `C:\nvm4w\nodejs`, a temp Mongo `--dbpath`).
> On other machines prefer the three-terminal manual flow in §5.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Api health` reports `"mongodb": "DOWN"` | Mongo not running — start `mongod` (§4), or set a valid `MONGODB_URI` |
| Backend returns `ConnectException` to Python | Science service not on `:8000`; verify `PYTHON_SERVICE_URL` and §7 ping |
| Browser console `CORS` errors | Access from an origin outside the allowlist (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:4173`). Open via `localhost`, and don't rely on a `[::1]` origin |
| `curl` `POST` returns 400 `Unexpected character 'r'` | Shell mangled `--data '{"a":1}'` inline JSON. Use a data file: `curl -H "Content-Type: application/json" --data @payload.json ...` |
| `npm run dev` then page shows `No canvas` / empty `#root` | Vite may have bound IPv6-only — browse **http://localhost:3000**, not `http://[::1]:3000`, and hard-reload |
| Scientific service fails to import `opendrift` | Reinstall the science stack: `pip install -r requirements-science.txt` (Windows + Python 3.12 is verified; pin `opendrift==1.14.11`) |
| `mvn` build fails on **missing** deps | Maven needs network on first build; verify `JAVA_HOME` points at a JDK 17+ |
| Frontend `ws` stuck / investigations not updating live | Confirm the proxy: `devServer.proxy` handles `/ws` (config step), then open the browser console for the WS URL |
| Every data source shows `UNAVAILABLE` for REAL providers | Expected — optional credentials (§6) gate real feeds; the demo uses `CONTROLLED`/`FIXTURE` by design |

---

## 12. Production considerations

The repository is a complete, runnable system and is already architected
production-ward; before a real deployment, do the following:

- **Ingress & TLS** — put the backend behind a reverse proxy (Nginx/Caddy) with
  HTTPS and terminate WebSocket upgrades (`/ws`). CORS in `WebCorsConfig.java`
  currently allows only localhost origins — replace with your deployed origin(s).
- **Secrets** — every credential is env-injected (Spring `SPRING_*`/`PYTHON_*`,
  science `.env`). Use a secrets manager in deployment; never deploy `.env` files.
- **Persistence & durability** — MongoDB collections (simulation, investigation,
  incidents, attribution runs) hold the full investigation trail. Enable
  backups/point-in-time recovery and monitor disk.
- **Health & metrics** — Spring Boot Actuator exposes `health,info`
  (`/actuator/health`); FastAPI exposes `/health`. Wire both into an uptime probe.
- **Sizing & concurrency** — investigation executor threads (concurrency 2,
  claim-until 600s, `recoverStaleInvestigations` sweep) are tuned for a single
  node. Scale Mongo, then split the Python science service horizontally.
- **Model pinning** — the science stack is pinned (`opendrift==1.14.11`) and
  reports `model_version` strings in every response for auditability. Bump
  versions deliberately, and re-run the controlled-recovery validation suite
  (`POST /api/attribution/validate`) before any upgrade.
- **Map basemap** — the demo uses the keyless OpenFreeMap *Dark* style. A
  production deployment should serve a licensed vector basemap, and the Phase-3
  roadmap (NASA GIBS, NASA EONET, Open-Meteo) extends it with environmental +
  satellite situational layers.

---

### Further reading

- Repository landing page — [`../README.md`](../README.md)
- Technical specification (frozen contracts) — `research/21-technical-spec/SYSTEM_SPEC.md`
- Local dev notes (Mongo Atlas + OpenDrift status) — `infrastructure/LOCAL_DEVELOPMENT.md`
- Step reports — `research/22-sar-detection` … `research/25-investigation`
- Early verification — `docs/VERIFICATION_REPORT_2026-08-24.md`