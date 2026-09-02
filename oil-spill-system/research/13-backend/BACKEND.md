# Backend Architecture

## Spring Boot Application

### Controllers
```
SimulationController
    POST /simulation/start
    POST /simulation/{id}/advance
    GET  /simulation/{id}/state

VesselController
    GET  /vessels
    POST /vessels/{id}/move
    POST /vessels/{id}/spill

EnvironmentController
    GET  /environment/current?bbox=&time=
    GET  /environment/wind?bbox=&time=
    GET  /environment/waves?bbox=&time=

IncidentController
    GET  /incidents/{id}/slick
    GET  /incidents/{id}/environment

InvestigationController
    POST /investigation/{id}/start
    GET  /investigation/{id}/status
    GET  /investigation/{id}/prediction
    GET  /investigation/{id}/vessels
    POST /investigation/{id}/reveal

WebSocket Handler
    /ws/simulation/{id}
    /ws/investigation/{id}
```

## Python Scientific Service (FastAPI)

### Endpoints
```
POST /detect
    Input: SAR image/patch
    Output: detection mask + geometry

POST /backtrack
    Input: slick geometry, currents, wind, duration
    Output: origin probability surface

POST /forward-drift
    Input: origin, currents, wind, duration
    Output: predicted slick extent

POST /environment
    Input: region, time
    Output: currents, wind, waves

POST /score-vessels
    Input: candidates, origin, drift
    Output: ranked scores
```

## WebSocket Events
```json
// /ws/simulation/{id}
{ "type": "clock_update", "time": "2025-01-15T14:30:00Z" }
{ "type": "vessel_moved", "vessel": {...} }
{ "type": "spill_detected", "location": {...} }
{ "type": "oil_particles", "particles": [...] }

// /ws/investigation/{id}
{ "type": "step_complete", "step": "backtracking", "progress": 1.0 }
{ "type": "origin_estimated", "origin": {...}, "confidence": 0.87 }
{ "type": "vessel_ranked", "vessels": [...] }
```

## Inter-Service Communication
- Spring Boot -> Python: HTTP REST (internal network)
- Spring Boot -> MongoDB: Spring Data MongoDB
- Frontend -> Spring Boot: REST + WebSocket
- Python -> OpenDrift: Direct Python import
- Python -> Copernicus/ERA5: HTTP API calls

## Docker Setup
```yaml
services:
  backend:
    build: ./backend
    ports: ["8080:8080"]
  python-service:
    build: ./python-service
    ports: ["8000:8000"]
  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
```
