# Satellite Strategy

## Primary: Sentinel-1 SAR (VERIFIED)

### Specifications
- **Mode:** IW (Interferometric Wide) — 250km swath, ~10m resolution
- **Polarization:** VV (best for oil — higher sea backscatter contrast)
- **Revisit:** 12 days (S1A alone, since S1B decommissioned); 6 days with S1C
- **Coverage:** Full Indian Ocean, global
- **Data access:** Copernicus Data Space Ecosystem (CDSE) — free registration
- **API:** OData, STAC, Sentinel Hub, openEO, S3 direct
- **Python:** `pip install cdse` or `sentinelsat` (legacy)

### Why SAR for Oil Detection
1. **All-weather, day/night** — penetrates clouds (unlike optical)
2. **Physical mechanism:** Oil damps capillary waves → reduced backscatter → dark patches
3. **Optimal wind:** 2-10 m/s (below = no Bragg waves, above = oil breaks up)
4. **Contrast:** 6-17 dB between slick and clean sea at C-band

### SAR Detection Pipeline
```
Sentinel-1 GRD
  → Radiometric Calibration
  → Thermal/Border Noise Removal
  → Conversion to dB
  → Land Masking
  → Adaptive Thresholding
  → Dark Feature Extraction
  → Feature Analysis
  → Oil/Look-alike Classification
```

### Pre-trained Model (Recommended)
Use SegFormer/U-Net trained on ROBORDER/DARTIS datasets:
- **5 classes:** Sea surface, Oil spill, Look-alike, Ship, Land
- **Best model:** SegFormer-B2 (Oil IoU ~0.55, F1 ~0.80)
- **Inference:** ONNX Runtime, no GPU needed

### Important Limitations
- **Look-alikes:** Low wind, biogenic slicks, rain cells create false positives
- **Thin sheens:** May not appear in SAR
- **Wind >10-14 m/s:** Oil film breaks up, detection fails
- **No thickness info:** SAR detects presence, not volume

## Other Satellites
| Satellite | Resolution | Revisit | Free? | Oil Suitability |
|-----------|-----------|---------|-------|-----------------|
| Sentinel-2 | 10m optical | 5 days | Yes | Cloud-limited |
| Sentinel-3 | 300m OLCI | 2-4 days | Yes | Coarse, cloud-limited |
| Landsat 8/9 | 30m optical | 8 days | Yes | Cloud-limited |
| MODIS | 250m | 1-2 days | Yes | Coarse, sun glint needed |
| RISAT | 3-25m SAR | ~14 days | Restricted | Good but not open |
| Oceansat | 360m optical | near-daily | Research | Indian Ocean focus |
| ALOS-2 | 3-10m L-band | 14 days | Science approval | Good discrimination |

**Recommendation:** Sentinel-1 SAR as primary, Sentinel-2 for optical cross-validation when cloud-free.
