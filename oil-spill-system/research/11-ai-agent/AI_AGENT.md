# AI/Agent Strategy

## Architecture: Deterministic Tool-Calling Agent

**NOT** an LLM-hallucinating agent. A deterministic pipeline orchestrator.

```
Investigation Agent
    │
    ├── get_satellite_observation(region, time)
    │   └── Returns: SAR image, detection mask, geometry
    │
    ├── get_ocean_currents(region, time)
    │   └── Returns: u/v fields from Copernicus Marine
    │
    ├── get_wind_field(region, time)
    │   └── Returns: u/v wind from ERA5/Open-Meteo
    │
    ├── characterize_slick(detection_mask)
    │   └── Returns: area, perimeter, centroid, orientation
    │
    ├── run_backtracking(slick_geometry, currents, wind, duration)
    │   └── Returns: origin probability surface, candidate points
    │
    ├── run_forward_drift(origin, currents, wind, duration)
    │   └── Returns: predicted slick extent
    │
    ├── query_ais(region, time_window)
    │   └── Returns: vessel tracks in area/time
    │
    ├── filter_vessels(tracks, origin_estimation)
    │   └── Returns: filtered candidates
    │
    ├── score_vessels(candidates, origin_estimation, backtracking)
    │   └── Returns: ranked suspects with scores
    │
    └── calculate_uncertainty(ensemble_results)
        └── Returns: confidence, error radius, time uncertainty
```

## Investigation Log (Explainability)
```json
{
  "steps": [
    {"status": "complete", "action": "Satellite observation acquired", "detail": "Sentinel-1 SAR, VV pol, 2025-01-15 14:30 UTC"},
    {"status": "complete", "action": "Slick geometry extracted", "detail": "Area: 2.3 km2, Centroid: 10.42N, 72.31E"},
    {"status": "complete", "action": "Ocean-current field loaded", "detail": "CMEMS GLORYS12V1, 1/12 deg resolution"},
    {"status": "complete", "action": "Wind field loaded", "detail": "ERA5, 0.25 deg, 10m u/v components"},
    {"status": "complete", "action": "50,000 particles initialized", "detail": "Ensemble: 50 perturbations x 1000 particles"},
    {"status": "complete", "action": "Backtracking completed", "detail": "6h reverse, origin probability surface generated"},
    {"status": "complete", "action": "Origin estimation calculated", "detail": "10.38N, 72.28E +/- 3.4 km"},
    {"status": "complete", "action": "AIS candidates identified", "detail": "7 vessels in origin window (48h, 50km radius)"},
    {"status": "complete", "action": "Candidates scored and ranked", "detail": "Top candidate: MV Pacific Star (score: 0.87)"}
  ]
}
```

## What the Agent Should NOT Do
- Do NOT use an LLM to "analyze" the slick
- Do NOT generate text from AI models for scientific conclusions
- Do NOT "predict" using language models
- Every tool produces **deterministic, reproducible results**

## What the Agent SHOULD Do
- Call well-defined scientific tools
- Log every step with timestamps
- Report confidence intervals
- Show evidence for every conclusion
- Explain which data sources were used
- State assumptions explicitly

## Frontend Agent Visualization
- Animated step-by-step progress
- Each step shows: action name, status indicator, detail text
- Progress bar showing overall investigation progress
- Ability to expand any step for more detail
- Final summary card with all findings
