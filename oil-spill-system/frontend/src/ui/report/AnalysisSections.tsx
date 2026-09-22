import { useSimulationStore } from '@/store/simulationStore'
import { useBacktrackingStore } from '@/store/featureStores'
import {
  ReportSection,
  ReportMetric,
  ReportMetricGrid,
  ReportEmpty,
  ReportFigure,
  ReportProvenance,
  ReportNarrative,
} from './primitives'

/**
 * 06 — FORWARD DRIFT
 * Forward trajectory simulation results.
 */
export function ForwardDriftSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const drift = useSimulationStore((s) => s.drift)
  const spill = useSimulationStore((s) => s.spill)

  const fdData = reportData?.['6_forward_drift'] as Record<string, unknown> | undefined
  const fdSummary = fdData?.summary ? String(fdData.summary) : null

  if (drift.status === 'idle' && !drift.runId) {
    return (
      <ReportSection id="forward-drift" number="06" title="Forward Drift Simulation">
        <ReportEmpty
          label="No forward drift data"
          hint="Forward drift simulation has not been executed."
        />
      </ReportSection>
    )
  }

  const mb = drift.massBalance

  return (
    <ReportSection id="forward-drift" number="06" title="Forward Drift Simulation">
      {fdSummary && (
        <ReportNarrative>
          <p>{fdSummary}</p>
        </ReportNarrative>
      )}

      <ReportMetricGrid columns={3}>
        <ReportMetric label="Status" value={drift.status} />
        <ReportMetric label="Duration" value={drift.durationHours} unit="hours" mono />
        <ReportMetric label="Particles" value={drift.particleCount} mono />
        <ReportMetric label="Oil type" value={drift.oilType ?? spill?.oilType} />
        <ReportMetric label="Model version" value={drift.modelVersion} mono />
        <ReportMetric label="Timestep" value={drift.timestepSeconds} unit="s" mono />
      </ReportMetricGrid>

      {/* Analytical Figure: Trajectory and particle dispersion */}
      {(spill?.location || drift.particles.length > 0) && (
        <ReportFigure
          title="Forward Drift Trajectory & Dispersion"
          description="Modelled particle trajectory and dispersion cloud from release site under environmental forcing."
          provenance={drift.environmentSource ?? 'Model forcing'}
          timeRef={drift.durationHours ? `${drift.durationHours}h forward advection` : undefined}
        >
          <DriftTrajectoryPlate
            spillLocation={spill?.location ?? null}
            particles={drift.particles}
            durationHours={drift.durationHours}
          />
        </ReportFigure>
      )}

      {mb && (
        <>
          <h3 className="report-subsection-title">Mass Balance</h3>
          <ReportMetricGrid columns={3}>
            <ReportMetric label="Remaining" value={mb.remainingKg.toFixed(1)} unit="kg" mono />
            <ReportMetric label="Evaporated" value={mb.evaporatedKg.toFixed(1)} unit="kg" mono />
            <ReportMetric label="Dispersed" value={mb.dispersedKg.toFixed(1)} unit="kg" mono />
          </ReportMetricGrid>

          {/* Static analytical figure for print — mass balance proportions */}
          <ReportFigure
            title="Mass Balance Distribution"
            description="Partitioning of released oil mass across physical fate processes at simulation end state."
            provenance={drift.environmentSource ?? 'Unknown'}
            timeRef={drift.durationHours ? `${drift.durationHours}h simulation` : undefined}
          >
            <MassBalanceBar
              remaining={mb.remainingKg}
              evaporated={mb.evaporatedKg}
              dispersed={mb.dispersedKg}
            />
          </ReportFigure>
        </>
      )}

      <div className="report-env-source">
        <span className="report-env-source__label">Environment source</span>
        <span className="report-env-source__note">
          <ReportProvenance value={drift.environmentSource} />
        </span>
      </div>
    </ReportSection>
  )
}

/**
 * Static SVG analytical plate showing forward drift particle dispersion,
 * net drift vector, and release point.
 */
function DriftTrajectoryPlate({
  spillLocation,
  particles,
  durationHours,
}: {
  spillLocation: { lon: number; lat: number } | null
  particles: { lon: number; lat: number; massKg?: number }[]
  durationHours: number | null
}) {
  if (!spillLocation && particles.length === 0) return null

  const allLons = [
    ...(spillLocation ? [spillLocation.lon] : []),
    ...particles.map((p) => p.lon),
  ]
  const allLats = [
    ...(spillLocation ? [spillLocation.lat] : []),
    ...particles.map((p) => p.lat),
  ]

  const minLon = Math.min(...allLons)
  const maxLon = Math.max(...allLons)
  const minLat = Math.min(...allLats)
  const maxLat = Math.max(...allLats)

  const lonSpan = Math.max(0.04, maxLon - minLon)
  const latSpan = Math.max(0.03, maxLat - minLat)
  const padLon = lonSpan * 0.15
  const padLat = latSpan * 0.15

  const bMinLon = minLon - padLon
  const bMaxLon = maxLon + padLon
  const bMinLat = minLat - padLat
  const bMaxLat = maxLat + padLat

  const width = 380
  const height = 190
  const pad = 35

  const projectX = (lon: number) =>
    pad + ((lon - bMinLon) / (bMaxLon - bMinLon)) * (width - 2 * pad)
  const projectY = (lat: number) =>
    height - pad - ((lat - bMinLat) / (bMaxLat - bMinLat)) * (height - 2 * pad)

  let centroidX = 0
  let centroidY = 0
  if (particles.length > 0) {
    const sumLon = particles.reduce((acc, p) => acc + p.lon, 0)
    const sumLat = particles.reduce((acc, p) => acc + p.lat, 0)
    centroidX = projectX(sumLon / particles.length)
    centroidY = projectY(sumLat / particles.length)
  }

  const originX = spillLocation ? projectX(spillLocation.lon) : pad + 30
  const originY = spillLocation ? projectY(spillLocation.lat) : height / 2

  const displayParticles = particles.length > 250
    ? particles.filter((_, idx) => idx % Math.ceil(particles.length / 200) === 0)
    : particles

  return (
    <div className="analytical-plate">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytical-plate__svg" aria-label="Forward drift trajectory and dispersion">
        <rect width={width} height={height} fill="var(--color-trench, #0B1118)" rx={3} />

        {/* Graticule lines */}
        {[0.25, 0.5, 0.75].map((pct, i) => (
          <g key={i}>
            <line
              x1={pad + pct * (width - 2 * pad)}
              y1={pad}
              x2={pad + pct * (width - 2 * pad)}
              y2={height - pad}
              stroke="var(--color-chartline, #273340)"
              strokeWidth={0.5}
            />
            <line
              x1={pad}
              y1={pad + pct * (height - 2 * pad)}
              x2={width - pad}
              y2={pad + pct * (height - 2 * pad)}
              stroke="var(--color-chartline, #273340)"
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Net drift vector */}
        {particles.length > 0 && (
          <g>
            <line
              x1={originX}
              y1={originY}
              x2={centroidX}
              y2={centroidY}
              stroke="#0057FF"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <circle cx={centroidX} cy={centroidY} r={3} fill="#0057FF" />
            <text
              x={centroidX + 6}
              y={centroidY + 3}
              fill="var(--color-porcelain, #F8F7F4)"
              fontSize={8}
              fontFamily="'JetBrains Mono Variable', monospace"
            >
              Drift Centroid (+{durationHours ?? 24}h)
            </text>
          </g>
        )}

        {/* Particle cloud */}
        {displayParticles.map((p, i) => (
          <circle
            key={i}
            cx={projectX(p.lon)}
            cy={projectY(p.lat)}
            r={1.5}
            fill="#FFB020"
            opacity={0.55}
          />
        ))}

        {/* Spill release origin marker */}
        {spillLocation && (
          <g>
            <circle cx={originX} cy={originY} r={6} fill="none" stroke="#F8F7F4" strokeWidth={1.5} />
            <circle cx={originX} cy={originY} r={2.5} fill="#FFB020" />
            <line x1={originX - 9} y1={originY} x2={originX + 9} y2={originY} stroke="#F8F7F4" strokeWidth={0.8} />
            <line x1={originX} y1={originY - 9} x2={originX} y2={originY + 9} stroke="#F8F7F4" strokeWidth={0.8} />
            <text
              x={originX}
              y={originY - 10}
              textAnchor="middle"
              fill="var(--color-porcelain, #F8F7F4)"
              fontSize={8}
              fontFamily="'Schibsted Grotesk Variable', sans-serif"
            >
              Release Site
            </text>
          </g>
        )}

        {/* Coordinate bounds */}
        <text
          x={pad}
          y={height - 10}
          fill="var(--color-dim, #727D89)"
          fontSize={8}
          fontFamily="'JetBrains Mono Variable', monospace"
        >
          {bMinLat.toFixed(3)}°N, {bMinLon.toFixed(3)}°E
        </text>
        <text
          x={width - pad}
          y={height - 10}
          textAnchor="end"
          fill="var(--color-dim, #727D89)"
          fontSize={8}
          fontFamily="'JetBrains Mono Variable', monospace"
        >
          {bMaxLat.toFixed(3)}°N, {bMaxLon.toFixed(3)}°E
        </text>
      </svg>
    </div>
  )
}

/** Simple SVG mass balance bar for both screen and print */
function MassBalanceBar({
  remaining,
  evaporated,
  dispersed,
}: {
  remaining: number
  evaporated: number
  dispersed: number
}) {
  const total = remaining + evaporated + dispersed
  if (total <= 0) return null
  const rPct = (remaining / total) * 100
  const ePct = (evaporated / total) * 100
  const dPct = (dispersed / total) * 100

  return (
    <div className="mass-balance-figure">
      <svg viewBox="0 0 400 32" className="mass-balance-svg" aria-label="Mass balance distribution">
        <rect x={0} y={4} width={rPct * 4} height={24} fill="#FFB020" rx={2} />
        <rect x={rPct * 4} y={4} width={ePct * 4} height={24} fill="#727D89" rx={0} />
        <rect x={(rPct + ePct) * 4} y={4} width={dPct * 4} height={24} fill="#0057FF" rx={0} />
      </svg>
      <div className="mass-balance-legend">
        <span className="mass-balance-legend__item">
          <span className="mass-balance-legend__swatch" style={{ background: '#FFB020' }} />
          Remaining {rPct.toFixed(0)}%
        </span>
        <span className="mass-balance-legend__item">
          <span className="mass-balance-legend__swatch" style={{ background: '#727D89' }} />
          Evaporated {ePct.toFixed(0)}%
        </span>
        <span className="mass-balance-legend__item">
          <span className="mass-balance-legend__swatch" style={{ background: '#0057FF' }} />
          Dispersed {dPct.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

/**
 * 07 — BACKTRACKING
 * Inverse Lagrangian ensemble source estimation.
 */
export function BacktrackingSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const bt = useBacktrackingStore()

  const btData = reportData?.['7_backtracking'] as Record<string, unknown> | undefined
  const btSummary = btData?.summary ? String(btData.summary) : null

  if (bt.status === 'idle' && !bt.runId) {
    return (
      <ReportSection id="backtracking" number="07" title="Backtracking — Source Estimation">
        <ReportEmpty
          label="No backtracking data"
          hint="Backtracking ensemble has not been executed."
        />
      </ReportSection>
    )
  }

  return (
    <ReportSection id="backtracking" number="07" title="Backtracking — Source Estimation">
      <ReportNarrative>
        {btSummary ? (
          <p>{btSummary}</p>
        ) : (
          <p>
            The backtracking module runs an ensemble of reverse Lagrangian particle simulations to
            estimate the probable origin of the observed oil slick. Multiple ensemble members are
            released from the observed slick boundary and advected backward through modelled
            environmental forcing fields. The convergence of endpoint positions indicates the
            most likely source region.
          </p>
        )}
      </ReportNarrative>

      <h3 className="report-subsection-title">Estimated Origin</h3>
      <ReportMetricGrid columns={3}>
        <ReportMetric
          label="Position"
          value={bt.origin ? `${bt.origin.lat.toFixed(4)}°, ${bt.origin.lon.toFixed(4)}°` : null}
          mono
        />
        <ReportMetric label="Uncertainty" value={bt.uncertaintyKm?.toFixed(1)} unit="km (2σ)" mono />
        <ReportMetric
          label="Origin time"
          value={bt.originTime ? new Date(bt.originTime).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : null}
          mono
        />
      </ReportMetricGrid>

      {bt.originTimeRange && (
        <>
          <h3 className="report-subsection-title">Source Time Window</h3>
          <ReportMetricGrid columns={3}>
            <ReportMetric
              label="Earliest"
              value={new Date(bt.originTimeRange.earliest).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
              mono
            />
            <ReportMetric
              label="Preferred"
              value={new Date(bt.originTimeRange.preferred).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
              mono
            />
            <ReportMetric
              label="Latest"
              value={new Date(bt.originTimeRange.latest).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
              mono
            />
          </ReportMetricGrid>

          <SourceTimeWindowPlate range={bt.originTimeRange} />
        </>
      )}

      <h3 className="report-subsection-title">Confidence Assessment</h3>
      <ReportMetricGrid columns={4}>
        <ReportMetric label="Source concentration" value={bt.sourceConcentration} />
        <ReportMetric label="Environmental quality" value={bt.environmentalQuality} />
        <ReportMetric
          label="Trajectory agreement"
          value={bt.trajectoryAgreement != null ? `${(bt.trajectoryAgreement * 100).toFixed(0)}%` : null}
          mono
        />
        <ReportMetric label="Ensemble stability" value={bt.ensembleStability?.toFixed(2)} mono />
      </ReportMetricGrid>

      {bt.ensembleSummary && (
        <>
          <h3 className="report-subsection-title">Ensemble Summary</h3>
          <ReportMetricGrid columns={4}>
            <ReportMetric label="Members" value={bt.ensembleSummary.member_count} mono />
            <ReportMetric label="Converged" value={bt.ensembleSummary.converged_count} mono />
            <ReportMetric
              label="Mean endpoint distance"
              value={bt.ensembleSummary.mean_endpoint_distance_km.toFixed(2)}
              unit="km"
              mono
            />
            <ReportMetric
              label="Std deviation"
              value={bt.ensembleSummary.std_endpoint_distance_km.toFixed(2)}
              unit="km"
              mono
            />
          </ReportMetricGrid>
        </>
      )}

      {bt.quality && (
        <>
          <h3 className="report-subsection-title">Particle Quality</h3>
          <ReportMetricGrid columns={4}>
            <ReportMetric label="Total particles" value={bt.quality.total_particles} mono />
            <ReportMetric label="Converged" value={bt.quality.converged_particles} mono />
            <ReportMetric label="Land hits" value={bt.quality.land_hits} mono />
            <ReportMetric label="Domain exits" value={bt.quality.domain_exits} mono />
          </ReportMetricGrid>
        </>
      )}

      {/* Static analytical figure: Origin point + contour representation */}
      {bt.origin && (
        <ReportFigure
          title="Backtracking Origin Estimate"
          description={`Estimated source position at ${bt.origin.lat.toFixed(4)}°, ${bt.origin.lon.toFixed(4)}° with ±${bt.uncertaintyKm?.toFixed(1) ?? '?'} km uncertainty (2σ).${bt.sourceContours && bt.sourceContours.length > 0 ? ` ${bt.sourceContours.length} confidence contour(s) computed.` : ''}`}
          provenance={bt.environmentSource ?? 'Unknown forcing'}
          timeRef={bt.durationHours ? `${bt.durationHours.toFixed(0)}h backward integration` : undefined}
        >
          <BacktrackingAnalyticalPlate
            origin={bt.origin}
            uncertaintyKm={bt.uncertaintyKm}
            contours={bt.sourceContours}
            trajectories={bt.trajectories}
          />
        </ReportFigure>
      )}

      <div className="report-env-source">
        <span className="report-env-source__label">Forcing</span>
        <span className="report-env-source__note">
          <ReportProvenance value={bt.environmentSource} />
          {bt.durationHours && ` · ${bt.durationHours.toFixed(0)}h · `}
          {bt.ensembleSize && `${bt.ensembleSize} members`}
          {bt.particlesPerMember && ` × ${bt.particlesPerMember} particles`}
        </span>
      </div>
    </ReportSection>
  )
}

/**
 * Visual timeline showing earliest, preferred, and latest origin times.
 */
function SourceTimeWindowPlate({
  range,
}: {
  range: { earliest: string; preferred: string; latest: string }
}) {
  const t0 = new Date(range.earliest).getTime()
  const tPref = new Date(range.preferred).getTime()
  const t1 = new Date(range.latest).getTime()
  const span = Math.max(1, t1 - t0)
  const prefPct = Math.min(100, Math.max(0, ((tPref - t0) / span) * 100))

  return (
    <div className="analytical-plate mt-3">
      <svg viewBox="0 0 380 50" className="analytical-plate__svg" aria-label="Source time window">
        <rect width="380" height="50" fill="var(--color-trench, #0B1118)" rx={3} />
        {/* Timeline track */}
        <rect x="30" y="20" width="320" height="6" fill="rgba(0, 87, 255, 0.15)" rx="3" />
        <rect x="30" y="20" width="320" height="6" stroke="#0057FF" strokeWidth="0.8" fill="none" rx="3" />
        {/* Preferred needle */}
        <line
          x1={30 + (prefPct / 100) * 320}
          y1="14"
          x2={30 + (prefPct / 100) * 320}
          y2="32"
          stroke="#F8F7F4"
          strokeWidth="2"
        />
        <circle cx={30 + (prefPct / 100) * 320} cy="13" r="3" fill="#0057FF" stroke="#F8F7F4" strokeWidth="1" />
        {/* Earliest label */}
        <text x="30" y="42" fill="var(--color-dim, #727D89)" fontSize="8" fontFamily="'JetBrains Mono Variable', monospace">
          {new Date(range.earliest).toISOString().slice(11, 16)}Z Earliest
        </text>
        {/* Preferred label */}
        <text
          x={30 + (prefPct / 100) * 320}
          y="9"
          textAnchor="middle"
          fill="var(--color-porcelain, #F8F7F4)"
          fontSize={8}
          fontFamily="'JetBrains Mono Variable', monospace"
        >
          {new Date(range.preferred).toISOString().slice(11, 16)}Z Preferred
        </text>
        {/* Latest label */}
        <text x="350" y="42" textAnchor="end" fill="var(--color-dim, #727D89)" fontSize="8" fontFamily="'JetBrains Mono Variable', monospace">
          {new Date(range.latest).toISOString().slice(11, 16)}Z Latest
        </text>
      </svg>
    </div>
  )
}

/**
 * Static SVG analytical plate showing backtracking origin + uncertainty.
 * Works in both screen and print without WebGL.
 */
function BacktrackingAnalyticalPlate({
  origin,
  uncertaintyKm,
  contours,
  trajectories,
}: {
  origin: { lon: number; lat: number }
  uncertaintyKm: number | null
  contours: { level: number; polygon: [number, number][] }[] | null
  trajectories: { member: number; endpoints: { lon: number; lat: number }[] }[] | null
}) {
  const r = uncertaintyKm ?? 5
  // Sample up to 8 trajectory streamlines if present
  const sampleTrajs = trajectories ? trajectories.slice(0, 8) : []

  return (
    <div className="analytical-plate">
      <svg viewBox="0 0 340 200" className="analytical-plate__svg" aria-label="Backtracking origin estimate">
        {/* Background */}
        <rect width="340" height="200" fill="var(--color-trench, #0B1118)" rx={3} />

        {/* Grid lines */}
        {[50, 100, 150, 200, 250, 300].map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={200} stroke="var(--color-chartline, #273340)" strokeWidth={0.5} />
        ))}
        {[40, 80, 120, 160].map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={340} y2={y} stroke="var(--color-chartline, #273340)" strokeWidth={0.5} />
        ))}

        {/* Backward trajectories streamlines */}
        {sampleTrajs.map((tr, idx) => {
          // Synthetic arc into center for visual indication of backward advection
          const angle = (idx / sampleTrajs.length) * Math.PI * 2
          const startX = 170 + Math.cos(angle) * 120
          const startY = 100 + Math.sin(angle) * 80
          return (
            <g key={`traj-${tr.member}-${idx}`}>
              <path
                d={`M ${startX} ${startY} Q ${170 + Math.cos(angle + 0.3) * 60} ${100 + Math.sin(angle + 0.3) * 40} 170 100`}
                fill="none"
                stroke="#0057FF"
                strokeWidth={0.8}
                strokeDasharray="3 2"
                opacity={0.4}
              />
            </g>
          )
        })}

        {/* Uncertainty circle */}
        <circle cx={170} cy={100} r={Math.min(75, r * 4)} fill="rgba(0, 87, 255, 0.08)" stroke="#0057FF" strokeWidth={1} strokeDasharray="4 2" />

        {/* Contour indicators */}
        {contours && contours.length > 0 && contours.map((c, i) => (
          <circle
            key={i}
            cx={170}
            cy={100}
            r={Math.min(70, 20 + i * 15)}
            fill="none"
            stroke="#0057FF"
            strokeWidth={0.5}
            opacity={0.25 + c.level * 0.35}
          >
            <title>{`Contour level ${c.level}`}</title>
          </circle>
        ))}

        {/* Origin point */}
        <circle cx={170} cy={100} r={4} fill="#0057FF" />
        <circle cx={170} cy={100} r={7} fill="none" stroke="#F8F7F4" strokeWidth={1.5} />

        {/* Labels */}
        <text x={170} y={24} textAnchor="middle" fill="var(--color-porcelain, #F8F7F4)" fontSize={10} fontFamily="'Schibsted Grotesk Variable', sans-serif">
          Estimated Origin
        </text>
        <text x={170} y={180} textAnchor="middle" fill="var(--color-dim, #727D89)" fontSize={9} fontFamily="'JetBrains Mono Variable', monospace">
          {origin.lat.toFixed(4)}°, {origin.lon.toFixed(4)}°
        </text>
        {uncertaintyKm != null && (
          <text x={170} y={192} textAnchor="middle" fill="var(--color-dim, #727D89)" fontSize={8} fontFamily="'JetBrains Mono Variable', monospace">
            ±{uncertaintyKm.toFixed(1)} km (2σ)
          </text>
        )}
      </svg>
    </div>
  )
}
