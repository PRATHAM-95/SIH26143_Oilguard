# Weather/Wind Strategy

## Primary: ERA5 via CDS API — VERIFIED

```python
import cdsapi
c = cdsapi.Client()
c.retrieve(
    'reanalysis-era5-single-levels',
    {
        'product_type': 'reanalysis',
        'variable': ['10m_u_component_of_wind', '10m_v_component_of_wind'],
        'year': '2025',
        'month': '01',
        'day': '15',
        'time': [f'{h:02d}:00' for h in range(24)],
        'area': [25, 50, -10, 100],  # N, W, S, E
        'format': 'netcdf',
    },
    'wind_indian_ocean.nc')
```

### Specifications
- **Resolution:** 0.25 deg (~25 km), hourly
- **Variables:** `10m_u_component_of_wind`, `10m_v_component_of_wind`
- **Coverage:** Global, 1940-present
- **Cost:** Free with registration
- **Access:** https://cds.climate.copernicus.eu

## Simpler Alternative: Open-Meteo — VERIFIED

```python
import requests
url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    "latitude": 10.0, "longitude": 72.0,
    "start_date": "2025-01-01", "end_date": "2025-01-31",
    "hourly": "wind_speed_10m,wind_direction_10m",
    "wind_speed_unit": "ms"
}
data = requests.get(url, params=params).json()
```

- **No API key required** (non-commercial)
- **Resolution:** 0.25 deg, hourly
- **Coverage:** Global
- **Cost:** Free (~10,000 req/day)

## Wind Variables for Oil Drift Model
| Variable | Value | Source |
|----------|-------|--------|
| Wind speed at 10m | U10 (m/s) | ERA5/Open-Meteo |
| Wind direction | degrees | ERA5/Open-Meteo |
| Wind drift factor | 3-4% of U10 | Literature default |
| Wind drift angle | ~15 deg right (NH) | Ekman theory |

## Comparison Table
| Source | Res | Temporal | Historical | Forecast | API | Free |
|--------|-----|----------|-----------|----------|-----|------|
| ERA5 (CDS) | 0.25 deg | Hourly | 1940-now | Reanalysis | CDS API (key) | Free |
| Open-Meteo | 0.25 deg | Hourly | 1940-now | Yes | REST JSON (no key) | Free |
| NOAA GFS | 0.25 deg | 3-6 hr | Short archive | Yes | NOMADS (GRIB2) | Free |
| ECMWF IFS | 9 km | 1-6 hr | 2017+ | Yes | ecmwf-opendata | Free |
| OpenWeatherMap | ~11-28 km | Hourly | Paid only | Yes | REST (API key) | 1k/day |

## Wave Data Sources
| Source | Res | Variables | Access |
|--------|-----|-----------|--------|
| ERA5-Ocean | 0.5 deg | SWH, direction, period | CDS API |
| Open-Meteo Marine | 5km-0.5 deg | Wave height, period, swell | REST JSON |
| GFS-Wave | 0.25 deg | SWH, direction, period | NOMADS GRIB2 |
| ECMWF WAM | 9 km | Full wave spectrum | Open-Meteo |

## SST Sources
| Source | Res | Access |
|--------|-----|--------|
| Open-Meteo Marine | Variable | REST JSON |
| NOAA MUR SST | 0.01 deg (~1km) | ERDDAP |
| GHRSST | Various | ERDDAP/S3 |
| ERA5 | 0.25 deg | CDS API |
| Copernicus Marine | ~8 km | CMEMS |
