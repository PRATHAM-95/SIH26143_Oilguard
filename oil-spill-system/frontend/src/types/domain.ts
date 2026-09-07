export type ConnectionKind = 'api' | 'websocket' | 'mongo' | 'python'

export type ConnectionStateMessage = {
  kind: ConnectionKind
  status: 'online' | 'offline' | 'unknown'
}

export type InvestigationStepId =
  | 'detection'
  | 'characterization'
  | 'environment'
  | 'backtracking'
  | 'ais'
  | 'attribution'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

export type InvestigationStep = {
  id: InvestigationStepId
  status: StepStatus
  tool?: string
  detail?: string
}

export type IncidentState = {
  status: 'none' | 'active' | 'completed'
  observation: string | null
  location: { lon: number; lat: number } | null
  observationTime: string | null
  detectionConfidence: number | null
  slickAreaKm2: number | null
}

export type SarObservationStatus =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'unavailable'
  | 'failed'

export type SarProvenance =
  | 'REAL_SENTINEL1'
  | 'CACHED_SENTINEL1'
  | 'LOCAL_FIXTURE'
  | 'SYNTHETIC'
  | 'UNAVAILABLE'

export type SarCandidateClass = 'OIL_CANDIDATE' | 'UNCERTAIN' | 'LOOK_ALIKE' | 'REJECTED'

export type SarCandidateState = {
  id: string
  classification: SarCandidateClass
  confidence: number
  /** GeoJSON exterior ring of [lon, lat] pairs (deck.gl PolygonLayer input). */
  polygon: [number, number][]
  centroid: { lon: number; lat: number }
  areaKm2: number
  lengthKm: number | null
  widthKm: number | null
  aspectRatio: number | null
  /** Local dB contrast of the dark region against the measured sea reference. */
  contrastDb: number | null
  /** Mean incidence angle (deg) over the candidate (real GRD only). */
  incidenceDeg: number | null
  hints: string[]
  warnings: string[]
}

export type SarObservationState = {
  status: SarObservationStatus
  active: boolean
  observationId: string | null
  /** Scalar presence flag; not serialized to backend. */
  provenance: SarProvenance | null
  source: string | null
  providerDataset: string | null
  acquisitionTime: string | null
  satellites: string[]
  polarization: string | null
  sceneId: string | null
  /** Scene evidence footprint ring [lon, lat][] (observed evidence). */
  footprint: [number, number][] | null
  candidates: SarCandidateState[]
  confidence: number | null
  slickAreaKm2: number | null
  ageAvailable: boolean
  ageEstimate: string | null
  detector: string | null
  detectorVersion: string | null
  warnings: string[]
  errors: string[]
  busy: boolean
}

export type DataSourceStatus = 'awaiting' | 'demo' | 'available' | 'unavailable'

export type DataSourceState = {
  status: DataSourceStatus
  label: string
  note: string
}

export type EnvironmentState = {
  current: DataSourceState
  wind: DataSourceState
}

export type IntegratedVessel = {
  id: string
  name: string
  mmsi: string
  type: string
  position: { lon: number; lat: number }
  speed: number
  heading: number
}

export type SimulationStatus =
  | 'captain_mode'
  | 'simulating'
  | 'observation'
  | 'investigation'
  | 'completed'

export type DriftRunStatus = 'idle' | 'running' | 'completed' | 'failed'

export type DriftParticle = {
  lon: number
  lat: number
  massKg: number
}

export type DriftMassBalance = {
  evaporatedKg: number
  dispersedKg: number
  remainingKg: number
}

export type DriftRunState = {
  runId: string | null
  status: DriftRunStatus
  particles: DriftParticle[]
  /** GeoJSON Polygon exterior ring of [lon, lat] pairs, or null before a run. */
  extent: [number, number][] | null
  massBalance: DriftMassBalance | null
  environmentSource: string | null
  environmentDataset: string | null
  modelVersion: string | null
  oilType: string | null
  durationHours: number | null
  particleCount: number | null
  timestepSeconds: number | null
  error: string | null
}

export type SpillEventState = {
  spillEventId: string | null
  /** Detected slick (incident) created when the spill was released. */
  incidentId: string | null
  vesselId: string | null
  location: { lon: number; lat: number } | null
  time: string | null
  oilType: string | null
  quantityKg: number | null
  type: string | null
}

export type SimulationState = {
  simulationId: string | null
  status: SimulationStatus | null
  active: boolean
  clock: string | null
  selectedVesselId: string | null
  vessels: IntegratedVessel[]
  spill: SpillEventState | null
  drift: DriftRunState
  error: string | null
  busy: boolean
}

export type BacktrackingResultState = {
  runId: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  /** Estimated origin as {lon, lat}. */
  origin: { lon: number; lat: number } | null
  originTime: string | null
  uncertaintyKm: number | null
  confidence: number | null
  /** Multi-dimensional confidence (set from backend when available). */
  sourceConcentration: 'HIGH' | 'MEDIUM' | 'LOW' | null
  environmentalQuality: 'HIGH' | 'MEDIUM' | 'LOW' | null
  trajectoryAgreement: number | null
  ensembleStability: number | null
  /** Source region polygon exterior ring [lon, lat][]. */
  sourceRegion: [number, number][] | null
  /** Confidence contours [{level, polygon ring}]. */
  sourceContours: { level: number; polygon: [number, number][] }[] | null
  /** Source time window. */
  originTimeRange: { earliest: string; latest: string; preferred: string } | null
  /** Backtracking duration (hours). */
  durationHours: number | null
  ensembleSize: number | null
  particlesPerMember: number | null
  environmentSource: string | null
  /** Backward trajectories for map rendering. */
  trajectories: { member: number; endpoints: { lon: number; lat: number }[] }[] | null
  ensembleSummary: {
    member_count: number
    converged_count: number
    mean_endpoint_distance_km: number
    std_endpoint_distance_km: number
  } | null
  quality: {
    total_particles: number
    converged_particles: number
    land_hits: number
    domain_exits: number
    invalid_particles: number
    warnings: string[]
  } | null
  warnings: string[]
  errors: string[]
  busy: boolean
}

export type AttributionFactorKey =
  | 'spatial'
  | 'temporal'
  | 'trajectory'
  | 'anomaly'
  | 'environmental'

export type AttributionFactorEvidence = {
  note?: string
  weight?: number
  distance_km?: number
  position?: { lon: number; lat: number }
  signals?: string[]
  [key: string]: unknown
}

export type AttributionVesselEntry = {
  rank: number
  mmsi: string | null
  name: string | null
  vesselType: string | null
  score: number | null
  factors: Record<AttributionFactorKey, number> | null
  factorEvidence: Partial<Record<AttributionFactorKey, AttributionFactorEvidence>> | null
  dataQuality: {
    reliability: string | null
    notes: string[]
    messagesInWindow: number | null
    medianCadenceMin: number | null
    interpolationFraction: number | null
    coverageGaps: number | null
    anomalies: string[]
  } | null
  minDistanceKm: number | null
  timeOfClosestApproach: string | null
  /** Closest-approach position (lon/lat) used for the map marker, when reported. */
  closestPosition: { lon: number; lat: number } | null
}

export type AttributionRanking = {
  top_score: number
  second_score: number
  margin: number
  decisive: boolean
}

export type AttributionState = {
  runId: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  ranked: boolean
  vessels: AttributionVesselEntry[]
  conclusion: 'candidate' | 'inconclusive' | null
  ranking: AttributionRanking | null
  weightsUsed: Record<string, number> | null
  attributionModelVersion: string | null
  sourceState: string | null
  aisSource: string | null
  origin: { lon: number; lat: number } | null
  timeRange: { earliest: string; latest: string; preferred: string } | null
  releaseTime: string | null
  vesselCount: number | null
  kept: number | null
  dropped: number | null
  radiusKm: number | null
  maxGapMin: number | null
  aisQuery: {
    sourceState?: string
    provider?: string
    dataset?: string
    vesselCount?: number
    elapsedMs?: number
    warnings?: string[]
  } | null
  providers: Record<
    string,
    { status?: string; state?: string; note?: string; dataset?: string; seed?: number }
  > | null
  warnings: string[]
  errors: string[]
  busy: boolean
}

export type GroundTruthState = {
  locked: boolean
  revealed: boolean
  actualOrigin: { lon: number; lat: number } | null
}

export type ReportState = {
  generated: boolean
}

// ---------------------------------------------------------------------------
// STEP 11 — persistent investigation (state machine + evidence chain)
// ---------------------------------------------------------------------------

export type InvestigationStageId =
  | 'detection'
  | 'characterization'
  | 'environment'
  | 'forward_drift'
  | 'backtracking'
  | 'ais'
  | 'attribution'
  | 'conclusion'

export type InvestigationStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'unavailable'

export type InvestigationStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type InvestigationStageState = {
  stageId: InvestigationStageId
  status: InvestigationStageStatus
  attemptCount: number
  error: string | null
  stageStartedAt: string | null
  stageCompletedAt: string | null
  referenceId: string | null
  referenceType: string | null
  provenance: string | null
  sourceState: string | null
  modelVersion: string | null
  summary: Record<string, unknown> | null
  warnings: string[] | null
}

export type InvestigationParamsState = {
  sarSource: string
  sarDetector: string
  maxCandidates: number
  backtrackEnsembleSize: number
  backtrackParticlesPerMember: number
  backtrackDurationHours: number
  forwardDriftParticleCount: number
  forwardDriftDurationHours: number
  environmentSource: string
  aisSource: string
  radiusKm: number
  maxGapMin: number
  seed: number
}

export type InvestigationConclusionState = {
  status: string | null
  reason: string | null
  aggregation: string | null
  provenance: string | null
  topScore: number | null
  margin: number | null
  decisive: boolean | null
  candidate: Record<string, unknown> | null
  thresholdsUsed: { topScore: number; margin: number } | null
  why: string | null
  referenceAttributionRunId: string | null
  referenceBacktrackRunId: string | null
}

export type InvestigationEvidence = {
  id: string
  label: string
  at: string | null
  stageId: InvestigationStageId | null
  referenceType: string | null
  referenceId: string | null
  provenance: string | null
  payload: Record<string, unknown> | null
}

export type InvestigationRevealMetrics = {
  revealedAt: string | null
  positionError_km: number | null
  timeError_min: number | null
  attributionCorrect: boolean | null
  scoreMargin: number | null
  notes: { notes: string[] } | null
}

export type InvestigationState = {
  investigationId: string | null
  incidentId: string | null
  simulationId: string | null
  spillEventId: string | null
  status: InvestigationStatus | null
  progress: number
  stages: InvestigationStageState[]
  params: InvestigationParamsState | null
  conclusion: InvestigationConclusionState | null
  evidence: InvestigationEvidence[]
  provenance: { aggregation: string; perStage: Record<string, string> } | null
  errors: string[]
  warnings: string[]
  reveal: { revealed: boolean }
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
}

export type InvestigationSummaryState = {
  investigationId: string
  incidentId: string | null
  simulationId: string | null
  status: InvestigationStatus
  progress: number
  conclusionStatus: string | null
  createdAt: string | null
  updatedAt: string | null
}