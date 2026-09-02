# API Design

## Spring Boot REST API

### Simulation
```
POST   /api/simulation
  Body: { "region": {...}, "vessels": [...], "oilType": "GENERIC CRUDE" }
  Response: { "simulationId": "abc123", "status": "captain_mode" }

POST   /api/simulation/{id}/advance
  Body: { "hours": 6 }
  Response: { "clock": "...", "oilParticles": [...] }

GET    /api/simulation/{id}/state
  Response: { "status", "clock", "vessels", "oilSpill", "environment" }
```

### Vessels
```
POST   /api/simulation/{id}/vessels/{vesselId}/move
  Body: { "latitude": 10.45, "longitude": 72.4, "speed": 12, "heading": 45 }
  Response: { "position": {...}, "timestamp": "..." }

POST   /api/simulation/{id}/vessels/{vesselId}/spill
  Body: { "type": "accidental" | "illegal", "oilType": "GENERIC CRUDE", "quantityKg": 5000 }
  Response: { "incidentId": "...", "spillLocation": {...} }
```

### Environment
```
GET    /api/environment/current
  Query: bbox=50,-10,100,25&time=2025-01-15T14:00:00Z
  Response: { "source": "CMEMS", "fields": [{ "lat", "lon", "u", "v" }] }

GET    /api/environment/wind
  Query: bbox=...&time=...
  Response: { "source": "ERA5", "fields": [{ "lat", "lon", "u", "v" }] }
```

### Incidents
```
GET    /api/incidents/{id}
  Response: { "slick": { "geometry", "area", "centroid" }, "environment": {...} }

POST   /api/incidents/{id}/load
  Body: { "satellite": "Sentinel-1", "time": "2025-01-15T14:30:00Z" }
  Response: { "incidentId": "...", "detection": {...} }
```

### Investigation
```
POST   /api/investigation/{incidentId}/start
  Response: { "investigationId": "...", "status": "running" }

GET    /api/investigation/{id}/status
  Response: { "steps": [...], "progress": 0.6 }

GET    /api/investigation/{id}/prediction
  Response: { "origin", "originUncertainty_km", "spillTime", "confidence" }

GET    /api/investigation/{id}/vessels
  Response: { "candidates": [{ "vesselId", "score", "factors": {...} }] }

POST   /api/investigation/{id}/reveal
  Response: { "actualOrigin", "positionError_km", "timeError_min", "maxScoreError" }
```

## Python Scientific Service API

### Detection
```
POST   /detect
  Body: { "imageBase64": "...", "region": { "lat", "lon" } }
  Response: { "mask": [...], "area_km2", "centroid": {...}, "geometry": {...} }
```

### Backtracking
```
POST   /backtrack
  Body: { "origin", "time", "duration_hours", "env": { "currents", "wind" }, "ensemble": 50 }
  Response: { "originEstimate": {...}, "uncertainty_km": 3.4, "timeEstimate": "...", "confidence": 0.87 }
```

### Forward Drift
```
POST   /forward-drift
  Body: { "origin", "time", "duration_hours", "env": { "currents", "wind" }, "oilType": "GENERIC CRUDE" }
  Response: { "particles": [...], "extent": { "geometry" }, "massBalance": {...} }
```

### Environment
```
POST   /environment
  Body: { "bbox", "time", "variables": ["currents", "wind"] }
  Response: { "currents": {...}, "wind": {...}, "source": "CMEMS/ERA5" }
```

## WebSocket Events (to Frontend)

### /ws/simulation/{id}
```json
{ "type": "clock_update", "time": "2025-01-15T15:30:00Z" }
{ "type": "vessel_moved", "vesselId": "abc", "position": {...} }
{ "type": "spill_released", "location": {...}, "particles": [...] }
{ "type": "oil_particles", "particles": [{ "lat", "lon", "radius", "opacity" }] }
```

### /ws/investigation/{id}
```json
{ "type": "step_complete", "step": "backtracking", "progress": 1.0 }
{ "type": "origin_estimated", "origin": {...}, "uncertainty_km": 3.4, "confidence": 0.87 }
{ "type": "vessels_ranked", "candidates": [{ "vesselId", "score", "rank" }] }
{ "type": "investigation_complete", "summary": {...} }
```
