import { useMemo } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useAttributionStore } from '@/store/featureStores'
import { dms, haversineKm, ageFromNow } from '@/components/map/maritime/geo'
import { referenceNowMs } from '@/lib/demo/mode'
import '@/styles/maritime-overlays.css'

/**
 * Compact hover card for a vessel under the pointer.
 *
 * Rendered as DOM rather than a deck.gl layer for three reasons: the text stays
 * crisp at any zoom, it can be styled with the same type scale as the panels,
 * and it can hold a small definition grid without inflating a TextLayer atlas.
 * Position comes from the same hover pick that drives the layer highlight, so
 * the card and the ring can never point at different ships.
 *
 * The card is anchored to the pointer and flipped near the right and bottom
 * edges, because the vessel cluster sits mid-pane and an unclamped card would
 * be clipped by the map bounds.
 */
export function VesselHoverCard() {
  const hover = useMapStore((s) => s.hover)
  const selection = useMapStore((s) => s.selection)
  const vessels = useSimulationStore((s) => s.vessels)
  const attributionVessels = useAttributionStore((s) => s.vessels)
  const origin = useAttributionStore((s) => s.origin)

  const detail = useMemo(() => {
    if (hover?.pick?.kind !== 'vessel') return null
    const { id, mmsi } = hover.pick
    const vessel = vessels.find((v) => v.id === id || (mmsi != null && v.mmsi === mmsi))
    if (!vessel) return null
    // The selection popup is the richer readout for the same ship. Showing both
    // stacks two panels over one hull; the popup wins.
    const selected =
      selection?.kind === 'vessel' &&
      (selection.id === vessel.id || selection.mmsi === vessel.mmsi)
    if (selected) return null
    const rank = attributionVessels.find((c) => c.mmsi === vessel.mmsi) ?? null
    return {
      vessel,
      rank,
      age: ageFromNow(vessel.lastSeen, referenceNowMs()),
      distanceKm:
        origin != null
          ? haversineKm(
              { lon: vessel.position.lon, lat: vessel.position.lat },
              { lon: origin.lon, lat: origin.lat },
            )
          : null,
    }
  }, [hover, selection, vessels, attributionVessels, origin])

  if (!hover || !detail) return null

  const { vessel, rank, distanceKm, age } = detail
  const { x, y } = hover
  // Flip toward the pointer's inboard side when the card would overflow.
  const flipX = x > 420
  const flipY = y > 300
  const CARD_W = 236

  return (
    <div
      className="mm-hovercard"
      role="tooltip"
      style={{
        left: flipX ? x - CARD_W - 16 : x + 16,
        top: flipY ? y - 12 : y + 14,
      }}
    >
      <div className="mm-hovercard-head">
        <span className="mm-hovercard-name">{vessel.name}</span>
        {rank ? (
          <span className="mm-hovercard-rank" data-rank={rank.rank ?? undefined}>
            CANDIDATE {rank.rank ? `#${rank.rank}` : ''}
          </span>
        ) : null}
      </div>

      <dl className="mm-hovercard-grid">
        <div>
          <dt>Type</dt>
          <dd>{vessel.type || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{vessel.status || '—'}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>
            {typeof vessel.speed === 'number' && vessel.speed > 0
              ? `${vessel.speed.toFixed(1)} kn`
              : 'Stationary'}
          </dd>
        </div>
        <div>
          <dt>Heading</dt>
          <dd>{Number.isFinite(vessel.heading) ? `${Math.round(vessel.heading)}°` : '—'}</dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>{vessel.destination || '—'}</dd>
        </div>
        <div>
          <dt>Flag</dt>
          <dd>{vessel.flag || '—'}</dd>
        </div>
        {rank?.minDistanceKm != null ? (
          <div>
            <dt>Closest appr.</dt>
            <dd>{rank.minDistanceKm.toFixed(1)} km</dd>
          </div>
        ) : distanceKm != null ? (
          <div>
            <dt>To slick</dt>
            <dd>{distanceKm.toFixed(1)} km</dd>
          </div>
        ) : null}
      </dl>

      <div className="mm-hovercard-foot">
        MMSI {vessel.mmsi}
        {age ? ` · seen ${age}` : ''}
      </div>
      <div className="mm-hovercard-pos">
        {dms(vessel.position.lat, vessel.position.lon)}
      </div>
    </div>
  )
}
