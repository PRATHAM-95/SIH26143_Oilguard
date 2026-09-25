/**
 * M11 Phase 7 — CorridorTrafficCard.
 *
 * The AIS corridor "traffic picture" for a completed attribution run: the
 * ranked candidate set re-ordered by closest approach (rendered from the same
 * store list, not a new dataset) plus filter book-keeping (kept / dropped) and
 * the AIS source feed label. Read-only; disappears entirely before a run.
 */
import { useMemo } from 'react'
import { useAttributionStore } from '@/store/featureStores'
import '@/styles/journey.css'

export function CorridorTrafficCard() {
  const status = useAttributionStore((s) => s.status)
  const vessels = useAttributionStore((s) => s.vessels)
  const radiusKm = useAttributionStore((s) => s.radiusKm)
  const kept = useAttributionStore((s) => s.kept)
  const dropped = useAttributionStore((s) => s.dropped)
  const aisSource = useAttributionStore((s) => s.aisSource)

  const sorted = useMemo(
    () =>
      [...vessels].sort(
        (a, b) => (a.minDistanceKm ?? Number.POSITIVE_INFINITY) - (b.minDistanceKm ?? Number.POSITIVE_INFINITY),
      ),
    [vessels],
  )

  if (status !== 'completed' || vessels.length === 0) return null

  return (
    <div className="journey-corridor" aria-label="AIS corridor traffic overview">
      <div className="journey-corridor__head">
        <span className="journey-kicker">AIS corridor traffic</span>
        <span className="journey-corridor__count">
          {vessels.length} vessels{radiusKm ? ` · ~${radiusKm} km window` : ''}
        </span>
      </div>
      <ol className="journey-corridor__list">
        {sorted.map((v) => (
          <li key={`route-${v.rank}-${v.mmsi ?? v.name ?? ''}`} className="journey-corridor__row">
            <span className="journey-corridor__rank">#{v.rank}</span>
            <span className="journey-corridor__name">{v.name ?? 'Unnamed'}</span>
            <span className="journey-corridor__dist">
              {v.minDistanceKm != null ? `${v.minDistanceKm.toFixed(1)} km` : '—'}
            </span>
          </li>
        ))}
      </ol>
      {(kept != null || dropped != null || aisSource) && (
        <div className="journey-corridor__foot">
          {kept != null && dropped != null ? `${kept} kept · ${dropped} dropped` : null}
          {aisSource ? <span>{aisSource}</span> : null}
        </div>
      )}
    </div>
  )
}