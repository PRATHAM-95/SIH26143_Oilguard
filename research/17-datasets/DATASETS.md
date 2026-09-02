# Datasets

## SAR Oil Spill Detection (ML Training)

| Dataset | Size | Classes | Access |
|---------|------|---------|--------|
| **CSIRO SAR** (Kaggle) | 68 MB | Binary | Instant download |
| **Deep-SAR SOS** (Kaggle) | 1.35 GB | Binary masks | Instant download |
| **Krestenitis/ITI** | 400 MB | 5-class semantic | Email request |
| **ROBORDER** | ~1 GB | 5-class | Request access |
| **DARTIS** | Medium | Object annotations | PANGAEA |
| **Sentinel-1 SAR** (Kaggle) | ~10 GB | Binary | Instant download |
| **MODIS OIL** (Kaggle) | ~500 MB | Binary | Instant download |
| **Sentinel-2 Oil Spill** (Kaggle) | ~2 GB | Binary | Instant download |
| **Gulf of Mexico** (Kaggle) | ~1 GB | Binary | Instant download |
| **Synthetic SAR** (Kaggle) | ~200 MB | Binary | Instant download |
| **Oil Spill Detection** (Kaggle) | ~300 MB | Binary | Instant download |

## Ocean/Environmental Data

| Dataset | Source | Coverage | Resolution | Access |
|---------|--------|----------|-----------|--------|
| **CMEMS GLORYS12V1** | Copernicus | Global | 1/12 deg | CMEMS |
| **ERA5** | ECMWF | Global 1940+ | 0.25 deg | CDS API |
| **OSCAR** | NOAA | Global | 0.25 deg | ERDDAP |
| **HYCOM** | US Navy | Global | 1/12 deg | THREDDS |
| **GEBCO** | GEBCO | Global | 15 arc-sec | Free download |
| **MUR SST** | NASA/JPL | Global | 0.01 deg | ERDDAP |

## AIS Data

| Dataset | Coverage | Time Period | Access |
|---------|----------|------------|--------|
| **NOAA Marine Cadastre** | US waters | 2009-present | CSV/GeoParquet |
| **Global Fishing Watch** | Global | 2012-present | Free token (non-commercial) |
| **AIS Stream** | Global | Real-time | WebSocket API |
| **NOAA AIS** | Global | 2009-present | ERDDAP |

## Pre-trained Models

| Model | Source | Dataset | Classes | Access |
|-------|--------|---------|---------|--------|
| **SegFormer-B2** | ROBORDER | 5-class | 5 | GitHub |
| **U-Net** | ROBORDER | 5-class | 5 | GitHub |
| **DeepLabV3+** | Krestenitis | 5-class | 5 | GitHub |
| **mados** | gkakogeorgiou | 15-class | 15 | GitHub |
| **oil-spill-detection** | m7mdehab | Binary | 2 | GitHub |

## Key References
| Paper | Dataset | Notes |
|-------|---------|-------|
| Krestenitis et al. (2019) | 400 MB optical | Sent-2, 5 classes |
| Dagestad et al. (2018) | OpenDrift validation | Oil spill drift |
| Breivik et al. (2012) | North Sea oil | BAKTRACK |
| Li et al. (2023) | MODIS oil | CNN-based detection |
