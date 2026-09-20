# OilGuard Protected Contracts

Recorded during Milestone M0 Audit.
These contracts are **strictly protected** under MASTER_BRIEF §3.1. They must not be modified, broken, or duplicated across any rebuild milestone (M1–M9).

---

## 1. Protected Route Hierarchy

Existing routes must remain operational and preserve their functional responsibilities. Only new routes (specifically `/welcome`) may be added.

| Route | Name | Protected Responsibility |
|---|---|---|
| `/` | Command Center | Integrated operational maritime surface, map theater, operational bar, contextual console, selection inspector. |
| `/simulation` | Fleet Simulation | Captain-mode scenario controls, vessel list, manual vessel repositioning, spill release, forward drift initiation. |
| `/investigation` | SAR Investigation | 8-stage sequential pipeline execution, per-stage evidence cards, retry/cancel actions, ground-truth evaluation reveal. |
| `/backtracking` | Source Backtracking | Inverse Lagrangian ensemble drift modeling, source region polygon, confidence contours, origin time window. |
| `/attribution` | Vessel Attribution | Ranked candidate table, five-factor forensic score breakdown, AIS telemetry, closest approach metrics. |
| `/report` | Forensic Dossier | Document-style incident dossier, evidence timeline, method limitations, print-ready layout. |
| `/welcome` *(New in M6)* | Cinematic Welcome | Pinned 3D scroll narrative, hero ocean scene, exploded evidence preview, entry CTA to `/`. |

---

## 2. Protected Investigation Stages

The forensic investigation consists of exactly **8 sequential stages**. Their IDs and ordering must never be altered.

```
1. detection ────────► 2. characterization ──► 3. environment ────► 4. forward_drift
                                                                          │
8. conclusion ◄─────── 7. attribution ◄────── 6. ais ◄───────────── 5. backtracking
```

| Order | `stageId` | Display Label | Critical Stage | Produced Summary Evidence |
|:---:|---|---|:---:|---|
| 1 | `detection` | Detection | Yes | SAR candidate slicks, scene footprint, confidence score. |
| 2 | `characterization`| Characterization | No | Slick dimensions (length, width, area), aspect ratio, estimated volume/mass. |
| 3 | `environment` | Environment | No | Wind velocity/heading (ERA5), ocean current vectors (CMEMS). |
| 4 | `forward_drift` | Forward Drift | No | Trajectory particle cloud, slick extent expansion. |
| 5 | `backtracking` | Backtracking | Yes | Probable source region polygon, origin coordinates, uncertainty radius (km), time window. |
| 6 | `ais` | AIS Analysis | Yes | Candidate vessel trajectories filtered by spatial and temporal proximity to source window. |
| 7 | `attribution` | Attribution | Yes | Ranked vessel list with 5-factor scoring (spatial, temporal, trajectory, anomaly, environmental). |
| 8 | `conclusion` | Conclusion | No | Attributable candidate verdict or inconclusive determination, confidence margin. |

---

## 3. Protected Zustand Store Contracts

Presentation components must consume these stores directly. Never duplicate store state inside components. Derived views must use read-only selector hooks in `src/ui/hooks/`.

### 3.1 `useSimulationStore`
- **State Fields:**
  - `simulationId: string | null`
  - `status: SimulationStatus | null` (`'captain_mode' | 'simulating' | 'observation' | 'investigation' | 'completed'`)
  - `active: boolean`
  - `clock: string | null` (ISO UTC timestamp)
  - `selectedVesselId: string | null`
  - `vessels: IntegratedVessel[]`
  - `trails: Record<string, TrailPoint[]>` (where `TrailPoint = { lon: number; lat: number; t: string }`)
  - `spill: SpillEventState | null` (`{ spillEventId, incidentId, vesselId, location, time, oilType, quantityKg, type }`)
  - `drift: DriftRunState` (`{ runId, status, particles, extent, massBalance, environmentSource, ... }`)
  - `error: string | null`
  - `busy: boolean`
- **Methods:**
  - `recordTrail(vesselId: string, point: TrailPoint): void`
  - `createSimulation(region?: Region): Promise<void>`
  - `start(): Promise<void>`
  - `advance(hours: number): Promise<void>`
  - `releaseSpill(): Promise<void>`
  - `runForwardDrift(): Promise<void>`
  - `moveSelectedVessel(payload: { latitude: number; longitude: number; speed: number; heading: number }): Promise<void>`
  - `selectVessel(id: string): void`
  - `setVessels(vessels: IntegratedVessel[]): void`
  - `refreshState(): Promise<void>`
  - `reset(): void`
  - `applyWsEvent(event: SimulationWsEvent): void`

### 3.2 `useInvestigationStore`
- **State Fields:**
  - `investigationId: string | null`
  - `incidentId: string | null`
  - `simulationId: string | null`
  - `spillEventId: string | null`
  - `status: InvestigationStatus | null` (`'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'`)
  - `progress: number` (0 to 100)
  - `stages: InvestigationStageState[]` (all 8 stages with `status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'unavailable'`)
  - `params: InvestigationParamsState | null`
  - `conclusion: InvestigationConclusionState | null`
  - `evidence: InvestigationEvidence[]`
  - `provenance: { aggregation: string; perStage: Record<string, string> } | null`
  - `errors: string[]`
  - `warnings: string[]`
  - `reveal: { revealed: boolean }`
  - `createdAt: string | null`, `startedAt: string | null`, `completedAt: string | null`, `updatedAt: string | null`
  - `focusedStageId: InvestigationStageId | null`
  - `busy: boolean`
  - `actionError: string | null`
  - `lastReveal: InvestigationRevealMetrics | null`
- **Methods:**
  - `setFocusedStageId(stageId: InvestigationStageId | null): void`
  - `start(incidentId: string): Promise<void>`
  - `load(id: string): Promise<void>`
  - `loadForSimulation(simulationId: string): Promise<void>`
  - `retry(stageId?: InvestigationStageId): Promise<void>`
  - `cancel(): Promise<void>`
  - `revealGroundTruth(): Promise<void>`
  - `reset(): void`
  - `applyWsEvent(event: InvestigationWsEvent): void`

### 3.3 `useBacktrackingStore`
- **State Fields:**
  - `runId: string | null`
  - `status: 'idle' | 'running' | 'completed' | 'failed'`
  - `origin: { lon: number; lat: number } | null`
  - `originTime: string | null`
  - `uncertaintyKm: number | null`
  - `confidence: number | null`
  - `sourceConcentration: 'HIGH' | 'MEDIUM' | 'LOW' | null`
  - `environmentalQuality: 'HIGH' | 'MEDIUM' | 'LOW' | null`
  - `trajectoryAgreement: number | null`
  - `ensembleStability: number | null`
  - `sourceRegion: [number, number][] | null` (Exterior polygon ring)
  - `sourceContours: { level: number; polygon: [number, number][] }[] | null`
  - `originTimeRange: { earliest: string; latest: string; preferred: string } | null`
  - `durationHours: number | null`
  - `ensembleSize: number | null`
  - `particlesPerMember: number | null`
  - `environmentSource: string | null`
  - `trajectories: { member: number; endpoints: { lon: number; lat: number }[] }[] | null`
  - `ensembleSummary: { member_count: number; converged_count: number; mean_endpoint_distance_km: number; std_endpoint_distance_km: number } | null`
  - `quality: { total_particles: number; converged_particles: number; land_hits: number; domain_exits: number; invalid_particles: number; warnings: string[] } | null`
  - `warnings: string[]`, `errors: string[]`, `busy: boolean`
- **Methods:**
  - `run(simulationId: string, opts?: { durationHours?: number; ensembleSize?: number; particlesPerMember?: number; environmentSource?: string; seed?: number }): Promise<void>`
  - `loadRuns(simulationId: string): Promise<void>`
  - `clear(): void`
  - `setResult(patch: Partial<BacktrackingResultState>): void`
  - `applyWsEvent(event: BacktrackWsEvent): void`

### 3.4 `useAttributionStore`
- **State Fields:**
  - `runId: string | null`
  - `status: 'idle' | 'running' | 'completed' | 'failed'`
  - `ranked: boolean`
  - `vessels: AttributionVesselEntry[]` (each vessel has `rank`, `mmsi`, `name`, `vesselType`, `score`, `factors: Record<AttributionFactorKey, number>`, `factorEvidence`, `dataQuality`, `minDistanceKm`, `timeOfClosestApproach`, `closestPosition`)
  - `conclusion: 'candidate' | 'inconclusive' | null`
  - `ranking: AttributionRanking | null` (`{ top_score, second_score, margin, decisive }`)
  - `weightsUsed: Record<string, number> | null`
  - `attributionModelVersion: string | null`
  - `aisSource: string | null`
  - `origin: { lon: number; lat: number } | null`
  - `timeRange: { earliest: string; latest: string; preferred: string } | null`
  - `vesselCount: number | null`, `kept: number | null`, `dropped: number | null`
  - `radiusKm: number | null`, `maxGapMin: number | null`
  - `providers: Record<string, { status?: string; state?: string; note?: string; dataset?: string; seed?: number }> | null`
  - `warnings: string[]`, `errors: string[]`, `busy: boolean`
- **Methods:**
  - `run(simulationId: string, opts?: { backtrackRunId?: string; aisSource?: string; radiusKm?: number; maxGapMin?: number; seed?: number; environmentSource?: string }): Promise<void>`
  - `loadRuns(simulationId: string): Promise<void>`
  - `loadProviders(): Promise<void>`
  - `clear(): void`
  - `applyWsEvent(event: AttributionWsEvent): void`

### 3.5 `useMapStore`
- **State Fields:**
  - `view: MapViewState` (`{ longitude, latitude, zoom, pitch, bearing }`)
  - `visibility: Record<MapLayerId, boolean>`
  - `ready: boolean`
  - `selection: MapSelection | null` (`{ kind, id, rank, mmsi, name }`)
  - `cursor: { lon: number; lat: number } | null`
  - `fitBounds: Bounds | null`
- **Methods:**
  - `setView(view: Partial<MapViewState>): void`
  - `toggleLayer(id: MapLayerId): void`
  - `setLayer(id: MapLayerId, visible: boolean): void`
  - `setReady(ready: boolean): void`
  - `select(selection: MapSelection | null): void`
  - `clearSelection(): void`
  - `setCursor(cursor: { lon: number; lat: number } | null): void`
  - `requestFit(bounds: Bounds): void`
  - `clearFit(): void`

### 3.6 Supporting Stores
- `useConnectionStore`: `connections` (`api`, `websocket`, `mongo`, `python`), `lastApiCheck`, `setConnection()`, `markApiChecked()`, `reset()`.
- `useEnvironmentStore`: `current`, `wind` (`DataSourceState`), `setCurrentStatus()`, `setWindStatus()`.
- `useIncidentStore`: `status`, `observation`, `location`, `observationTime`, `detectionConfidence`, `slickAreaKm2`, `setActive()`, `complete()`, `reset()`.
- `useSarStore`: `status`, `active`, `observationId`, `provenance`, `candidates`, `footprint`, `detect()`, `loadObservation()`, `reset()`, `applyWsEvent()`.
- `useGroundTruthStore`: `locked`, `revealed`, `actualOrigin`, `reveal()`.
- `useReportStore`: `generated`, `markGenerated()`.

---

## 4. Protected Map Layers & Layer IDs

### 4.1 Logical Catalogue Layer IDs (`MapLayerId`)
The 13 logical layer IDs in `MAP_LAYER_CATALOG` must not be renamed or removed:
1. `satellite`
2. `slick`
3. `vessels`
4. `vesselTrails`
5. `wind`
6. `currents`
7. `backtracking`
8. `sourceProbability`
9. `uncertainty`
10. `attribution`
11. `sarSlicks`
12. `sarFootprint`
13. `drift`

### 4.2 Deck.gl Physical Layer IDs
Existing Deck.gl layer IDs must remain stable for layer management and selection:
- `simulation-vessel-trails`
- `simulation-vessels`
- `simulation-vessel-headings`
- `simulation-vessel-labels`
- `simulation-spill`
- `simulation-spill-ring`
- `simulation-spill-label`
- `drift-particles`
- `drift-extent`
- `inv-source-region`
- `inv-origin`
- `inv-origin-label`
- `inv-candidate-vectors`
- `inv-candidate-vessels`
- `inv-candidate-labels`
- `bt-trajectories`
- `bt-contour-${level}`
- `bt-source-region`
- `bt-origin`
- `bt-origin-label`
- `att-search-radius`
- `att-link-${rank}`
- `att-vessel-${rank}`
- `att-rank-label-${rank}`
- `att-origin`
- `att-origin-label`
- `sar-cand-poly-${id}`
- `sar-cand-centroid-${id}`
- `sar-cand-label-${id}`
- `sar-scene-footprint`
- `selection-ring`
- `selection-pip`

> **Rule for new layers:** Any additional layers introduced during the rebuild must be prefixed with `ui-` (e.g. `ui-graticule-frame`, `ui-vessel-silhouettes`).

---

## 5. Protected WebSocket Topics & Events

### 5.1 Topic Paths
- Simulation Channel: `/ws/simulation/{simulationId}`
- Investigation Channel: `/ws/investigation/{investigationId}`

### 5.2 Event Types
- **Simulation:** `clock_update`, `vessel_moved`, `spill_released`, `oil_particles`, `forward_drift.started`, `forward_drift.completed`, `forward_drift.failed`
- **Investigation Lifecycle:** `investigation_started`, `step_complete`, `origin_estimated`, `vessels_ranked`, `investigation_complete`, `investigation_failed`, `investigation_cancelled`, `groundtruth.revealed`
- **Observations & Analysis:** `sar_observation.started`, `sar_observation.completed`, `sar_observation.failed`, `backtracking.started`, `backtracking.completed`, `backtracking.failed`, `ais_search.started`, `ais_search.completed`, `ais_search.failed`, `vessels_filtered`, `attribution.started`, `vessel_scores_ready`, `attribution.completed`

---

## 6. Protected REST API Endpoints

All calls are routed through `/api/*` via Spring Boot:
- `healthApi`: `GET /health`, `GET /health/python-ping`
- `simulationApi`: `POST /simulation`, `POST /simulation/{id}/start`, `POST /simulation/{id}/advance`, `POST /simulation/{id}/spill`, `POST /simulation/{id}/forward-drift`, `GET /simulation/{id}`
- `vesselApi`: `GET /simulation/{id}/vessels`, `PUT /simulation/{id}/vessels/{vesselId}`, `GET /simulation/{id}/vessels/{vesselId}`
- `investigationApi`: `POST /investigation/start`, `GET /investigation/{id}`, `GET /investigation`, `POST /investigation/{id}/retry`, `POST /investigation/{id}/cancel`, `POST /investigation/{id}/reveal`
- `sarApi`: `POST /simulation/{id}/sar/detect`, `GET /simulation/{id}/sar`
- `backtrackApi`: `POST /simulation/{id}/backtrack`, `GET /simulation/{id}/backtrack`
- `attributionApi`: `POST /simulation/{id}/attribution`, `GET /simulation/{id}/attribution`, `GET /simulation/{id}/attribution/providers`
- `environmentApi`: `GET /simulation/{id}/environment`
- `incidentApi`: `GET /incident`
