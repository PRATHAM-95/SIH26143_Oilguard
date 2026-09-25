/**
 * M11 Phase 7 — Shared vessel telemetry block.
 *
 * Read-only presentation of a fleet vessel (identity + telemetry) enriched with
 * incident-relative geometry and, when the vessel resolves to an AIS candidate,
 * its corridor rank. Reused by the Simulation console (VesselDetail), the
 * Attribution inspector, and the Command Center AIS intel view so the vessel
 * reading never drifts between surfaces.
 */
import { useUnifiedVesselById } from './useDemoJourney'
import type { IntegratedVessel } from '@/types/domain'
import '@/styles/journey.css'

export function VesselContext({ vessel }: { vessel: IntegratedVessel | null }) {
  const unified = useUnifiedVesselById(vessel?.id)

  if (!vessel) return null

  const { candidate, distanceKm, bearingDeg } = unified ?? {}

  return (
    <div className="journey-vesselctx">
      <div className="flex justify-between">
        <span className="text-mist">Type</span>
        <span className="text-foam">{vessel.type || 'Unknown'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-mist">MMSI</span>
        <span className="font-mono text-foam tabular-nums">{vessel.mmsi || '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-mist">Speed</span>
        <span className="font-mono text-foam tabular-nums">
          {vessel.speed !== 0 ? `${vessel.speed.toFixed(1)} kn` : '—'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-mist">Heading</span>
        <span className="font-mono text-foam tabular-nums">
          {vessel.heading !== 0 ? `${vessel.heading.toFixed(0)}°` : '—'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-mist">Position</span>
        <span className="font-mono text-foam tabular-nums">
          {vessel.position.lat.toFixed(4)}°, {vessel.position.lon.toFixed(4)}°
        </span>
      </div>

      <div className="journey-vesselctx__ctx">
        <span className="journey-kicker">Incident context</span>
        <div className="flex justify-between">
          <span className="text-mist">Dist. to spill</span>
          <span className="font-mono text-foam tabular-nums">
            {distanceKm != null ? `${distanceKm.toFixed(1)} km` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-mist">Bearing from spill</span>
          <span className="font-mono text-foam tabular-nums">
            {bearingDeg != null ? `${bearingDeg.toFixed(0)}°` : '—'}
          </span>
        </div>
        {candidate ? (
          <div className="flex justify-between">
            <span className="text-mist">AIS corridor rank</span>
            <span className="font-mono text-foam tabular-nums">#{candidate.rank}</span>
          </div>
        ) : null}
      </div>

      <p className="journey-footnote">
        Distance &amp; bearing derived from current fleet positions relative to the observed
        spill — never inferred or shifted.
      </p>
    </div>
  )
}