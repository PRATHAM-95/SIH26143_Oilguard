import { useUiStore } from '@/store/uiStore'
import { MaritimeMapTheater } from './MaritimeMapTheater'
import { StationOverview } from './StationOverview'

/**
 * M11 Phase 2 — Command Center map pane composer.
 *
 * The map is CLOSED by default: while `uiStore.mapPaneOpen` is false the
 * MaritimeMapTheater is fully unmounted (zero Maplibre/Deck.gl presence) and a
 * read-only StationOverview is shown instead. Exactly one map state system
 * exists — the domain stores — so mounting the existing theater on OPEN MAP
 * restores view / selection / basemap / layer posture / fit intent from them.
 */
export function CommandCenterMapDeck() {
  const mapPaneOpen = useUiStore((s) => s.mapPaneOpen)
  const toggleMapPane = useUiStore((s) => s.toggleMapPane)

  return (
    <div className="cc-deck">
      <div className="cc-deck-bar">
        <span className="cc-deck-kicker" aria-hidden="true">
          {mapPaneOpen ? 'GIS · LIVE MAP' : 'STATION OVERVIEW'}
        </span>
        <button
          type="button"
          className="cc-deck-toggle"
          aria-pressed={mapPaneOpen}
          aria-controls="cc-map-pane"
          onClick={toggleMapPane}
        >
          {mapPaneOpen ? 'CLOSE MAP' : 'OPEN MAP'}
        </button>
      </div>
      <div
        id="cc-map-pane"
        className="cc-deck-stage"
        role="region"
        aria-label="Command center map pane"
      >
        {mapPaneOpen ? <MaritimeMapTheater /> : <StationOverview />}
      </div>
    </div>
  )
}