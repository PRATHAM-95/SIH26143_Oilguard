# SYSTEM_SPEC.md — SIH26143 Authoritative Technical Specification

> **Version:** 1.0  
> **Status:** FROZEN — Ready for Implementation  
> **Date:** 2 September 2026  
> **PS Number:** SIH26143  
> **Title:** Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill  
> **Organization:** National Technical Research Organisation (NTRO)

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [Two Primary Modes](#2-two-primary-modes)
3. [Complete User Journey](#3-complete-user-journey)
4. [Technical Architecture](#4-technical-architecture)
5. [Scientific Pipeline](#5-scientific-pipeline)
6. [Slick Characterization](#6-slick-characterization)
7. [Environmental Data](#7-environmental-data)
8. [Forward Oil Drift](#8-forward-oil-drift)
9. [Backward Source Estimation](#9-backward-source-estimation)
10. [AIS Pipeline](#10-ais-pipeline)
11. [Vessel Attribution](#11-vessel-attribution)
12. [Deterministic AI Agent](#12-deterministic-ai-agent)
13. [Data Model](#13-data-model)
14. [Ground-Truth Isolation](#14-ground-truth-isolation)
15. [API Contracts](#15-api-contracts)
16. [Error Handling](#16-error-handling)
17. [Provenance](#17-provenance)
18. [Validation](#18-validation)
19. [Performance Targets](#19-performance-targets)
20. [What We Will NOT Build](#20-what-we-will-not-build)
21. [Implementation Order](#21-implementation-order)
22. [Dependencies & Risks](#22-dependencies--risks)
23. [Licensing & Legal](#23-licensing--legal)
24. [Key References](#24-key-references)
25. [Implementation Readiness](#25-implementation-readiness)

---

## 1. Product Definition

### 1.1 What This System Is

An intelligent maritime oil-spill investigation and source-estimation system that combines satellite observation, oceanographic and meteorological data, backward trajectory modelling, AIS traffic reconstruction, and uncertainty-aware vessel attribution.

### 1.2 What This System Is NOT

- NOT an exact oil-spill source finder — it produces probabilistic estimates with quantified uncertainty
- NOT a system that "reverses physics" — it uses backward trajectory modelling (reversing advective displacement sign)
- NOT a perfect vessel-identification system — it ranks candidates by composite score
- NOT continuous satellite monitoring — Sentinel-1 revisit is 6-12 days; this is snapshot analysis
- NOT an oil-volume estimator — SAR detects presence, not precise volume
- NOT a production-ready operational system — this is a hackathon proof-of-concept

### 1.3 Official Problem Statement Requirements

| # | Requirement | PS Section | Our Approach |
|---|-------------|-----------|--------------|
| 1 | Detect oil spills from SAR/EO imagery | (a) | Pre-trained SegFormer/U-Net on Sentinel-1 SAR |
| 2 | Characterize oil spill (geometric properties, age) | (a) | Direct geometric measurement + model-derived age |
| 3 | Trace slick toward origin using oceanographic data | (b) | OpenDrift backward trajectory (negative timestep) |
| 4 | Predict future flow of the slick | (b) | OpenDrift forward simulation |
| 5 | Attribute spill to vessel using AIS data | (c) | AIS reconstruction + spatio-temporal correlation |
| 6 | Filter irrelevant traffic | (c) | Spatial/temporal/trajectory filtering |
| 7 | Score suspect vessels (proximity, trajectory, anomalies) | (c) | Weighted multi-factor scoring |
| 8 | Visual interface | — | Command-center dashboard with MapLibre + deck.gl |
| 9 | Automated ML model | (a) | ONNX Runtime inference, no GPU needed |
| 10 | Hindcasting capability | (b) | OpenDrift backward mode |

### 1.4 Our Enhancements (Beyond Official Requirements)

| Enhancement | Value |
|-------------|-------|
| Captain/simulation mode | Judge-controlled digital twin for live demonstration |
| Hidden ground truth validation | Automated error metrics after investigation |
| Uncertainty quantification | Ensemble-based confidence intervals |
| Deterministic investigation agent | Explainable, reproducible pipeline |
| Real-time particle visualization | GPU-accelerated 50k+ oil particles |

---

## 2. Two Primary Modes

### 2.1 Mode A — Investigation Mode

The core pipeline as required by the problem statement:

```
Satellite Observation
        ↓
Oil Slick Detection          (ML inference on SAR)
        ↓
Slick Characterization       (geometry, area, centroid, orientation)
        ↓
Environmental Data           (currents from CMEMS, wind from ERA5)
        ↓
Backward Trajectory          (OpenDrift negative timestep, ensemble)
        ↓
Probable Origin + Time       (point estimate + uncertainty)
        ↓
AIS Reconstruction           (query vessels in origin window)
        ↓
Vessel Filtering             (spatial, temporal, trajectory filters)
        ↓
Vessel Scoring               (multi-factor weighted scoring)
        ↓
Uncertainty Analysis         (ensemble spread, confidence intervals)
        ↓
Investigation Report         (evidence chain, ranked suspects, metrics)
```

**Stage details:**

| Stage | Input | Processing | Output | Service | API |
|-------|-------|-----------|--------|---------|-----|
| Detection | SAR image patch | ONNX model inference | Binary mask + class labels | Python | `POST /detect` |
| Characterization | Detection mask | Shapely geometry ops | Area, centroid, perimeter, bbox, orientation, shape | Python | `POST /characterize` |
| Env Data | Bbox + time | CMEMS/ERA5 API calls | u/v current field, u/v wind field | Python | `POST /environment` |
| Backtracking | Slick geometry + env | OpenDrift backward mode, 50 ensembles | Origin point + uncertainty surface | Python | `POST /backtrack` |
| Source Estimation | Ensemble results | Statistical aggregation | Origin lat/lon, time, uncertainty_km, time_uncertainty, confidence | Python | `POST /estimate-source` |
| AIS Query | Origin + time window | MongoDB spatial query | Vessel tracks in region/time | Spring Boot | `GET /ais/vessels` |
| Filtering | Vessel tracks + origin | Spatial/temporal/trajectory filters | Candidate vessels | Spring Boot | `GET /ais/candidates` |
| Scoring | Candidates + origin + drift | Weighted multi-factor algorithm | Ranked vessels with scores | Spring Boot | `POST /ais/score` |
| Report | All results | Aggregation | Complete investigation document | Spring Boot | `GET /investigation/{id}` |

### 2.2 Mode B — Captain / Simulation Mode

A controlled digital-twin workflow for live demonstration:

```
Select Region
     ↓
Select/Observe Vessels       (choose from pre-populated fleet)
     ↓
Modify Vessel State          (adjust position, speed, heading)
     ↓
Move Vessel                  (advance to new position)
     ↓
Trigger Oil Spill            (illegal discharge or accidental)
     ↓
Advance Simulation Time      (+1h, +6h, +12h increments)
     ↓
Forward Oil Drift            (OpenDrift forward simulation)
     ↓
Generate Observation         (simulate what satellite would see)
     ↓
Run Investigation            (switch to Investigation Mode pipeline)
     ↓
Reveal Ground Truth          (only after investigation completes)
     ↓
Calculate Error              (position error, time error, attribution accuracy)
```

**Captain Mode is a controlled demonstration and validation environment, not a replacement for real satellite investigation.**

The pipeline for Captain Mode is:

| Stage | Input | Processing | Output | Service |
|-------|-------|-----------|--------|---------|
| Region selection | User clicks map | Bbox extraction | Region polygon | Frontend |
| Vessel selection | User picks vessel | Load vessel state | Vessel position/heading | Spring Boot |
| Vessel movement | User adjusts controls | Update vessel state | New position | Spring Boot |
| Spill trigger | User presses button | Create spill event | Spill record + forward simulation | Spring Boot + Python |
| Time advance | User clicks +Nh | Run OpenDrift forward | Updated particle positions | Python |
| Observation generation | Forward particles | Apply SAR detection model | Synthetic observation | Python |
| Investigation | Synthetic observation | Full investigation pipeline | Investigation results | Spring Boot + Python |
| Ground truth reveal | Investigation complete | Compare prediction vs actual | Error metrics | Spring Boot |

---

## 3. Complete User Journey

### 3.1 Screen 1 — Command Center (Default View)

**What the user sees:**
- Full-screen dark maritime map (MapLibre GL JS)
- Header bar: Logo | Simulation clock (ticking) | Mode toggle (Captain/Investigation)
- Left sidebar: Phase selector, tool buttons, status indicators
- Right panel: Info cards, environmental conditions summary, alerts
- Bottom bar: Timeline scrubber, playback controls, legend

**Actions available:**
- Toggle between Captain Mode and Investigation Mode
- Select region on map
- View vessels as animated icons (heading-rotated)
- See current/wind particle animation overlay
- View oil slick extent (when detected)
- Access all dashboard screens via sidebar

### 3.2 Screen 2 — Simulation (Captain Mode)

**What the user sees:**
- Map with vessel fleet (color-coded by type)
- Left panel: Vessel selector dropdown, vessel info card
- Right panel: Movement controls (lat/lon sliders, speed/heading inputs)
- Bottom: Spill trigger button, time advance controls

**Actions available:**
- Select vessel from dropdown
- Adjust vessel position via sliders or map click
- Set speed and heading
- Click "Trigger Spill" — creates spill event
- Advance time (+1h, +6h, +12h)
- Watch oil particles drift forward in real-time

### 3.3 Screen 3 — Investigation

**What the user sees:**
- Map showing detected slick
- Left panel: Investigation log (animated step-by-step)
- Right panel: Evidence cards (current data, wind data, detection details)
- Bottom: Progress bar, "Start Investigation" button

**Actions available:**
- Click "Start Investigation" — triggers full pipeline
- Watch each step complete with status indicators
- Expand any step for detail (data sources, parameters, timestamps)
- See origin estimation appear on map

### 3.4 Screen 4 — Backtracking

**What the user sees:**
- Map with reverse trajectory animation (particles flowing backward)
- Uncertainty region (semi-transparent polygon around origin)
- Left panel: Backtracking parameters, ensemble results
- Right panel: Origin probability heatmap
- Bottom: Backtracking timeline (6h → 5h → ... → origin)

**Actions available:**
- Watch reverse trajectory animate
- Toggle uncertainty region visibility
- View probability density heatmap
- Inspect individual ensemble runs

### 3.5 Screen 5 — Attribution

**What the user sees:**
- Map showing vessel positions near estimated origin
- Left panel: Ranked vessel table (sortable)
- Right panel: Evidence cards per vessel (score breakdown)
- Bottom: Score comparison chart (Recharts)

**Actions available:**
- Sort vessels by total score or individual factors
- Click vessel to see detailed evidence
- View score breakdown (spatial, temporal, trajectory, anomaly, environmental)

### 3.6 Screen 6 — Ground Truth

**What the user sees:**
- Map with side-by-side: Estimated origin vs Actual origin
- Error metrics card (position error, time error, attribution accuracy)
- Comparison visualization

**Actions available:**
- Click "Reveal Truth" (only after investigation completes)
- See ground truth overlaid on investigation results
- View error metrics

### 3.7 Screen 7 — Final Report

**What the user sees:**
- Summary dashboard with all investigation results
- Sections: Detected slick | Estimated origin | Environmental conditions | Candidate vessels | Top suspect | Evidence | Confidence | Uncertainty | Ground truth (if applicable)
- Download report button (PDF/JSON)

---

## 4. Technical Architecture

### 4.1 Architecture Diagram

```
+--------------------------------------------------+
|              Frontend (React + TypeScript)         |
|   MapLibre GL + deck.gl + WebGL Particles         |
|   Investigation Dashboard + Captain Controller    |
+---------------------+----------------------------+
                      | REST + WebSocket/SSE
+---------------------+----------------------------+
|             Spring Boot Backend (Java)             |
|   API Gateway + Simulation Engine                  |
|   AIS Processing + Vessel Scoring + Events        |
+--------+---------------------+-------------------+
         |                     |
+--------+--------+   +-------+-----------+
| Python Service   |   |    MongoDB        |
| (FastAPI)        |   |  (GeoJSON docs)   |
|                  |   +-------------------+
| OpenDrift/OpenOil |
| SAR Detection     |
| Backtracking      |
| Environmental     |
+-------------------+
```

### 4.2 Technology Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Frontend Framework | React + TypeScript | 18+ | Modern, type-safe |
| Build Tool | Vite | 5+ | Fast dev experience |
| Map | MapLibre GL JS | 4+ | Open source, WebGL, BSD-3 |
| Map React Bindings | react-map-gl/maplibre | 7+ | Official React wrapper |
| Overlay Layers | deck.gl | 9+ | High-performance vessel/trajectory layers |
| Wind/Current Viz | maplibre-gl-wind or custom WebGL | — | GPU particle animation |
| Charts | Recharts | 2+ | Lightweight, React-native |
| State Management | Zustand | 4+ | Simple, no boilerplate |
| Styling | Tailwind CSS + shadcn/ui | 3+ | Rapid UI development |
| Animation | Framer Motion | 11+ | Smooth transitions |
| Backend | Spring Boot 3 + Java 21 | 3.2+ | REST/WebSocket, team expertise |
| Scientific Service | Python 3.11+ (FastAPI) | 0.110+ | OpenDrift, ML, data processing |
| Database | MongoDB 7 | 7+ | GeoJSON support, flexible schema |
| ML Runtime | ONNX Runtime | 1.17+ | Fast inference, no GPU needed |
| Oil Model | OpenDrift + OpenOil | 1.12+ | GPL-2.0, validated, backward mode |
| Container | Docker + Docker Compose | 24+ | Consistent dev/demo environments |

### 4.3 Service Responsibilities

**Spring Boot (Java)**
- API gateway and routing
- Simulation state management (captain mode)
- Vessel CRUD and movement
- Spill event management
- AIS data processing (filtering, anomaly detection)
- Vessel scoring algorithm
- WebSocket event broadcasting
- MongoDB persistence
- Investigation orchestration (calling Python service)
- Ground-truth isolation enforcement

**Python/FastAPI**
- SAR image processing and ML inference
- OpenDrift/OpenOil forward drift simulation
- OpenDrift/OpenOil backward trajectory modelling
- Environmental data ingestion (CMEMS, ERA5)
- Uncertainty/ensemble calculations
- Slick characterization (geometry extraction)
- Scientific scoring computations

**MongoDB**
- Simulation state persistence
- Vessel positions and track history
- Spill events (with ground-truth isolation)
- Incident records (slick observations)
- Investigation state and results
- Environmental data cache

### 4.4 Inter-Service Communication

```
Frontend ──REST+WS──→ Spring Boot ──HTTP REST──→ Python/FastAPI
                        │                            │
                        │                            ├──→ OpenDrift (import)
                        │                            ├──→ CMEMS API
                        │                            └──→ ERA5/CDS API
                        │
                        └──→ MongoDB (Spring Data)
```

---

## 5. Scientific Pipeline

### 5.1 SAR Detection Pipeline

```
Sentinel-1 GRD (or pre-loaded image)
  ↓
Radiometric Calibration
  ↓
Thermal/Border Noise Removal
  ↓
Conversion to dB (10 * log10)
  ↓
Land Masking (GSHHG or Natural Earth)
  ↓
Dark Feature Extraction (adaptive threshold)
  ↓
ML Classification (SegFormer-B2 or U-Net)
  ↓
5-class mask: Sea Surface | Oil Spill | Look-alike | Ship | Land
  ↓
Oil slick extraction (class == 1)
  ↓
Binary oil mask
```

**Look-alike limitations:**
- Low wind (<2 m/s): No Bragg waves → uniform dark patch → false positive
- Biogenic slicks: Natural surfactants → similar SAR signature
- Rain cells: Heavy rain dampens waves → dark patches
- Wind >10-14 m/s: Oil film breaks up → detection fails

**Mitigation:** Cross-reference with wind field (ERA5) — exclude dark features in low-wind zones.

### 5.2 Model Selection

| Model | Source | Classes | Oil IoU | F1 | Access |
|-------|--------|---------|---------|-----|--------|
| **SegFormer-B2** (primary) | ROBORDER/DARTIS | 5 | ~0.55 | ~0.80 | GitHub |
| U-Net | ROBORDER/DARTIS | 5 | ~0.50 | ~0.75 | GitHub |
| DeepLabV3+ | Krestenitis | 5 | ~0.48 | ~0.72 | GitHub |
| mados | gkakogeorgiou | 15 | varies | varies | GitHub (MIT) |

**Recommended:** SegFormer-B2 as primary, mados as cross-validation.

### 5.3 Important Caveats

1. SAR detects dark patches on the sea surface — not all dark patches are oil
2. Oil volume cannot be reliably estimated from SAR alone
3. Thin sheens (<0.1 mm) may not appear in SAR imagery
4. The ML model must be validated on Indian Ocean conditions (different from training data)
5. Pre-trained model performance numbers are from literature — actual performance on demo data must be experimentally verified

---

## 6. Slick Characterization

### 6.1 Direct Geometric Measurements (from detection mask)

| Measurement | Method | Precision |
|-------------|--------|-----------|
| Area | Polygon area from mask contour | ±10% (depends on resolution) |
| Perimeter | Polygon perimeter | ±10% |
| Centroid | Centroid of polygon geometry | ±1 pixel (~10m) |
| Bounding Box | Min/max lat/lon of polygon | Exact |
| Orientation | Principal axis angle (PCA) | ±5° |
| Shape Factor | Area / (perimeter²) — compactness | Unitless |

### 6.2 Model-Derived Estimates

| Measurement | Method | Confidence |
|-------------|--------|-----------|
| Approximate Age | Backtracking time to most probable origin | Low-Medium |
| Oil Type | ML classification (if model supports) | Low |
| Thickness | NOT reliably estimable from SAR | N/A |

### 6.3 Output Structure

```json
{
  "area_km2": 2.3,
  "perimeter_km": 7.8,
  "centroid": { "lat": 10.42, "lon": 72.31 },
  "boundingBox": { "north": 10.44, "south": 10.40, "east": 72.33, "west": 72.29 },
  "orientation_deg": 45.0,
  "shapeFactor": 0.047,
  "confidence": 0.82,
  "approximateAge": "6-8 hours (low confidence)",
  "source": "Sentinel-1 SAR VV, 2025-01-15 14:30 UTC"
}
```

---

## 7. Environmental Data

### 7.1 Ocean Currents — Primary: Copernicus Marine (CMEMS)

| Property | Value |
|----------|-------|
| Dataset | `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m` |
| Variables | `uo` (eastward velocity), `vo` (northward velocity) |
| Resolution | 1/12 deg (~8 km) |
| Temporal | Daily (forecast), hourly (GLOBCURRENT) |
| Coverage | Global including Indian Ocean |
| Access | `pip install copernicusmarine` + free account |
| Format | NetCDF via Python API |

```python
import copernicusmarine
ds = copernicusmarine.open_dataset(
    dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
    variables=['uo', 'vo'],
    minimum_longitude=50, maximum_longitude=100,
    minimum_latitude=-10, maximum_latitude=25,
    start_datetime="2025-01-01", end_datetime="2025-01-31"
)
```

### 7.2 Wind — Primary: ERA5 via CDS API

| Property | Value |
|----------|-------|
| Dataset | `reanalysis-era5-single-levels` |
| Variables | `10m_u_component_of_wind`, `10m_v_component_of_wind` |
| Resolution | 0.25 deg (~25 km) |
| Temporal | Hourly |
| Coverage | Global, 1940-present |
| Access | `pip install cdsapi` + free account |
| Format | NetCDF via CDS API |

```python
import cdsapi
c = cdsapi.Client()
c.retrieve('reanalysis-era5-single-levels', {
    'product_type': 'reanalysis',
    'variable': ['10m_u_component_of_wind', '10m_v_component_of_wind'],
    'year': '2025', 'month': '01', 'day': '15',
    'time': [f'{h:02d}:00' for h in range(24)],
    'area': [25, 50, -10, 100],
    'format': 'netcdf',
}, 'wind_indian_ocean.nc')
```

### 7.3 Wind — Simpler Alternative: Open-Meteo

| Property | Value |
|----------|-------|
| Variables | `wind_speed_10m`, `wind_direction_10m` |
| Resolution | 0.25 deg |
| Temporal | Hourly |
| Coverage | Global |
| Access | REST API, no key required |
| Limits | ~10,000 requests/day (non-commercial) |

### 7.4 Data Ingestion Strategy

| Source | Ingestion | Caching | Timestamp Handling |
|--------|-----------|---------|-------------------|
| CMEMS | `copernicusmarine.open_dataset()` | NetCDF files on disk, keyed by bbox+date | UTC, daily granularity |
| ERA5 | `cdsapi.Client().retrieve()` | NetCDF files on disk, keyed by bbox+date | UTC, hourly granularity |
| Open-Meteo | HTTP GET → JSON | In-memory cache, 1h TTL | UTC, hourly |
| OSCAR (ERDDAP) | `xarray.open_dataset(url)` | In-memory, no caching | UTC, daily |

### 7.5 Missing Data Handling

- If CMEMS unavailable → fallback to OSCAR (ERDDAP, no registration)
- If ERA5 unavailable → fallback to Open-Meteo (no key)
- If wind speed <2 m/s → flag as low-wind exclusion zone for SAR detection
- Interpolation: Linear for gaps <3h, nearest-neighbor for larger gaps

---

## 8. Forward Oil Drift

### 8.1 Model: OpenDrift/OpenOil (GPL-2.0)

**NOT building from scratch.** Using OpenDrift v1.12+ with OpenOil module.

### 8.2 Configuration

```python
from opendrift.models.openoil import OpenOil
from datetime import timedelta

o = OpenOil(weathering_model='noaa')

# Add environmental readers
o.add_reader([current_reader, wind_reader])

# Configure physics
o.set_config('processes:evaporation', True)
o.set_config('processes:emulsification', True)
o.set_config('drift:wind_fetch', 500000)  # fetch length in meters
o.set_config('drift:wind_drift_factor', 0.03)  # 3% of wind speed
o.set_config('drift:wind_drift_angle', 15)  # 15° right in Northern Hemisphere

# Seed oil particles
o.seed_elements(
    lon=72.5, lat=10.0, z=0, radius=100,
    number=5000, time=start_time,
    oil_type='GENERIC CRUDE'
)

# Run forward simulation
o.run(duration=timedelta(hours=6), time_step=900)  # 15-min steps
```

### 8.3 Particle Representation

Each particle has:
- `lon`, `lat` — position (degrees)
- `z` — depth (meters, 0 for surface)
- `mass_oil` — remaining oil mass (kg)
- `density` — oil density (kg/m³)
- `viscosity` — dynamic viscosity (Pa·s)

### 8.4 Processes Included

| Process | Method | Reference |
|---------|--------|-----------|
| Advection | Currents + wind drift (0-6%) + Stokes drift | Standard |
| Horizontal diffusion | Random walk, configurable | Okubo |
| Vertical mixing | Turbulent + buoyancy | James SC |
| Wave entrainment | Li & Johansen (2017) | Peer-reviewed |
| Evaporation | NOAA PyGNOME algorithm | NOAA |
| Emulsification | NOAA PyGNOME algorithm | NOAA |
| Dispersion | Wave-breaking droplet formation | Johansen (2015) |

### 8.5 Output Format

```json
{
  "particles": [
    { "lon": 72.35, "lat": 10.38, "z": 0, "mass_kg": 4.2, "age_hours": 6.0 }
  ],
  "extent": {
    "type": "Polygon",
    "coordinates": [[[72.33, 10.37], [72.37, 10.37], [72.37, 10.39], [72.33, 10.39], [72.33, 10.37]]]
  },
  "massBalance": {
    "evaporated_kg": 800,
    "dispersed_kg": 200,
    "remaining_kg": 4000
  }
}
```

### 8.6 Configurable Assumptions

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| Wind drift factor | 3% | 2.5-4.5% | Literature default, perturbed in ensemble |
| Wind drift angle | 15° | 10-20° | Northern Hemisphere |
| Diffusion coefficient | 100 m²/s | 50-200 m²/s | Horizontal turbulence |
| Oil type | GENERIC CRUDE | 1000+ options | NOAA ADIOS database |
| Particle count | 5000 | 1000-10000 | More = smoother extent |
| Timestep | 900s | 300-1800s | 15-min default |

---

## 9. Backward Source Estimation

### 9.1 Terminology

| Term | When to Use |
|------|-------------|
| **Backtracking** | Most common, scientifically accepted — USE THIS |
| **Backward-in-time tracking** | Formal term |
| **Hindcasting** | Running model from known end state |
| **Source estimation** | Specific application of backtracking |

**Do NOT use:** "reverse physics", "reverse simulation", "time reversal"

### 9.2 Method: OpenDrift Backward Mode

From Dagestad et al. (2018):
> "All instances of OpenDrift can be run in reverse by reversing the sign of the advective increment. Diffusive properties are kept in the forward sense."

```python
# Backward: negative timestep
o_back = OpenOil()
o_back.add_reader([current_reader, wind_reader])
o_back.seed_elements(
    lon=slick_centroid_lon, lat=slick_centroid_lat,
    number=5000, time=observation_time
)
o_back.run(duration=timedelta(hours=6), time_step=-900)  # NEGATIVE = BACKWARD
```

### 9.3 Backtracking Pipeline

```
Observed Slick (centroid, time)
      ↓
Particle Initialization (5000 particles at slick centroid)
      ↓
Backward Integration (OpenDrift negative timestep)
      ↓
Ensemble Perturbation (50 runs with perturbed parameters)
      ↓
Trajectory Cloud (50 × 5000 = 250,000 trajectories)
      ↓
Probability / Density Region (kernel density estimation)
      ↓
Probable Source (peak density point)
      ↓
Uncertainty Region (confidence contour)
```

### 9.4 Ensemble Configuration

| Parameter | Value | Perturbation Range |
|-----------|-------|-------------------|
| Number of ensembles | 50 | — |
| Particles per ensemble | 5000 | — |
| Wind drift factor | 3.5% | 2.5-4.5% (uniform) |
| Diffusion coefficient | 100 m²/s | 50-200 m²/s (uniform) |
| Current field uncertainty | ±10% | Multiplicative noise |
| Timestep | -900s (15 min) | — |
| Duration | 6h backward | Configurable (1-24h) |

### 9.5 Source Estimation

```python
# After ensemble completion
all_endpoints = []  # Collect final positions from all ensemble runs

# Kernel density estimation
from scipy.stats import gaussian_kde
kde = gaussian_kde(all_endpoints.T)

# Find peak density
peak_lon, peak_lat = all_endpoints[np.argmax(kde(all_endpoints.T))]

# Uncertainty: standard deviation of endpoint cluster
std_lon = np.std([p[0] for p in all_endpoints])
std_lat = np.std([p[1] for p in all_endpoints])
uncertainty_km = haversine(std_lon, std_lat) * 2  # ~2σ radius

# Confidence: fraction of endpoints within X km of peak
within_threshold = sum(1 for p in all_endpoints 
                       if haversine(p, (peak_lon, peak_lat)) < 5.0) / len(all_endpoints)
confidence = within_threshold
```

### 9.6 Output Structure

```json
{
  "origin": { "lat": 10.38, "lon": 72.28 },
  "originUncertainty_km": 3.4,
  "spillTime": "2025-01-15T08:37:00Z",
  "timeUncertainty_min": 22,
  "confidence": 0.87,
  "ensembleRuns": 50,
  "particlesPerRun": 5000,
  "backtrackDuration_hours": 6,
  "environmentalData": {
    "currentSource": "CMEMS",
    "windSource": "ERA5"
  }
}
```

### 9.7 Key Limitations

1. **Time irreversibility:** Oil weathering (evaporation, emulsification) cannot be reversed — backward models disable these processes
2. **Flow divergence:** In strongly convergent/divergent flows, backward trajectories diverge rapidly
3. **Predictability horizon:** 1-2.5 days for typical ocean conditions; accuracy degrades significantly beyond 24h
4. **Wind field accuracy:** Backtracking requires accurate historical wind fields — ERA5 reanalysis is the best available
5. **Oil type uncertainty:** Without knowing actual oil type, predictions are less reliable

---

## 10. AIS Pipeline

### 10.1 Data Sources — Clear Distinction

| Source | Coverage | Type | Cost | Use Case |
|--------|----------|------|------|----------|
| **Simulated Indian Ocean** | Indian Ocean | Generated tracks | Free | **Hackathon demo** |
| NOAA Marine Cadastre | US waters | Historical CSV | Free | Reference/testing |
| AIS Stream | Global | Real-time WebSocket | Free | Live demo (if needed) |
| Global Fishing Watch | Global | Presence 2012-now | Free | Non-commercial |

**For the hackathon demo:** Use simulated Indian Ocean AIS tracks. The UI and documentation must clearly label this as "simulated vessel traffic" — NOT real historical Indian Ocean AIS.

### 10.2 AIS Data Fields

```json
{
  "mmsi": "538001234",
  "imo": "9876543",
  "timestamp": "2025-01-15T14:30:00Z",
  "latitude": 10.42,
  "longitude": 72.31,
  "speed_over_ground": 12.5,
  "course_over_ground": 45.0,
  "heading": 43.0,
  "vessel_name": "MV Pacific Star",
  "vessel_type": "Cargo",
  "length": 200,
  "beam": 32,
  "draft": 8.5
}
```

### 10.3 AIS Processing Pipeline

```
AIS Data (simulated or real)
  ↓
Temporal Filtering (±48h of estimated spill time)
  ↓
Spatial Filtering (±50km of estimated origin)
  ↓
Trajectory Reconstruction (interpolate between messages)
  ↓
Anomaly Detection (speed drops, heading deviations, loitering, gaps)
  ↓
Candidate Vessels (filtered set for scoring)
```

### 10.4 AIS Anomaly Detection Methods

| Method | What It Detects | Algorithm |
|--------|-----------------|-----------|
| Speed drop | Potential discharge during slow steaming | Speed < vessel_type_avg * 0.5 |
| Heading deviation | Unusual course change near spill | Heading variance > threshold |
| Loitering | Staying in area too long | Time_in_zone > vessel_type_avg |
| Gap detection | Transponder turned off | Missing messages > 30 min |

### 10.5 Simulated Indian Ocean AIS Generation

```python
# Shipping lanes for Indian Ocean demo
SHIPPING_LANES = [
    {"name": "Arabian Sea West", "waypoints": [(60, 15), (65, 12), (72, 10), (78, 8)]},
    {"name": "Bay of Bengal", "waypoints": [(80, 10), (85, 12), (90, 15), (95, 18)]},
    {"name": "Malacca Approach", "waypoints": [(95, 5), (98, 3), (100, 1), (102, 1)]},
    {"name": "Mumbai-Kochi", "waypoints": [(72.8, 19), (73, 15), (73.5, 10), (76, 8)]},
    {"name": "Gujarat Coast", "waypoints": [(68, 23), (70, 22), (72, 20), (73, 19)]},
]

VESSEL_TYPES = [
    {"type": "Cargo", "speed_range": (12, 18), "count": 15},
    {"type": "Tanker", "speed_range": (10, 16), "count": 8},
    {"type": "Fishing", "speed_range": (4, 8), "count": 20},
    {"type": "Passenger", "speed_range": (15, 22), "count": 5},
]

# Generate 48h tracks for each vessel
# Include 1-2 vessels with anomalous behavior near spill location
```

---

## 11. Vessel Attribution

### 11.1 Scoring Framework

| Factor | Weight | Method | Range |
|--------|--------|--------|-------|
| Spatial proximity | 0.25 | Haversine distance to estimated origin | 0-1 (closer = higher) |
| Temporal compatibility | 0.20 | Overlap of vessel track with spill time window | 0-1 |
| Trajectory compatibility | 0.25 | How well vessel path aligns with backtracking | 0-1 |
| Behavioral anomaly | 0.15 | Speed drops, heading changes, loitering near origin | 0-1 |
| Environmental consistency | 0.15 | Wind/current consistency with vessel movement | 0-1 |

**Important:** These weights are **prototype engineering choices**, not scientifically proven universal weights. They are tunable and should be documented as such.

### 11.2 Scoring Algorithm

```python
def score_vessel(vessel, origin_estimation, backtracking_result):
    # 1. Spatial proximity to estimated origin
    dist_km = haversine(vessel.position, origin_estimation.origin)
    dist_score = 1.0 / (1.0 + dist_km / 10.0)  # Normalized by 10km

    # 2. Temporal compatibility
    vessel_time_at_origin = interpolate_time(vessel.track, origin_estimation.origin)
    time_diff_hours = abs(vessel_time_at_origin - origin_estimation.spillTime).total_seconds() / 3600
    time_score = 1.0 / (1.0 + time_diff_hours / 6.0)  # Normalized by 6h

    # 3. Trajectory compatibility
    traj_score = trajectory_match_score(vessel.track, backtracking_result.trajectories)

    # 4. Behavioral anomaly
    anomaly_score = compute_anomaly_score(vessel.track)

    # 5. Environmental consistency
    env_score = environmental_consistency(vessel, origin_estimation)

    # Weighted composite
    score = (0.25 * dist_score +
             0.20 * time_score +
             0.25 * traj_score +
             0.15 * anomaly_score +
             0.15 * env_score)

    return {
        "total": round(score, 3),
        "factors": {
            "spatial": round(dist_score, 3),
            "temporal": round(time_score, 3),
            "trajectory": round(traj_score, 3),
            "anomaly": round(anomaly_score, 3),
            "environmental": round(env_score, 3)
        }
    }
```

### 11.3 Output Structure

```json
{
  "vessels": [
    {
      "rank": 1,
      "vesselId": "abc123",
      "mmsi": "538001234",
      "name": "MV Pacific Star",
      "score": 0.87,
      "factors": {
        "spatial": 0.92,
        "temporal": 0.88,
        "trajectory": 0.91,
        "anomaly": 0.76,
        "environmental": 0.84
      }
    }
  ],
  "totalCandidates": 7,
  "scoredAt": "2025-01-15T15:00:00Z"
}
```

---

## 12. Deterministic AI Agent

### 12.1 Architecture

The investigation agent is an **orchestration system** — NOT an LLM-hallucinating agent.

It calls well-defined scientific tools in sequence. Every tool produces deterministic, reproducible results.

### 12.2 Tool Registry

| Tool | Input | Output | Service |
|------|-------|--------|---------|
| `detect_slick` | SAR image/patch | Detection mask + geometry | Python |
| `characterize_slick` | Detection mask | Area, centroid, perimeter, bbox, orientation | Python |
| `get_currents` | Bbox + time | u/v current field | Python |
| `get_wind` | Bbox + time | u/v wind field | Python |
| `run_forward_drift` | Origin + env + duration | Predicted slick extent | Python |
| `run_backtracking` | Slick geometry + env + duration | Origin probability surface | Python |
| `estimate_source` | Ensemble results | Origin point + uncertainty + confidence | Python |
| `query_ais` | Origin + time window | Vessel tracks in region/time | Spring Boot |
| `filter_vessels` | Tracks + origin estimation | Candidate vessels | Spring Boot |
| `score_vessels` | Candidates + origin + drift | Ranked suspects with scores | Spring Boot |
| `calculate_uncertainty` | Ensemble results | Confidence intervals | Python |
| `generate_report` | All results | Investigation document | Spring Boot |

### 12.3 Execution Order

```
1. detect_slick           → oil_mask
2. characterize_slick     → slick_geometry
3. get_currents           → current_field
4. get_wind               → wind_field
5. run_backtracking       → ensemble_results
6. estimate_source        → origin_estimate
7. query_ais              → vessel_tracks
8. filter_vessels         → candidates
9. score_vessels          → ranked_vessels
10. calculate_uncertainty → uncertainty
11. generate_report       → investigation_report
```

### 12.4 Investigation Log (Explainability)

```json
{
  "steps": [
    {"step": 1, "tool": "detect_slick", "status": "complete", "timestamp": "2025-01-15T15:00:01Z",
     "detail": "Sentinel-1 SAR VV, 2025-01-15 14:30 UTC, 5-class SegFormer-B2"},
    {"step": 2, "tool": "characterize_slick", "status": "complete", "timestamp": "2025-01-15T15:00:02Z",
     "detail": "Area: 2.3 km2, Centroid: 10.42N, 72.31E, Orientation: 45°"},
    {"step": 3, "tool": "get_currents", "status": "complete", "timestamp": "2025-01-15T15:00:05Z",
     "detail": "CMEMS GLORYS12V1, 1/12 deg, uo/vo fields loaded"},
    {"step": 4, "tool": "get_wind", "status": "complete", "timestamp": "2025-01-15T15:00:06Z",
     "detail": "ERA5, 0.25 deg, 10m u/v components loaded"},
    {"step": 5, "tool": "run_backtracking", "status": "complete", "timestamp": "2025-01-15T15:00:16Z",
     "detail": "50 ensembles × 5000 particles, 6h backward, origin surface generated"},
    {"step": 6, "tool": "estimate_source", "status": "complete", "timestamp": "2025-01-15T15:00:17Z",
     "detail": "Origin: 10.38N, 72.28E ±3.4 km, Time: 08:37 UTC ±22 min, Confidence: 87%"},
    {"step": 7, "tool": "query_ais", "status": "complete", "timestamp": "2025-01-15T15:00:18Z",
     "detail": "7 vessels in origin window (48h, 50km radius)"},
    {"step": 8, "tool": "filter_vessels", "status": "complete", "timestamp": "2025-01-15T15:00:19Z",
     "detail": "4 candidates after filtering"},
    {"step": 9, "tool": "score_vessels", "status": "complete", "timestamp": "2025-01-15T15:00:20Z",
     "detail": "Top candidate: MV Pacific Star (score: 0.87)"},
    {"step": 10, "tool": "calculate_uncertainty", "status": "complete", "timestamp": "2025-01-15T15:00:21Z",
     "detail": "Position uncertainty: ±3.4 km, Time uncertainty: ±22 min"},
    {"step": 11, "tool": "generate_report", "status": "complete", "timestamp": "2025-01-15T15:00:22Z",
     "detail": "Investigation complete, report generated"}
  ]
}
```

### 12.5 What the Agent Must NOT Do

- Do NOT use an LLM to "analyze" the slick
- Do NOT generate text from AI models for scientific conclusions
- Do NOT "predict" using language models
- Do NOT invent numerical results — every number must come from a deterministic tool

### 12.6 What the Agent MUST Do

- Call well-defined scientific tools in sequence
- Log every step with timestamps and parameters
- Report confidence intervals (not point estimates)
- Show evidence for every conclusion
- Explain which data sources were used
- State assumptions explicitly

---

## 13. Data Model

### 13.1 Collections

#### simulation
```javascript
{
  "_id": ObjectId,
  "status": "captain_mode" | "simulating" | "observation" | "investigation" | "completed",
  "mode": "investigation" | "captain",
  "clock": ISODate("2025-01-15T14:30:00Z"),
  "region": {
    "type": "Polygon",
    "coordinates": [[[50, -10], [100, -10], [100, 25], [50, 25], [50, -10]]]
  },
  "environment": {
    "currentSource": "CMEMS",
    "windSource": "ERA5",
    "cachedDataFiles": ["currents_2025-01-15.nc", "wind_2025-01-15.nc"]
  },
  "vesselIds": [ObjectId],
  "spillEventId": ObjectId,
  "incidentId": ObjectId,
  "investigationId": ObjectId,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

#### vessel
```javascript
{
  "_id": ObjectId,
  "simulationId": ObjectId,
  "mmsi": "538001234",
  "imo": "9876543",
  "name": "MV Pacific Star",
  "type": "Cargo",
  "length": 200,
  "beam": 32,
  "draft": 12,
  "position": { "type": "Point", "coordinates": [72.3, 10.4] },
  "speed": 12.5,
  "heading": 45,
  "course": 44,
  "track": [
    { "time": ISODate, "lat": Number, "lon": Number, "speed": Number, "heading": Number }
  ],
  "isSimulated": true
}
```

#### spill_event
```javascript
{
  "_id": ObjectId,
  "simulationId": ObjectId,
  "vesselId": ObjectId,
  "location": { "type": "Point", "coordinates": [72.3, 10.4] },
  "time": ISODate,
  "oilType": "GENERIC CRUDE",
  "quantityKg": 5000,
  "type": "accidental" | "illegal",
  "isGroundTruth": true,
  "forwardSimulation": {
    "duration_hours": 6,
    "particleCount": 5000,
    "timesteps": [...]
  }
}
```

#### incident
```javascript
{
  "_id": ObjectId,
  "simulationId": ObjectId,
  "spillEventId": ObjectId,
  "observedTime": ISODate,
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "area_km2": 2.3,
  "centroid": { "type": "Point", "coordinates": [72.35, 10.38] },
  "orientation_deg": 45,
  "satelliteObservation": {
    "source": "Sentinel-1",
    "acquisitionTime": ISODate,
    "polarization": "VV",
    "mode": "IW"
  },
  "detectionConfidence": 0.82
}
```

#### investigation
```javascript
{
  "_id": ObjectId,
  "simulationId": ObjectId,
  "incidentId": ObjectId,
  "status": "running" | "completed",
  "startedAt": ISODate,
  "completedAt": ISODate,
  "steps": [
    {
      "step": 1,
      "tool": "detect_slick",
      "status": "complete",
      "timestamp": ISODate,
      "detail": "Sentinel-1 SAR VV, 2025-01-15 14:30 UTC",
      "provenance": { "model": "SegFormer-B2", "dataset": "ROBORDER" }
    }
  ],
  "prediction": {
    "origin": { "type": "Point", "coordinates": [72.28, 10.38] },
    "originUncertainty_km": 3.4,
    "spillTime": ISODate,
    "timeUncertainty_min": 22,
    "confidence": 0.87
  },
  "candidateVessels": [
    {
      "vesselId": ObjectId,
      "rank": 1,
      "score": 0.87,
      "factors": {
        "spatial": 0.92,
        "temporal": 0.88,
        "trajectory": 0.91,
        "anomaly": 0.76,
        "environmental": 0.84
      }
    }
  ],
  "groundTruthRevealed": false
}
```

#### ground_truth (ISOLATED — separate collection)
```javascript
{
  "_id": ObjectId,
  "simulationId": ObjectId,
  "spillEventId": ObjectId,
  "actualVesselId": ObjectId,
  "actualOrigin": { "type": "Point", "coordinates": [72.3, 10.4] },
  "actualSpillTime": ISODate,
  "actualOilType": "GENERIC CRUDE",
  "actualQuantityKg": 5000,
  "revealedAt": null,
  "errorMetrics": null
}
```

### 13.2 Indexes

```javascript
// vessel
db.vessel.createIndex({ "simulationId": 1 })
db.vessel.createIndex({ "position": "2dsphere" })
db.vessel.createIndex({ "mmsi": 1 })

// spill_event
db.spill_event.createIndex({ "simulationId": 1 })
db.spill_event.createIndex({ "location": "2dsphere" })
db.spill_event.createIndex({ "time": -1 })

// incident
db.incident.createIndex({ "simulationId": 1 })
db.incident.createIndex({ "geometry": "2dsphere" })
db.incident.createIndex({ "observedTime": -1 })

// investigation
db.investigation.createIndex({ "simulationId": 1 })
db.investigation.createIndex({ "incidentId": 1 })
db.investigation.createIndex({ "status": 1 })

// ground_truth
db.ground_truth.createIndex({ "simulationId": 1 }, { unique: true })
```

---

## 14. Ground-Truth Isolation

### 14.1 Isolation Requirement

The investigation pipeline must NOT be able to accidentally read:
- `actualVesselId`
- `actualOrigin`
- `actualSpillTime`
- `actualOilType`
- `actualQuantityKg`

before the investigation completes and the judge requests the reveal.

### 14.2 Isolation Architecture

```
GROUND TRUTH (ground_truth collection)
     │
     ├── Actual origin
     ├── Actual vessel
     ├── Actual time
     ├── Actual parameters
     │
     │   ┌─────────────────────────────────┐
     │   │  Investigation Pipeline          │
     │   │  (CANNOT access ground_truth)    │
     │   │                                  │
     │   │  Inputs:                         │
     │   │  - Incident (observed slick)     │
     │   │  - Environmental data            │
     │   │  - AIS data                      │
     │   │                                  │
     │   │  Outputs:                        │
     │   │  - Prediction                    │
     │   │  - Candidate vessels             │
     │   └─────────────────────────────────┘
     │
     │
     Reveal Endpoint (POST /investigation/{id}/reveal)
              ↓
       Compare prediction vs ground_truth
              ↓
       Error metrics → Frontend
```

### 14.3 Isolation at Every Level

**Database level:**
- `ground_truth` is a separate collection
- Investigation queries never touch `ground_truth` collection
- MongoDB collection-level access control (application-level enforcement)

**Service level:**
- Python service has no `ground_truth` endpoint
- Spring Boot investigation controller has no `ground_truth` access
- Investigation tools never receive ground truth as input

**API level:**
- `POST /investigation/{id}/reveal` is the ONLY endpoint that reads `ground_truth`
- Reveal endpoint requires investigation status = "completed"
- Reveal endpoint computes error metrics and returns them

**Frontend level:**
- "Reveal Truth" button disabled until investigation completes
- Ground truth data only fetched after reveal confirmation
- Error metrics displayed only after reveal

**Agent/tool level:**
- No investigation tool has ground truth as input parameter
- Agent orchestration never passes ground truth to any tool
- Investigation log never contains ground truth values

### 14.4 Reveal Flow

```
1. Investigation completes → status = "completed"
2. Frontend enables "Reveal Truth" button
3. Judge clicks "Reveal Truth"
4. Frontend sends POST /investigation/{id}/reveal
5. Backend reads ground_truth collection
6. Backend computes:
   - positionError_km = haversine(predicted_origin, actual_origin)
   - timeError_min = abs(predicted_time - actual_time) in minutes
   - attributionCorrect = (top_scored_vessel == actual_vessel)
   - scoreMargin = top_score - second_score
7. Backend stores errorMetrics in ground_truth document
8. Backend returns error metrics to frontend
9. Frontend displays comparison visualization
```

---

## 15. API Contracts

### 15.1 Spring Boot REST API

#### Simulation
```
POST   /api/simulation
  Body: { "region": { "north", "south", "east", "west" }, "mode": "captain" | "investigation" }
  Response: { "simulationId": "abc123", "status": "captain_mode", "clock": "2025-01-15T08:00:00Z" }

GET    /api/simulation/{id}
  Response: { "status", "clock", "vessels", "spillEvent", "incident", "investigation" }

POST   /api/simulation/{id}/advance
  Body: { "hours": 6 }
  Response: { "clock": "2025-01-15T14:00:00Z", "particles": [...] }
```

#### Vessels
```
GET    /api/simulation/{id}/vessels
  Response: { "vessels": [{ "id", "mmsi", "name", "type", "position", "speed", "heading" }] }

POST   /api/simulation/{id}/vessels/{vesselId}/move
  Body: { "latitude": 10.45, "longitude": 72.4, "speed": 12, "heading": 45 }
  Response: { "position": {...}, "timestamp": "..." }

POST   /api/simulation/{id}/vessels/{vesselId}/spill
  Body: { "type": "accidental" | "illegal", "oilType": "GENERIC CRUDE", "quantityKg": 5000 }
  Response: { "spillEventId": "...", "incidentId": "...", "location": {...} }
```

#### Environment
```
GET    /api/environment/current?simulationId=X&bbox=50,-10,100,25&time=2025-01-15T14:00:00Z
  Response: { "source": "CMEMS", "fields": [{ "lat", "lon", "u", "v" }] }

GET    /api/environment/wind?simulationId=X&bbox=50,-10,100,25&time=2025-01-15T14:00:00Z
  Response: { "source": "ERA5", "fields": [{ "lat", "lon", "u", "v" }] }
```

#### Incidents
```
GET    /api/incidents/{id}
  Response: { "slick": { "geometry", "area_km2", "centroid", "orientation" }, "environment": {...} }
```

#### Investigation
```
POST   /api/investigation/{incidentId}/start
  Response: { "investigationId": "...", "status": "running" }

GET    /api/investigation/{id}
  Response: { "status", "steps": [...], "prediction": {...}, "candidateVessels": [...] }

GET    /api/investigation/{id}/steps
  Response: { "steps": [{ "step", "tool", "status", "timestamp", "detail" }] }

POST   /api/investigation/{id}/reveal
  Response: { "positionError_km", "timeError_min", "attributionCorrect", "scoreMargin" }
```

### 15.2 Python Scientific Service API

#### Detection
```
POST   /api/detect
  Body: { "imageBase64": "...", "region": { "lat", "lon" } }
  Response: { "mask": [...], "area_km2", "centroid": {...}, "geometry": {...}, "confidence": 0.82 }
```

#### Characterization
```
POST   /api/characterize
  Body: { "mask": [...], "region": { "lat", "lon" } }
  Response: { "area_km2", "perimeter_km", "centroid": {...}, "boundingBox": {...}, "orientation_deg", "shapeFactor" }
```

#### Environment
```
POST   /api/environment
  Body: { "bbox": [west, south, east, north], "time": "2025-01-15T14:00:00Z", "variables": ["currents", "wind"] }
  Response: { "currents": {...}, "wind": {...}, "source": "CMEMS/ERA5" }
```

#### Backtracking
```
POST   /api/backtrack
  Body: {
    "origin": { "lat", "lon" },
    "time": "2025-01-15T14:00:00Z",
    "duration_hours": 6,
    "currents": {...},
    "wind": {...},
    "ensemble": 50,
    "particles_per_ensemble": 5000
  }
  Response: {
    "originEstimate": { "lat", "lon" },
    "uncertainty_km": 3.4,
    "timeEstimate": "2025-01-15T08:37:00Z",
    "timeUncertainty_min": 22,
    "confidence": 0.87,
    "trajectories": [...]
  }
```

#### Forward Drift
```
POST   /api/forward-drift
  Body: {
    "origin": { "lat", "lon" },
    "time": "2025-01-15T08:00:00Z",
    "duration_hours": 6,
    "currents": {...},
    "wind": {...},
    "oilType": "GENERIC CRUDE",
    "particleCount": 5000
  }
  Response: {
    "particles": [{ "lon", "lat", "z", "mass_kg" }],
    "extent": { "type": "Polygon", "coordinates": [...] },
    "massBalance": { "evaporated_kg", "dispersed_kg", "remaining_kg" }
  }
```

#### Vessel Scoring
```
POST   /api/score-vessels
  Body: {
    "candidates": [{ "vesselId", "track": [...] }],
    "origin": { "lat", "lon", "time" },
    "backtracking": {...}
  }
  Response: {
    "vessels": [{ "vesselId", "rank", "score", "factors": {...} }]
  }
```

### 15.3 WebSocket Events

#### /ws/simulation/{id}
```json
{ "type": "clock_update", "time": "2025-01-15T15:30:00Z" }
{ "type": "vessel_moved", "vesselId": "abc", "position": {...}, "speed": 12, "heading": 45 }
{ "type": "spill_released", "spillEventId": "...", "location": {...}, "vesselId": "abc" }
{ "type": "oil_particles", "particles": [{ "lat", "lon", "radius", "opacity" }] }
```

#### /ws/investigation/{id}
```json
{ "type": "investigation_started", "investigationId": "..." }
{ "type": "step_complete", "step": 1, "tool": "detect_slick", "progress": 0.09, "detail": "..." }
{ "type": "step_complete", "step": 6, "tool": "estimate_source", "progress": 0.55, "detail": "..." }
{ "type": "origin_estimated", "origin": {...}, "uncertainty_km": 3.4, "confidence": 0.87 }
{ "type": "vessels_ranked", "candidates": [{ "vesselId", "rank", "score" }] }
{ "type": "investigation_complete", "investigationId": "..." }
```

---

## 16. Error Handling

### 16.1 Error Categories and Responses

| Error | Service | Response | Degradation |
|-------|---------|----------|-------------|
| Invalid input | Both | 400 Bad Request + message | Reject request |
| Missing environmental data | Python | 503 + fallback source suggestion | Try OSCAR/Open-Meteo |
| Failed ML inference | Python | 500 + error detail | Return empty mask |
| OpenDrift failure | Python | 500 + OpenDrift error log | Return partial results if available |
| No detected slick | Python | 200 + empty detection | Show "No slick detected" |
| No AIS candidates | Spring Boot | 200 + empty candidates | Show "No candidates found" |
| Low-confidence result | Both | 200 + low confidence flag | Show results with warning |
| Unavailable satellite data | Python | 503 + data source error | Use cached/demo data |
| Timeout (>30s) | Both | 504 Gateway Timeout | Return partial progress |
| Partial result | Both | 200 + partial flag | Show what's available |

### 16.2 Graceful Degradation Principles

1. **Never pretend success** — if a step fails, report it honestly
2. **Always show partial results** — even if some steps failed
3. **Log everything** — every error goes to investigation log
4. **Allow retry** — investigation can resume from last successful step
5. **Timeout handling** — long operations report progress via WebSocket

---

## 17. Provenance

### 17.1 Provenance Chain

Every important scientific result must be traceable:

```
Result
  ↓
Data source (CMEMS, ERA5, Sentinel-1, etc.)
  ↓
Dataset/version (e.g., cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m)
  ↓
Timestamp (when data was acquired/computed)
  ↓
Model version (e.g., SegFormer-B2, OpenDrift 1.12)
  ↓
Parameters (wind_drift_factor, ensemble_count, etc.)
  ↓
Computation (what was done)
  ↓
Result (the output)
```

### 17.2 What Metadata Must Be Stored

```json
{
  "provenance": {
    "currents": {
      "source": "CMEMS",
      "dataset": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
      "accessedAt": "2025-01-15T15:00:05Z",
      "region": [50, -10, 100, 25],
      "variables": ["uo", "vo"]
    },
    "wind": {
      "source": "ERA5",
      "dataset": "reanalysis-era5-single-levels",
      "accessedAt": "2025-01-15T15:00:06Z",
      "resolution": "0.25 deg"
    },
    "detection": {
      "model": "SegFormer-B2",
      "trainingDataset": "ROBORDER",
      "classes": 5,
      "oilIoU": 0.55,
      "oilF1": 0.80
    },
    "backtracking": {
      "model": "OpenDrift 1.12 + OpenOil",
      "ensembleRuns": 50,
      "particlesPerRun": 5000,
      "duration_hours": 6,
      "windDriftFactor_range": [0.025, 0.045],
      "diffusion_range": [50, 200]
    }
  }
}
```

---

## 18. Validation

### 18.1 Validation Scenarios

| # | Name | Location | Vessel | Difficulty | Expected Position Error | Expected Time Error |
|---|------|----------|--------|-----------|------------------------|---------------------|
| 1 | Arabian Sea Tanker | 10.5°N, 72.5°E | VLCC, 25 kn | Easy | <3 km | <20 min |
| 2 | Bay of Bengal Cargo | 14.0°N, 85.0°E | Container, 18 kn | Medium | <5 km | <30 min |
| 3 | Malacca Strait | 3.0°N, 100.5°E | Bulk carrier, 12 kn | Hard | <8 km | <45 min |
| 4 | Lakshadweep | 10.5°N, 72.0°E | Trawler, 8 kn | Medium | <5 km | <30 min |
| 5 | Tamil Nadu Coast | 9.5°N, 79.5°E | Supply vessel, 15 kn | Medium | <5 km | <30 min |
| 6 | Offshore Platform | 15.0°N, 70.0°E | Fixed platform | Easy | <2 km | <15 min |
| 7 | Goa Coast | 15.5°N, 73.8°E | Tug, 6 kn | Medium | <4 km | <25 min |
| 8 | Gujarat Coast | 22.5°N, 68.5°E | Chemical tanker, 20 kn | Medium | <4 km | <25 min |
| 9 | Kerala Coast | 8.5°N, 76.5°E | Ferry, 18 kn | Easy | <3 km | <20 min |
| 10 | Andaman Sea | 10.0°N, 96.0°E | Fishing, 10 kn | Hard | <8 km | <45 min |

### 18.2 Validation Flow

```
Ground Truth (known origin, time, vessel)
  ↓
Generate observation (forward drift + simulated SAR)
  ↓
Run investigation (full pipeline, no ground truth access)
  ↓
Compare prediction vs ground truth
  ↓
Calculate metrics
```

### 18.3 Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Position error | Haversine(predicted, actual) | <5 km (mean) |
| Time error | abs(predicted - actual) in minutes | <30 min (mean) |
| Top-1 attribution | Is actual vessel ranked #1? | >70% |
| Top-3 attribution | Is actual vessel in top 3? | >90% |
| Confidence calibration | Does 87% confidence mean 87% correct? | Reasonable |
| False positive rate | Non-vessels ranked as suspect | <20% |
| Uncertainty coverage | Does uncertainty region contain actual? | >80% |

### 18.4 Important Distinction

```
Target     = What we aim for (engineering goal)
Expected   = What we think is achievable (based on literature)
Measured   = What we actually achieve (must be verified experimentally)
```

Do NOT write research-estimated numbers as achieved performance.

---

## 19. Performance Targets

These are **development targets**, not guaranteed results.

| Component | Target | Notes |
|-----------|--------|-------|
| Map rendering | 60 fps | deck.gl + WebGL |
| Particle animation | 50,000 particles | GPU-accelerated |
| API response (Spring Boot) | <500ms | Standard CRUD |
| ML inference (ONNX) | <2s | SegFormer-B2 on CPU |
| Backtracking (OpenDrift) | <10s | 50 ensembles × 5000 particles |
| Forward drift (OpenDrift) | <5s | 5000 particles, 6h |
| WebSocket latency | <100ms | Local network |
| MongoDB query | <100ms | With proper indexes |
| Environmental data fetch | <5s (cached), <30s (fresh) | CMEMS/ERA5 API |

---

## 20. What We Will NOT Build

| Item | Reason |
|------|--------|
| Custom oil-physics engine | OpenDrift/OpenOil is validated and superior |
| Chemical fingerprinting | PS does not require it; requires physical samples |
| Exact oil-volume estimation | SAR cannot reliably estimate volume |
| Guaranteed exact source identification | Uncertainty is inherent; we quantify it |
| Continuous global satellite monitoring | Sentinel-1 revisit is 6-12 days |
| Perfect AIS coverage | Terrestrial AIS has ~50km range; satellite AIS has gaps |
| Real-time satellite processing | Data has hours-to-days latency |
| LLM-generated scientific calculations | Agent orchestrates deterministic tools only |
| Indian Ocean operational system | This is a hackathon proof-of-concept |
| Subsurface oil plume detection | Surface models only |
| Multi-sensor fusion | Focus on Sentinel-1 SAR for hackathon |

---

## 21. Implementation Order

```
01. Architecture freeze                  ← WE ARE HERE (this document)
02. Repository/infrastructure setup      ← Git repo, Docker Compose, CI
03. Frontend shell                       ← React + Vite + MapLibre + Tailwind
04. Spring Boot backend                  ← Project structure, controllers
05. MongoDB setup                        ← Collections, indexes, Docker
06. WebSocket infrastructure             ← STOMP/SockJS setup
07. Captain Mode — vessel management     ← Vessel CRUD, movement, display
08. Captain Mode — spill trigger         ← Spill event creation
09. Environmental data ingestion         ← CMEMS + ERA5 Python service
10. OpenOil forward simulation           ← Python: OpenDrift forward drift
11. Forward drift visualization          ← Frontend: animated particles
12. Time advance + observation gen       ← Simulation clock + synthetic obs
13. SAR detection                        ← Python: ONNX inference
14. Slick characterization               ← Python: geometry extraction
15. Backtracking                         ← Python: OpenDrift backward mode
16. Uncertainty estimation               ← Python: ensemble calculations
17. AIS engine                           ← Simulated Indian Ocean tracks
18. Vessel filtering                     ← Spatial/temporal/trajectory filters
19. Vessel attribution                   ← Scoring algorithm
20. Deterministic investigation agent    ← Orchestrator with tool registry
21. Ground-truth isolation               ← Separate collection, reveal endpoint
22. Validation framework                 ← 10 scenarios, error metrics
23. Final dashboard                      ← Report view, comparison viz
24. Demo orchestration                   ← End-to-end captain mode flow
25. Performance optimization             ← Profiling, caching
26. Final testing                        ← All scenarios, edge cases
```

**Priority:** Scientific MVP first → Attribution → Agent → UI polish

---

## 22. Dependencies & Risks

### 22.1 External Dependencies

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| CMEMS API registration | May take 24-48h | Register early; fallback to OSCAR |
| CDS API (ERA5) registration | May take 24-48h | Register early; fallback to Open-Meteo |
| OpenDrift installation | Complex dependencies | Use Docker; test early |
| Sentinel-1 data access | Copernicus Data Space may throttle | Use pre-loaded demo images |
| MongoDB | Version compatibility | Use Docker, pin version |

### 22.2 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| OpenDrift backward mode fails | Core pipeline breaks | Low | PyGNOME fallback |
| ML model accuracy too low | False positives/negatives | Medium | Use multiple models, ensemble |
| Environmental data gaps | Inaccurate drift modelling | Medium | Multiple sources, interpolation |
| AIS simulation unrealistic | Unconvincing demo | Medium | Validate against real patterns |
| Performance too slow | Bad demo experience | Medium | Precomputation, caching |
| Ground truth leaks | Investigation integrity compromised | Low | Strict isolation architecture |

---

## 23. Licensing & Legal

| Component | License | Obligation |
|-----------|---------|------------|
| OpenDrift | GPL-2.0 | Must GPL any modified distribution |
| PyGNOME | Public domain | No obligation |
| OilLibrary | Public domain | No obligation |
| mados | MIT | Attribution |
| radar (reference) | MIT | Attribution |
| webgl-wind | MIT | Attribution |
| MapLibre GL JS | BSD-3-Clause | Attribution |
| deck.gl | MIT | Attribution |
| React | MIT | No obligation |
| Spring Boot | Apache-2.0 | Attribution |
| FastAPI | MIT | No obligation |
| MongoDB | SSPL | Free for hackathon (not SaaS) |

**Key constraint:** GPL-2.0 (OpenDrift) means if we modify and distribute OpenDrift source, we must release modifications under GPL-2.0. Using it as a library in our Python service is fine.

---

## 24. Key References

| # | Paper | Relevance |
|---|-------|-----------|
| 1 | Dagestad et al. (2018) — "OpenDrift v1.0" — GMD | Primary drift model |
| 2 | Breivik et al. (2012) — "BAKTRAK" — Ocean Dynamics | Backtracking methodology |
| 3 | El Mohtar et al. (2021) — "Bayesian Source ID" — MPB | Uncertainty quantification |
| 4 | Chen et al. (2025) — "Review of Backtracking Methods" | Method comparison |
| 5 | Johansen et al. (2015) — "Stochastic droplet model" — MPB | Oil physics |
| 6 | Li & Johansen (2017) — "Wave entrainment" — JGR | Oil weathering |
| 7 | Rohrs et al. (2018) — "Vertical mixing" — Ocean Science | OpenDrift config |
| 8 | Wang et al. (2023) — "DL-based SAR detection" — RSER | Detection approach |
| 9 | Pallotta et al. (2013) — "Maritime route learning" — OCEANS | AIS analysis |
| 10 | Nguyen et al. (2018) — "AIS anomaly detection" — IEEE Access | Anomaly scoring |

---

## 25. Implementation Readiness

### 25.1 Subsystem Readiness

| Subsystem | Status | Notes |
|-----------|--------|-------|
| Frontend (React+MapLibre) | READY | Well-understood, reference repos exist |
| Spring Boot backend | READY | Standard REST/WebSocket, team expertise |
| MongoDB | READY | Docker, standard schema |
| WebSocket events | READY | STOMP/SockJS, well-defined events |
| Captain Mode — vessel mgmt | READY | CRUD + movement, straightforward |
| Captain Mode — spill trigger | READY | Event creation + forward drift |
| Environmental ingestion | READY WITH ASSUMPTION | CMEMS/ERA5 free, registration needed |
| OpenOil forward simulation | READY WITH ASSUMPTION | OpenDrift installed and tested |
| SAR detection | REQUIRES VALIDATION | Pre-trained model accuracy on demo data unknown |
| Slick characterization | READY | Shapely geometry operations |
| Backtracking | READY WITH ASSUMPTION | OpenDrift backward mode validated in literature |
| Uncertainty estimation | READY WITH ASSUMPTION | Ensemble method is standard |
| AIS engine | READY | Simulated tracks, well-defined |
| Vessel filtering | READY | Spatial/temporal/trajectory filters |
| Vessel attribution | READY | Scoring algorithm, tunable weights |
| Deterministic agent | READY | Orchestrator + tool registry |
| Ground-truth isolation | READY | Separate collection, reveal endpoint |
| Validation framework | REQUIRES VALIDATION | 10 scenarios, metrics need experimental verification |
| Final dashboard | READY | Report view, comparison viz |
| Demo orchestration | REQUIRES VALIDATION | End-to-end flow needs testing |

### 25.2 Top 10 Technical Risks

1. **OpenDrift installation complexity** — dependency conflicts, GDAL/GEOS compilation
2. **ML model accuracy on Indian Ocean SAR** — trained on different datasets, may not generalize
3. **CMEMS/ERA5 registration delay** — could block environmental data ingestion
4. **Backtracking accuracy for >12h durations** — uncertainty grows rapidly
5. **AIS simulation realism** — judges may notice unrealistic vessel behavior
6. **OpenDrift backward mode edge cases** — may fail with certain environmental conditions
7. **MongoDB GeoJSON performance** — large spatial queries may be slow
8. **WebSocket state synchronization** — frontend/backend state drift
9. **GPL-2.0 compliance** — OpenDrift license requires careful handling
10. **Demo time constraints** — 26 implementation steps may not all complete in time

### 25.3 Immediate Next Task

**After this specification is approved:**

```
STEP 02: Repository and infrastructure setup
```

Specifically:
1. Create Git repository with proper structure
2. Create Docker Compose with 4 services (frontend, backend, python-service, mongodb)
3. Create Spring Boot project skeleton (controllers, models, config)
4. Create Python FastAPI project skeleton (endpoints, OpenDrift integration)
5. Create React + Vite project skeleton (MapLibre, deck.gl, Tailwind)
6. Verify MongoDB connectivity
7. Verify WebSocket connectivity
8. Verify Python→OpenDrift import works in Docker

**Do not start this yet — wait for specification approval.**

---

## Summary

### What Was Frozen

1. **Product definition** — investigation mode + captain mode, clearly distinguished
2. **Architecture** — React + Spring Boot + Python/FastAPI + MongoDB
3. **Oil drift model** — OpenDrift/OpenOil (GPL-2.0)
4. **SAR detection** — SegFormer-B2 pre-trained, ONNX Runtime
5. **Environmental data** — CMEMS (currents) + ERA5 (wind), with fallbacks
6. **AIS strategy** — Simulated Indian Ocean tracks for demo, clearly labeled
7. **Backtracking** — OpenDrift negative timestep, ensemble method, correct terminology
8. **Vessel attribution** — 5-factor weighted scoring, tunable weights
9. **Investigation agent** — Deterministic tool-calling orchestrator, NOT LLM
10. **Ground truth isolation** — Separate collection, strict reveal protocol
11. **API contracts** — REST + WebSocket, full endpoint definitions
12. **Data model** — 6 collections with indexes and relationships
13. **Implementation order** — 26 steps, scientific MVP first

### What Remains Uncertain

1. **ML model actual accuracy** on demo SAR data — must be experimentally verified
2. **Backtracking accuracy** for specific demo scenarios — must be tested
3. **OpenDrift installation** in Docker — may require troubleshooting
4. **CMEMS/ERA5 API availability** during demo — registration + network dependent
5. **AIS simulation realism** — needs validation against real vessel patterns
6. **Ensemble parameter ranges** — wind drift factor, diffusion coefficients need tuning
7. **Scoring weights** — 0.25/0.20/0.25/0.15/0.15 is an initial guess, needs tuning

### Biggest Implementation Risks

1. **OpenDrift backward mode** — core pipeline dependency, may have installation or runtime issues
2. **ML model generalization** — pre-trained on ROBORDER/DARTIS, Indian Ocean may differ
3. **Environmental data access** — CMEMS/ERA5 registration + API reliability
4. **Demo time** — 26 steps is ambitious for hackathon timeline

### Immediate Next Coding Task

**Step 02: Repository and infrastructure setup**
- Git repo with monorepo structure
- Docker Compose (4 services)
- Spring Boot project skeleton
- Python FastAPI project skeleton
- React + Vite project skeleton
- Verify all services start and communicate
