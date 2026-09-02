# SIH26143 — Oil Spill Detection & Vessel Attribution System

An intelligent maritime oil-spill investigation and source-estimation system that combines satellite observation, oceanographic and meteorological data, backward trajectory modelling, AIS traffic reconstruction, and uncertainty-aware vessel attribution.

Built for **SIH (Smart India Hackathon) Problem Statement 26143** — *"Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill."*

> **Status: Step 02 — local infrastructure setup only.** Docker is not used. The scientific pipeline is NOT yet implemented.

---

## Project Overview

The system detects oil spills from satellite imagery (Sentinel-1 SAR), traces the slick backward to its probable origin using ocean drift modelling (OpenDrift/OpenOil), and attributes the spill to the responsible vessel using AIS trajectory correlation.

Two modes:
- **Investigation Mode** — detect → characterize → backtrack → attribute (the core NTRO requirement)
- **Captain Mode** — a judge-controlled digital twin for live demonstration and hidden ground-truth validation

---

## Architecture

```
React + TypeScript (frontend, port 3000)
        ↓  http://localhost:8082/api  (+ WebSocket /ws)
Spring Boot (backend, port 8082)
        ├──→ MongoDB (Atlas or local, port 27017)
        └──→ FastAPI (scientific-service, port 8000)
                  └──→ OpenDrift / OpenOil (in-process import)
```

**Key architectural rules:**
- Spring Boot is the main application/orchestration backend
- Python/FastAPI owns all scientific computation
- MongoDB is the sole persistence layer
- Frontend never talks to MongoDB or Python directly
- No scientific computation lives inside Spring Boot

---

## Prerequisites

| Tool | Version (verified) |
|------|--------------------|
| Node.js + npm | Node 20 |
| Java | JDK 17 |
| Maven | 3.9+ |
| Python | 3.12 |
| MongoDB | Atlas account OR local server (a local instance is detected on this machine) |

---

## Startup

Three terminals, started from the project root.

### Terminal 1 — Frontend

```bash
cd frontend
npm install
npm run dev
```

### Terminal 2 — Spring Boot backend

```bash
cd backend
mvn spring-boot:run
```

### Terminal 3 — FastAPI scientific service

```bash
cd scientific-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
# optional scientific stack:
pip install -r requirements-science.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Spring Boot health | http://localhost:8082/api/health |
| FastAPI health | http://localhost:8000/health |
| Spring Boot → FastAPI probe | http://localhost:8082/api/environment/ping-python |

---

## Health Checks

```bash
# Frontend
curl http://localhost:3000            # serves the Vite app

# Spring Boot — reports Mongo connectivity too
curl http://localhost:8082/api/health
# → {"service":"oil-spill-backend","version":"0.1.0","mongodb":"UP","status":"UP"}

# FastAPI
curl http://localhost:8000/health
# → {"status":"UP","service":"oil-spill-scientific-service","version":"0.1.0"}

# Spring Boot → FastAPI (real HTTP request)
curl http://localhost:8082/api/environment/ping-python
# → {"ok":true,"pythonStatus":"UP","pythonUrl":"http://localhost:8000"}

# MongoDB direct
mongosh --eval "db.runCommand({ ping: 1 })"  # local instance
```

---

## MongoDB Atlas

Connection is configured via environment variables — never hard-coded:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=oilspill
```

Setup steps (free M0 cluster) are documented in
`infrastructure/LOCAL_DEVELOPMENT.md`. If Atlas is not configured, the
application defaults to a local `mongodb://localhost:27017`.

---

## Scientific environment — OpenDrift/OpenOil status

**Verified (2 Sep 2026):** `opendrift==1.14.12` installs and imports natively on
Windows 11 + Python 3.12 — no Docker needed. Confirmed imports:

- `from opendrift.models.openoil import OpenOil`
- `from opendrift.readers import reader_netCDF_CF_generic`
- `adios_db` (NOAA oil library)

The science stack lives in `scientific-service/requirements-science.txt`,
kept separate from the lean `requirements.txt`. Forward drift and
backtracking are NOT implemented yet.

---

## Configuration

Copy and fill the example environment file:

```bash
cp .env.example .env
```

Then edit `.env`. Never commit `.env` or real credentials.

---

## Current Implementation Status

**Step 02 complete — local infrastructure only.**

| Component | Status |
|-----------|--------|
| Frontend skeleton (React + Vite + routes, port 3000) | ✅ Done |
| Spring Boot backend (health + package skeleton, port 8082) | ✅ Done |
| FastAPI scientific service (health + module skeleton, port 8000) | ✅ Done |
| MongoDB connection (local detected + Atlas ready via env) | ✅ Verified |
| Service communication (Backend → FastAPI) | ✅ Verified |
| OpenDrift/OpenOil install + import | ✅ Verified |
| SAR detection pipeline | ⏳ Not started |
| Forward drift / backtracking | ⏳ Not started |
| AIS / vessel attribution | ⏳ Not started |
| Investigation agent | ⏳ Not started |

---

## Directory Structure

```
oil-spill-system/
├── frontend/              React + TypeScript + Vite (port 3000)
├── backend/               Spring Boot / Maven (port 8082)
├── scientific-service/    Python FastAPI (port 8000)
│   ├── requirements.txt          lean base deps
│   └── requirements-science.txt  OpenDrift/OpenOil stack
├── infrastructure/        Dev-env documentation (no Docker)
├── research/              Research + SYSTEM_SPEC.md
├── .gitignore
├── .env.example
└── README.md
```

---

## Documentation

The authoritative technical specification lives at:

```text
research/21-technical-spec/SYSTEM_SPEC.md
```

Read it before implementing any component.