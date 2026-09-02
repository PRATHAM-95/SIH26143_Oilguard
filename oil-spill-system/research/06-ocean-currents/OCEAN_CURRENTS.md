# Ocean Current Strategy

## Primary: Copernicus Marine Service (CMEMS) — VERIFIED

```python
import copernicusmarine

ds = copernicusmarine.open_dataset(
    dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
    variables=['uo', 'vo'],  # eastward/northward velocity
    minimum_longitude=50, maximum_longitude=100,
    minimum_latitude=-10, maximum_latitude=25,
    start_datetime="2025-01-01",
    end_datetime="2025-01-31"
)
# Speed = sqrt(uo² + vo²)
```

### Specifications
- **Resolution:** 1/12 deg (~8 km)
- **Temporal:** Daily (forecast), hourly (GLOBCURRENT)
- **Components:** `uo` (eastward), `vo` (northward)
- **Coverage:** Full global including Indian Ocean
- **Cost:** Free with registration
- **Access:** https://data.marine.copernicus.eu

## Alternative: OSCAR via ERDDAP (No Registration)

```python
import xarray as xr
url = ("https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar.nc?"
       "u,v[('2025-01-01T00:00:00Z')][(0.0)][(-10.0):(25.0)][(50.0):(100.0)]")
ds = xr.open_dataset(url)
```

- **Resolution:** 0.25 deg (~25 km)
- **Components:** u, v (total), ug, vg (geostrophic)
- **No registration needed**

## Alternative: HYCOM (Highest Resolution)

- **Resolution:** 1/12 deg (~8 km), 3-hourly
- **Access:** OPeNDAP via THREDDS (`tds.hycom.org`)
- **Variables:** `water_u`, `water_v`
- **No registration needed**

## Indian Ocean Specific Sources
| Source | Resolution | Focus | Access |
|--------|-----------|-------|--------|
| **INCOIS HOOFS** | 4km | Northern Indian Ocean | ERDDAP |
| **MOSDAC (ISRO)** | 0.25 deg | Indian Ocean | Registration |
| **INCOIS GODAS** | 1/4 deg | Global, Indian focus | ERDDAP |

## Comparison Table
| Source | Res | Temporal | Indian Ocean | Latency | Cost | Python |
|--------|-----|----------|-------------|---------|------|--------|
| Copernicus Marine | 1/12 deg | Hourly-Daily | Global yes | 1 day NRT | Free | copernicusmarine |
| HYCOM | 1/12 deg | 3-hourly | Global yes | ~48 hrs | Free | xhycom, xarray |
| OSCAR v2.0 | 0.25 deg | Daily | Global yes | 2 days NRT | Free | ERDDAP/xarray |
| NOAA ERDDAP | 0.25 deg | Daily | Global yes | NRT | Free | erddapy |
| INCOIS HOOFS | 4km | 3-hourly | PRIMARY | Real-time | Free | xarray |
| GLOBCURRENT | 0.25 deg | Hourly | Global yes | 1 day-1 year | Free | copernicusmarine |
