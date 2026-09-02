# 📡 Member 2 — Data & Environment Researcher

> **PS:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO, Space Tech, Software)
> **Your one-line job:** Get EVERY byte of free data this project needs — satellite images, ocean currents, winds, ship tracks — clean it, and hand it over ready-to-use. **You are the supply chain. If you fail, everyone fails.**

---

## 🎯 Your Mission in Plain Words

Four kinds of data flow into this project:

| # | Data | Who eats it | Format |
|---|---|---|---|
| 1 | 🛰️ Satellite radar (SAR) images + oil labels | AI/ML guy | GeoTIFF |
| 2 | 🌊 Ocean surface currents | Physics guy | NetCDF |
| 3 | 💨 Wind speed & direction (10 m above sea) | Physics guy | NetCDF |
| 4 | 🚢 AIS ship positions (who/where/when/speed) | You → Backend → Scoring | CSV → Parquet |

Your deliverable is a `data/` folder that looks like this — filled, verified, documented:

```
data/
├── sar/raw/            sar/tiles/
├── currents/*.nc
├── winds/*.nc
├── ais/raw/*.csv       ais/clean/*.parquet
└── metadata.json       ← every file's source, date fetched, license, coverage
```

---

## 🔑 Day-1 Checklist: Create All Free Accounts

| Account | URL | Needed for |
|---|---|---|
| Copernicus Marine | [data.marine.copernicus.eu/register](https://data.marine.copernicus.eu/register) | Ocean currents |
| Copernicus Data Space | [dataspace.copernicus.eu](https://dataspace.copernicus.eu) | Raw Sentinel-1 radar scenes |
| ECMWF/CDS | [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu/user/register) | ERA5 wind reanalysis |
| Zenodo / MarineCadastre / PANGAEA | no account needed | Labeled images, AIS |

> ⏰ Do registrations on Day 1 — approval emails and API keys take time.

---

## 📘 Playbook A — Labeled Oil-Spill Images (feeds the ML guy)

Primary: **Zenodo Parts I–III** (the PS names them itself):

```
Part I   (1,200 oil imgs, 40.7 GB): https://zenodo.org/records/8346860
Part II  (685 look-alikes, ~20 GB): https://zenodo.org/records/8253899
Part III (test set,    9.9 GB):     https://zenodo.org/records/13761290   ← download FIRST
```

Backup/extra: Refined-SOS ([15298010](https://zenodo.org/records/15298010)), DARTIS negatives ([PANGAEA 980773](https://doi.pangaea.de/10.1594/PANGAEA.980773)), CSIRO chips ([data.csiro.au/collection/csiro:57430](https://data.csiro.au/collection/csiro:57430)).

> 💾 **Practical:** use a download manager or `curl -L -C - <url>` for resume support. Verify file sizes after download.

## 📗 Playbook B — Raw Sentinel-1 Scenes (fresh incidents)

Via **Copernicus Data Space Ecosystem**: search by footprint+date, download GRD products free.
Web UI is fine; for scripting later use their OData/OpenSearch API. Only needed when we run inference on NEW scenes — the labeled datasets carry the training load.

## 📙 Playbook C — Ocean Currents (`copernicusmarine` toolbox)

```bash
pip install copernicusmarine xarray netcdf4 h5netcdf
copernicusmarine login          # saves credentials locally, once
```

Grab daily surface currents for a box around your incident (order = North West South East):

```bash
copernicusmarine subset \
  -i cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m \
  -v uo -v vo \
  -t 2025-05-24T00:00:00 -T 2025-05-26T00:00:00 \
  -x 70 -y 5 -X 80 -Y 15 \
  -o ../data/currents/arabian_sea_20250525.nc
```

- Product: `GLOBAL_ANALYSISFORECAST_PHY_001_024` (daily, ~8 km grid) — best for recent dates
- For older/hindcast years also know: `MULTIOBS_GLO_PHY_MYNRT_015_003` ("GlobCurrent" total surface currents)
- No download quotas. Python alternative:

```python
import copernicusmarine, xarray as xr
ds = copernicusmarine.open_dataset(dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m")
sub = ds[["uo", "vo"]].sel(time=slice("2025-05-24", "2025-05-26"),
                           latitude=slice(5, 15), longitude=slice(70, 80))
sub.to_netcdf("../data/currents/arabian_sea_20250525.nc")
```

## 📕 Playbook D — Winds via ERA5 (`cdsapi`)

```bash
pip install cdsapi
```

Create `%USERPROFILE%\.cdsapirc` (Windows!) containing your key from [cds.climate.copernicus.eu/profile](https://cds.climate.copernicus.eu/profile):

```
url: https://cds.climate.copernicus.eu/api
key: YOUR_PERSONAL_ACCESS_TOKEN
```

Download script (10 m winds, hourly, our box, NetCDF):

```python
import cdsapi
c = cdsapi.Client()
c.retrieve("reanalysis-era5-single-levels", {
    "product_type": ["reanalysis"],
    "format": "netcdf",
    "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
    "year": "2025", "month": "05",
    "day": ["24", "25", "26"],
    "time": ["00:00","01:00","02:00","03:00","04:00","05:00",
             "06:00","07:00","08:00","09:00","10:00","11:00",
             "12:00","13:00","14:00","15:00","16:00","17:00",
             "18:00","19:00","20:00","21:00","22:00","23:00"],
    "area": [15, 70, 5, 80],      # N, W, S, E
}, "../data/winds/era5_arabian_sea_20250525.nc")
```

> ⚠️ CDS queues can be slow (minutes–hours). Submit early, poll, don't panic. Reference tutorial: [joaohenry23/Download_ERA5_with_python](https://github.com/joaohenry23/Download_ERA5_with_python).

## 📒 Playbook E — AIS Ship Tracks

**Free real data:** NOAA [MarineCadastre](https://marinecadastre.gov) — bulk AIS files per UTM-zone per year (CSV). Columns you'll live with: `MMSI, BaseDateTime, LAT, LON, SOG, COG, Heading, VesselName, VesselType, Status`.
→ Download the zone(s)/months covering your demo incident.

**Tiny test data:** Danish Maritime Authority sample used by the MovingPandas tutorial ([ais sample notebook](https://movingpandas.github.io/movingpandas-website/2-analysis-examples/ship-data.html)) — perfect while real downloads run.

**Synthetic AIS (PS explicitly permits it):** write a generator producing plausible tracks — MMSIs, straight-line cargo lanes + noise, timestamps every few minutes; ONE vessel gets a deliberate dark-window near the spill origin. Document generator parameters honestly in metadata.json. This guarantees the demo has a known ground truth to catch.

## 📓 Playbook F — Cleaning Pipeline (practical thresholds from published work)

```bash
pip install movingpandas geopandas parquet-tools   # movingpandas pulls pandas/geopandas
```

Apply in order (thresholds follow published AIS preprocessing studies):

| Step | Rule |
|---|---|
| Dedup | exact duplicate rows (~3% of raw) |
| Speed sanity | drop points with `SOG < 0` or `SOG > 30 kn` |
| Jump removal | drop impossible position jumps / land-crossings between consecutive fixes |
| Acceleration check | enforce max accel/decel per Δt (physically implausible spikes corrected/dropped) |
| Split tracks | time-gap > **10 min** starts a new trajectory segment |
| Stationary filter | remove trajectories averaging `SOG < 1 kn` (moored ships pollute stats) |
| Resample | interpolate to regular 1-min points where needed |

```python
import movingpandas as mpd, geopandas as gpd
gdf = gpd.read_file("ais_kochi_may2025.geojson")           # after basic filters
traj_col = mpd.TrajectoryCollection(gdf, traj_id_col="MMSI", t="BaseDateTime")
stops = mpd.TrajectoryStopDetector(traj_col)               # stop detection built-in
```

---

## 📅 Week-by-Week Plan

| Days | Task |
|---|---|
| 1 | All accounts created; Part III downloading; currents+winds toolchains tested end-to-end |
| 2–3 | Zenodo full fetch; first `.nc` current + wind files for demo box delivered |
| 4–6 | MarineCadastre AIS downloads; synthetic-AIS generator v1; cleaning pipeline running |
| 7–9 | Clean Parquet outputs + metadata.json; hand sample files to Physics & Backend |
| 10–13 | Buffer: CDS queues, re-downloads, format surprises; freeze dataset versions |
| 14 | Data walkthrough session — every teammate can open every file type |

## ⚠️ Pitfalls That Kill Teams

1. **OneDrive syncing huge data folders** — keep `data/` outside OneDrive-synced paths (or pause sync).
2. CDS/Marine requests submitted too late — queue waits are real. Fire them Day 1.
3. Coordinate order mistakes: ERA5 wants `[N, W, S, E]`; currents want `-x -X -y -Y`. Write both down.
4. Everything is **UTC**. Mixing local IST times into incident windows breaks drift runs silently.
5. MarineCadastre coverage ≠ Indian waters — plan synthetic AIS from Day 1, not Day 12.

## 🤝 Handoffs

- **You give:** `data/` tree + metadata.json; clean AIS Parquet; current/wind NetCDFs; synthetic-AIS generator script
- **You need:** incident window + bounding box decision from Physics; expected file formats list from Backend

## 🛡️ Judge Q&A (your domain)

- **Why European/US data for an Indian problem?** The PS itself names NOAA/NASA-linked open datasets; physics is identical globally; synthetic AIS (PS-permitted) covers Indian waters until real feeds are provisioned post-hackathon.
- **What if internet dies mid-event?** All critical subsets pre-staged locally by Day 3; sizes documented.
