<div align="center">

# SIH26143 — Oilguard

### Oil Spill Detection & Vessel Attribution System for Maritime Domain Awareness

An end-to-end **radar-to-culprit** investigation platform that fuses **satellite Synthetic Aperture Radar (SAR)**, **numerical ocean drift modelling**, and **AIS traffic reconstruction** to detect an oil slick at sea and identify the vessel responsible — with every data source labelled by provenance.

Built for **Smart India Hackathon 2026, Problem Statement 26143**:
*"Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify the vessel responsible for the spill."*

</div>

---

## 1. What this system is — the industry problem

Illegal and accidental oil discharges from ships are a chronic — and largely *anonymous* — source of marine pollution. Of the tens of thousands of slick observations flagged globally each year by SAR satellites, only a fraction are ever traced back to a discharge vessel. Regulators and maritime agencies face three hard questions:

| Question | Why it is hard in practice |
|----------|----------------------------|
| **Where did the spill begin?** | A slick sighted on day *N* has already drifted; it is not at its origin. Reversing wind + current advection is an inverse problem with genuine uncertainty. |
| **When was it released?** | Weathering, evaporation and dispersion age the slick; release time must be inferred together with origin. |
| **Who discharged it?** | AIS coverage has gaps, spoofing is common, and hundreds of vessels transit the area. Correlation of *reconstructed* traffic to a *probabilistic* source region has to be scored honestly. |

This project is a production-minded answer to those three questions: a **detect → characterize → backtrack → attribute** pipeline in which every stage is a real scientific computation, every result is reproducible, and every claim carries its own data-provenance label so the system never presents simulation as observation.

> **Provenance principle (non-negotiable):** every observation, model run and attribution claim carries one of `REAL | CONTROLLED | FIXTURE | UNAVAILABLE`. If a real data feed is not configured, the system says so — it degrades to labelled simulated data, it *never fabricates* a satellite feed.

---

## 2. Capabilities

- **SAR spill detection & characterisation** — Sentinel-1 GRD scene discovery (Copernicus Data Space, anonymous STAC), classical radar detectors, slick geometry + weathering age estimate, per-candidate confidence.
- **Forward oil-drift modelling** — OpenOil (OpenDrift) particle advection: slick extent polygon, NOAA oil mass balance, fixed-seed reproducibility.
- **Ensemble backward trajectory & source estimation** — native OpenDrift backward mode, multi-member ensemble, KDE source-region contour + uncertainty, origin/time-window estimate.
- **AIS traffic reconstruction & attribution** — track filtering/reconstruction, cadence & anomaly signal analysis, frozen five-factor vessel scoring, conclusion thresholds.
- **Investigation orchestration** — an eight-stage, resumeable, MongoDB-backed *saga* over the science pipeline, emitting live WebSocket events to a real-time Command Center.
- **Judge-safe demo mode** — a one-click drill that runs the entire pipeline on labelled `CONTROLLED`/`FIXTURE` data for live demonstration and ground-truth validation, without ever mislabelling itself as real.

---

## 3. System architecture

```
                              ┌──────────────────────────┐
        Operator browser ────▶│  Frontend (React 19)      │  :3000
                              │  Command Center · maps ·  │  maplibre-gl + deck.gl
                              │  stepper rail · reports   │  OpenFreeMap dark basemap
                              └──────────────────────────┘
                                       │  REST /api  +  WS /ws/simulation/{id}
                                       │  REST /api  +  WS /ws/investigation/{id}
                              ┌──────────────────────────┐
                              │  Backend (Spring Boot 3) │  :8082
                              │  orchestration · state   │  saga-lite investigation
                              │  WebSockets · CORS       │  MongoDB (Spring Data)
                              └──────┬────────┬──────────┘
                                     │        │
                              MongoDB │        │  HTTP /api/*  (Python client)
                              :27017  │        ▼
                              ┌───────┴──────────────────────────┐
                              │  Scientific service (FastAPI)     │  :8000
                              │  drift · backtrack · SAR · AIS    │
                              │  environment providers            │
                              └───────┬──────────────────────────┘
                                      │  in-process, no Docker required
                              OpenDrift/OpenOil  +  numpy/xarray/netCDF4
```

| Component | Stack | Role |
|---|---|---|
| `frontend/` | React 19, Vite 6, TypeScript 5.8, react-map-gl 8, **maplibre-gl 4.7**, deck.gl 9.3, zustand 5, Recharts | Interactive map lens + investigation workspaces + 12-section report |
| `backend/` | Spring Boot 3.3, **Java 17**, Maven, Spring Data MongoDB, WebSocket | API gateway, simulation & investigation state machines, event broadcast |
| `scientific-service/` | FastAPI 0.115, **Python 3.12**, OpenDrift 1.14.11/OpenOil, numpy/xarray/netCDF4 | All scientific computation — forward drift, backtracking, SAR, AIS scoring |
| `MongoDB` | Local daemon or Atlas (M0 free tier) | Sole persistence layer |

**Architectural rules:** the frontend never talks to MongoDB or Python directly; no scientific computation lives inside Spring Boot; every external credential is environment-injected, never hard-coded.

---

## 4. Provenance + real-data configuration

The demo runs **out of the box with zero API keys** using deterministic `CONTROLLED` forcing and `FIXTURE` SAR scenes — every one clearly labelled. Optional credentials upgrade runs to genuine `REAL` data:

| Provider | Env var(s) | Unlocks |
|---|---|---|
| CMEMS (Copernicus Marine) currents | `CMEMS_USERNAME`, `CMEMS_PASSWORD` | Real ocean current forcing for drift/backtrack |
| ERA5 wind (CDS API) | `CDS_API_KEY` | Real wind forcing |
| Copernicus Data Space | *(anonymous)* | Live Sentinel-1 GRD scene catalog (already streaming, no key) |
| Global Fishing Watch AIS | `GFW_API_KEY` | Real historical AIS traffic |
| AISStream | `AISSTREAM_TOKEN` | Real-time positional feed |

See [`oil-spill-system/README.md`](oil-spill-system/README.md#6-environment-configuration) for the full variable table.

---

## 5. Quick start (local)

Prerequisites: **Java 17 · Maven 3.9 · Node 20 · Python 3.12 · MongoDB** — full instructions in the [developer setup guide](oil-spill-system/README.md).

```bash
# 1. Scientific service  (Terminal A, Python 3.12)
cd oil-spill-system/scientific-service
python -m venv .venv
.\.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-science.txt      # OpenDrift stack (heavy, ~a few min)
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Backend             (Terminal B)
cd ../backend
mvn spring-boot:run                          # or: mvn -q clean package -DskipTests && java -jar target/app-0.1.0.jar

# 3. Frontend            (Terminal C)
cd ../frontend
npm install
npm run dev
```

Then open **http://localhost:3000**.

> Windows users can also run `start-stack.ps1` (single hidden-terminal stack) or `start-stack-visible.ps1` (one log window per service) from the repo root — note both currently hard-code paths from this development machine.

| Service | URL |
|---|---|
| Frontend (Command Center) | http://localhost:3000 |
| Backend health | http://localhost:8082/api/health |
| FastAPI (incl. `/docs` Swagger) | http://localhost:8000 |
| MongoDB | `mongodb://localhost:27017` (default) |

---

## 6. Repository layout

```
SIH26143_OIL_DUMP/
├── README.md                                    ← this file (landing page)
├── docs/                                        pitch script, PPT spec, role briefs,
│                                                verification report, mock HTML
├── oil-spill-system/
│   ├── README.md                                ← ★ full developer setup + ops guide
│   ├── frontend/          React 19 + Vite (port 3000)
│   ├── backend/           Spring Boot 3 (port 8082)
│   ├── scientific-service/ FastAPI (port 8000) + OpenDrift science stack
│   ├── infrastructure/    dev-env notes, e2e scripts
│   ├── research/          research track 01–21 + technical specification
│   ├── .env.example       environment template (never commit real .env)
│   └── .gitignore
├── research/             official PS + research tracks 01–25 (STEP 07–11 reports)
└── start-stack.ps1 / start-stack-visible.ps1    Windows one-shot stack launchers
```

Key documents:

| Document | What it is |
|---|---|
| [`oil-spill-system/README.md`](oil-spill-system/README.md) | **Start here** — install, configure, run, test, deploy |
| `oil-spill-system/research/21-technical-spec/SYSTEM_SPEC.md` | Frozen technical specification (API contracts, provenance, thresholds) |
| `research/25-investigation/STEP_11_REPORT.md` | Investigation orchestration + live E2E results |
| `research/24-backtracking/STEP_09_REPORT.md`, `research/25-ais-attribution/STEP_10_REPORT.md` | Backtracking + attribution validation results |
| `docs/VERIFICATION_REPORT_2026-08-24.md` | Early-stage system verification report |

---

## 7. Development status

| Area | Status |
|---|---|
| Investigation Command Center (CASE/DEMO modes, resumeable 8-stage saga) | **Implemented** |
| SAR detection + characterization (Sentinel-1 GRD catalog, classical detectors) | **Implemented** |
| Forward drift (OpenOil) + ensemble backtracking + source estimation | **Implemented** |
| AIS reconstruction + five-factor vessel attribution + validation scenarios | **Implemented** |
| Real-data unlocks (CMEMS, ERA5, CDSE, GFW) | **Ready** — key-gated |
| Phase-3 roadmap: NASA GIBS raster overlays, NASA EONET situational feed, Open-Meteo weather | **Planned** |

---

<div align="center">

Built as an open, verifiable science system for the Smart India Hackathon 2026.
Questions → open an issue; set-up problems → see the [troubleshooting guide](oil-spill-system/README.md#9-troubleshooting).

</div>