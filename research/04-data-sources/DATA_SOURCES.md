# Data Sources

## Environmental Data (Free, Indian Ocean)
| Data | Source | Resolution | Access |
|------|--------|-----------|--------|
| **Ocean Currents** | Copernicus Marine (CMEMS) | 1/12 deg (~8km) | `pip install copernicusmarine` |
| **Wind** | ERA5 via CDS API | 0.25 deg (~25km) | `pip install cdsapi` |
| **Wind (simple)** | Open-Meteo | 0.25 deg | REST API, no key |
| **Waves** | ERA5-Ocean / Open-Meteo Marine | 0.5 deg / 5km | CDS / REST |
| **SST** | Open-Meteo Marine / GHRSST | Various | REST / ERDDAP |
| **Bathymetry** | GEBCO | 15 arc-sec | Free download |

## Satellite Data (Free)
| Source | Type | Resolution | Access |
|--------|------|-----------|--------|
| **Sentinel-1** | SAR C-band | 10m GRD | Copernicus Data Space |
| **Sentinel-2** | Optical MSI | 10m | Copernicus Data Space |
| **Landsat 8/9** | Optical TIR | 30m | USGS EarthExplorer |

## AIS Data
| Source | Coverage | Type | Cost |
|--------|----------|------|------|
| **Marine Cadastre** | US only | Historical bulk | Free |
| **AIS Stream** | Global | Real-time WebSocket | Free |
| **Global Fishing Watch** | Global | Presence 2012-now | Free (non-commercial) |
| **Simulated** | Indian Ocean | Generated tracks | N/A |

## Oil Spill Detection Datasets
| Dataset | Size | Classes | Access |
|---------|------|---------|--------|
| **CSIRO SAR** (Kaggle) | 68 MB | Binary | Instant download |
| **Deep-SAR SOS** (Kaggle) | 1.35 GB | Binary masks | Instant download |
| **Krestenitis/ITI** | 400 MB | 5-class semantic | Email request |
| **ROBORDER** | ~1 GB | 5-class | Request access |
| **DARTIS** | Medium | Object annotations | PANGAEA |

## Free APIs
| API | Purpose | Auth | Limits |
|-----|---------|------|--------|
| **Open-Meteo** | Wind, weather | None | ~10k/day |
| **Copernicus Marine** | Ocean currents | Free account | No quota |
| **CDS API (ERA5)** | Wind reanalysis | Free account | Queue |
| **Sentinel Hub** | Satellite imagery | Free account | Processing units |
| **AIS Stream** | Real-time AIS | Free key | 3 connections |
| **Global Fishing Watch** | Vessel presence | Free token | Non-commercial |
| **ERDDAP (NOAA)** | Ocean data | None | None |

## Cost Summary
Total cost for hackathon: **$0**
All data sources are free with registration.
