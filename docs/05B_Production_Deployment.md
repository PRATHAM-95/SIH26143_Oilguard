# SIH26143 — Production Deployment (Windows, no Docker, no new installs)

Everything runs on the Windows host using software that is already installed:
Java 21 + Maven, the Python 3.12 venv (`scientific-service/.venv`), and
Node/npm. MongoDB is online (Atlas) and is never run locally.

## Architecture

```
Browser
   │  (direct HTTP + WebSocket, CORS allows :3000/:4173)
   ▼
vite preview  (serves frontend/dist/, :4173)
   │
  http://localhost:8082/api
   ▼
Spring Boot jar (java -jar app-0.1.0.jar, :8082)
   ├─→ MongoDB Atlas (cloud, URI from oil-spill-system/.env)
   └─→ FastAPI scientific service (uvicorn, :8000, warm-started)
             └─→ OpenDrift/OpenOil + SAR + AIS (imported in-process at boot)
```

There is no reverse proxy or orchestrator: the browser calls the backend
directly (CORS is already configured for `localhost:3000` and `localhost:4173`),
and the backend calls the Python service directly. On Windows, **gunicorn is
not used** (it is Unix-only); the scientific service runs under uvicorn.

## Design: slow start, fast runtime

- The scientific service eagerly warms the heavy stack during boot
  (`SCIENTIFIC_PRELOAD=1`): it imports OpenDrift, builds the time-varying
  reader, probes the ADIOS oil-type catalogue, and pre-computes the SAR
  fixture caches. The first drift/backtrack/preview call is therefore fast
  instead of paying a 10–30 s import.
- `GET /api/ready` returns `200` only once the warm-up has finished
  (`503` while loading). `start-production.ps1` waits on this gate before
  starting the backend, so traffic never hits a cold scientific worker.
- If OpenDrift is not installed the warm-up degrades gracefully (logs a
  warning, keeps the lazy path); set `SCIENTIFIC_PRELOAD=0` to disable it.
- The frontend ships as a single bundle (no route-level lazy loading), so
  page navigation never downloads a chunk at runtime.

Expected boot times: sci service ~10–60 s (warm), backend ~10 s, frontend ~1 s.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File oil-spill-system\infrastructure\build-production.ps1
```

Produces:
- `oil-spill-system/backend/target/app-0.1.0.jar`
- `oil-spill-system/frontend/dist/` (hashed assets + `.gz`)
- sci service uses the existing pinned venv

Use `-SkipTests` to skip the Maven test phase during repeated rebuilds.

## Run / stop

```powershell
powershell -ExecutionPolicy Bypass -File oil-spill-system\infrastructure\start-production.ps1
powershell -ExecutionPolicy Bypass -File oil-spill-system\infrastructure\start-production.ps1 -Stop
```

The script starts (1) sci service and waits for `/api/ready`, (2) backend and
waits for `/api/health` with `"mongodb":"UP"`, (3) vite preview on `:4173`.
All output goes to `oil-spill-system/infrastructure/logs/`. PIDs are tracked
in `oil-spill-system/infrastructure/.prod-pids.txt`.

## Run as a background daemon (optional, built-in supervisor)

```powershell
powershell -ExecutionPolicy Bypass -File oil-spill-system\infrastructure\register-prod-tasks.ps1
powershell -ExecutionPolicy Bypass -File oil-spill-system\infrastructure\register-prod-tasks.ps1 -Unregister
```

Registers a `OilSpillProductionStack` Scheduled Task (SYSTEM, at logon,
restart on failure) that runs `start-production.ps1`.

## MongoDB / Atlas production hardening

1. **Rotate the current database password.** The `mongodb+srv://` URI with its
   password was committed to git history for team sharing. Even after removing
   it from the repo the old credential remains in history, so create a **new
   database user** for production:
   - Atlas → Database Access → Add New Database User
   - Username `oilspill_prod`, authentication method *Password*;
   - Privileges → *Custom* → Built-in role `readWrite` on database `oilspill`
     only (least privilege, not `readWriteAnyDatabase`).
2. Put the new URI in `oil-spill-system/.env`:
   `MONGODB_URI=mongodb+srv://oilspill_prod:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
3. **Set an IP Access List** that only allows the server's public IP (or the
   office/XFinity range); remove `0.0.0.0/0` if present.
4. Network security is already TLS via `mongodb+srv`.
5. If this cluster serves real users, upgrade the tier to **M10+** and enable
   **Atlas automated backups + PITR** (the free M0 has no backups).

> `ai.mongodb.com` is MongoDB's Embeddings/Reranking API — an `al-...` key
> there is a **model key**, not a database credential. Storage configuration is
> only `MONGODB_URI`/`MONGODB_DATABASE`.

## Observability (no extra installs)

| Endpoint | Meaning |
|---|---|
| `http://<host>:8000/api/ready` | Sci service warm/ready (`200`) |
| `http://<host>:8000/health` | Sci service liveness |
| `http://<host>:8000/metrics` | Sci Prometheus metrics |
| `http://<host>:8082/api/health` | Backend + Mongo (`"mongodb":"UP"`) |
| `http://<host>:8082/actuator/prometheus` | Backend Prometheus metrics |

Logs: `oil-spill-system/infrastructure/logs/{sci,backend,frontend}*.log`.

Optional, install-free later: portable single-exe `prometheus.exe` + Grafana
zip to turn the `/metrics` endpoints into dashboards.

## Deployment / rollback

- Build new artifacts with `build-production.ps1` (does not delete the
  previous `dist/` until Vite finishes; the backend jar is replaced by Maven).
- Restart the stack with `start-production.ps1 -Stop` then `start-production.ps1`.
- Rollback = rebuild/paste the previous jar + `dist/` (or `git restore` the
  pinned artifact dirs) and restart. Versions are pinned in
  `requirements.txt`, `requirements-science.txt`, `pom.xml`, and the npm lockfile.

## Troubleshooting

- **Sci service never ready** → check `logs/sci.err.log`; if OpenDrift failed
  to import the service still becomes ready (degraded, lazy). First requests
  will then be slow — install the science deps:
  `.\.venv\Scripts\pip install -r scientific-service\requirements-science.txt`.
- **Backend shows `"mongodb":"DOWN"`** → verify `MONGODB_URI` in
  `oil-spill-system/.env` and that the server IP is in the Atlas Access List.
- **Frontend blank/cors errors** → the browser must reach `:8082` directly;
  the CORS whitelist is `localhost:3000` / `localhost:4173` (see
  `backend/.../config/WebCorsConfig.java`).