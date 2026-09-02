# =============================================
# SIH26143 — Local Development (no Docker)
#
# Environment setup per service + wiring between them.
# =============================================

## Diagram

```
Browser
   ↓  Vite dev proxy (/api, /ws)
Frontend (React, port 3000)
   ↓  http://localhost:8082/api
Spring Boot (port 8082)
   ├──→ MongoDB (Atlas or local, via MONGODB_URI)
   └──→ FastAPI (port 8000)
             └──→ OpenDrift/OpenOil (imported in-process)
```

## Ports

| Service         | Port |
|-----------------|------|
| Frontend (Vite) | 3000 |
| Spring Boot     | 8082 (8080 is used by an unrelated local app) |
| FastAPI         | 8000 |
| MongoDB         | 27017 |

## MongoDB Atlas setup (recommended for hosted DB)

1. Create a free M0 cluster at https://www.mongodb.com/atlas
2. Create a database user (e.g. `oilspill`) and note the password
3. Allow network access (IP allowlist) for your machine
4. Copy the connection string:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
5. Set it in your `.env`:
   `MONGODB_URI=mongodb+srv://...`
   `MONGODB_DATABASE=oilspill`

### Fallback: local MongoDB (already detected on this machine)

A MongoDB Server service is running locally at `mongodb://localhost:27017`.
To use it instead of Atlas, set:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=oilspill
```

Spring Boot will connect to whichever URI is configured. Verify with
`GET http://localhost:8082/api/health` → `"mongodb": "UP"`.

## OpenDrift / OpenOil scientific stack — status

- Opendrift 1.14.12 installs cleanly on Windows 11 + Python 3.12 (no Docker, no GDAL compilation issues).
- Verified imports:
  - `from opendrift.models.openoil import OpenOil`
  - `from opendrift.readers import reader_netCDF_CF_generic`
  - `adios_db` (NOAA oil library) — installed as an OpenDrift dependency.
- Installed via:
  ```
  .\.venv\Scripts\pip install -r requirements-science.txt
  ```
- The `requirements.txt` intentionally does NOT include the science stack, keeping the FastAPI service lean and reliable while OpenDrift evolves.
- Forward drift / backtracking are NOT implemented yet (Step 03+).