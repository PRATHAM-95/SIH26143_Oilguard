# Architecture

## Core: Modular Monolith with Python Scientific Service

```
+--------------------------------------------------+
|              Frontend (React + TS)                 |
|   MapLibre GL + deck.gl + WebGL Particles         |
|   Investigation Dashboard + Captain Controller    |
+---------------------+----------------------------+
                      | REST + WebSocket/SSE
+---------------------+----------------------------+
|             Spring Boot Backend (Java)             |
|   API Gateway + Simulation Engine                  |
|   AIS Processing + Vessel Scoring + Events        |
+--------+---------------------+-------------------+
         |                     |
+--------+--------+   +-------+-----------+
| Python Service   |   |    MongoDB        |
| (FastAPI)        |   |  (GeoJSON docs)   |
|                  |   +-------------------+
| OpenDrift/OpenOil |
| SAR Detection     |
| Backtracking      |
| Environmental     |
+-------------------+
```

## Why This Architecture
1. **Spring Boot** handles business logic, API routing, WebSocket management, simulation state
2. **Python service** handles scientific computation (OpenDrift, ML inference, environmental data)
3. **MongoDB** stores GeoJSON natively, good for event-driven simulation state
4. **MapLibre + deck.gl** for high-performance maritime visualization

## Technology Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Modern, fast, type-safe |
| Map | MapLibre GL JS + deck.gl | Open source, WebGL, high performance |
| Wind/Current Viz | maplibre-gl-wind or custom WebGL | GPU particle animation |
| Backend | Spring Boot 3 + Java 21 | Team expertise, REST/WebSocket |
| Scientific | Python 3.11+ (FastAPI) | OpenDrift, ML, data processing |
| Database | MongoDB 7 | GeoJSON support, flexible schema |
| ML Runtime | ONNX Runtime | Fast inference, no GPU needed |
| Oil Model | OpenDrift + OpenOil | GPL-2.0, validated, backward mode |
| Container | Docker + Docker Compose | Consistent dev/demo environments |

## Performance Requirements
| Component | Target |
|-----------|--------|
| Map rendering | 60 fps (deck.gl + WebGL) |
| Particle animation | 50k particles |
| API response | <500ms |
| Backtracking | <10s (Python + OpenDrift) |
| ML inference | <2s (ONNX Runtime) |
| WebSocket latency | <100ms |

## Precomputation Strategy
| What | When | Acceptable? |
|------|------|-------------|
| Environmental data | Before demo | Yes — labeled "cached/replay" |
| Pre-trained ML model | Before demo | Yes — standard practice |
| Oil physics (forward) | During demo | Yes — runs in <5s |
| Backtracking | During demo | Yes — runs in <10s |
| AIS vessel tracks | Before demo | Yes — simulated for demo area |
| **Ground truth** | Never to investigation | Yes — hidden by design |
