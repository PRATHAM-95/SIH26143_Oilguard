# AIS Strategy

## For Demo: Simulated Indian Ocean AIS Tracks — RECOMMENDED

**Why:** NOAA Marine Cadastre is US-only. Real Indian Ocean AIS historical data is not freely available in bulk.

### Approach
1. Define shipping lanes (Arabian Sea, Bay of Bengal, major ports)
2. Generate vessel movements with realistic:
   - Speeds (10-25 knots depending on vessel type)
   - Course changes (route waypoints)
   - AIS message timing (2-10 second intervals)
3. Include "irregular" behaviors:
   - Speed drops (potential discharge events)
   - Course deviations
   - Loitering near spill area

## For Real Pipeline: Multiple Sources

| Source | Coverage | Type | Cost |
|--------|----------|------|------|
| **AIS Stream** | Global | Real-time WebSocket | Free |
| **Global Fishing Watch** | Global | Presence 2012-now | Free (non-commercial) |
| **Marine Cadastre** | US | Historical CSV | Free |
| **NOAA ERDDAP** | Global | Buoy currents | Free |

## AIS Data Fields Needed
```json
{
  "mmsi": "IMO number",
  "timestamp": "2025-01-15T14:30:00Z",
  "latitude": 10.42,
  "longitude": 72.31,
  "speed_over_ground": 12.5,
  "course_over_ground": 45.0,
  "heading": 43.0,
  "vessel_name": "MV Example",
  "vessel_type": "Cargo",
  "length": 200,
  "draft": 8.5
}
```

## AIS Anomaly Detection Methods
| Method | What It Detects | Algorithm |
|--------|-----------------|-----------|
| **Speed drop** | Potential discharge during slow steaming | Speed threshold |
| **Heading deviation** | Unusual course change near spill | Heading variance |
| **Loitering** | Staying in area too long | Time in zone |
| **Gap detection** | Transponder turned off | Missing messages |

## Vessel Attribution Scoring
```python
def score_vessel(vessel, origin_estimation, backtracking_result):
    # 1. Spatial proximity to estimated origin
    dist_score = 1.0 / (1.0 + haversine(vessel.position, origin_estimation))
    
    # 2. Temporal compatibility
    time_score = temporal_overlap(vessel.track, origin_estimation.time)
    
    # 3. Trajectory compatibility with backtracking
    traj_score = trajectory_match(vessel.track, backtracking_result)
    
    # 4. Behavioral anomaly
    anomaly_score = detect_anomaly(vessel.speed, vessel.heading)
    
    # 5. Environmental consistency
    env_score = wind_current_consistency(vessel, origin_estimation)
    
    # Weighted composite
    score = (0.25 * dist_score + 
             0.20 * time_score + 
             0.25 * traj_score + 
             0.15 * anomaly_score + 
             0.15 * env_score)
    
    return score
```

## AIS Processing Library
- **pyais** (Python): `pip install pyais` — NMEA decoding
- **GPSD/AIVDM docs:** Reference for message format
- **lib-nmea-0183** (Java): For Spring Boot integration

## NOAA Marine Cadastre (US Waters Only)
- **URL:** https://marinecadastre.gov/accessais/
- **Data:** 2009-present, CSV/GeoParquet
- **Fields:** MMSI, IMO, lat, lon, speed, course, heading, vessel type
- **License:** Public domain
- **Hackathon use:** YES — fully permitted
- **Limitation:** US coastal waters only — NOT Indian Ocean
