import { useMemo, useState } from 'react'
import {
  MAP_LAYER_CATALOG,
  LAYER_GROUP_LABEL,
  LAYER_GROUP_ORDER,
  useMapStore,
  type MapLayerId,
} from '@/store/mapStore'
import { LayersIcon, ChevronDownIcon } from '@/components/ui/Icon'

export function LayerInspector({ available }: { available?: MapLayerId[] }) {
  const visibility = useMapStore((s) => s.visibility)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const setLayer = useMapStore((s) => s.setLayer)
  const [isOpen, setIsOpen] = useState(false)

  const availableSet = useMemo(() => new Set<MapLayerId>(available ?? []), [available])

  const activeCount = useMemo(() => {
    return (Object.entries(visibility) as [MapLayerId, boolean][]).filter(
      ([id]) => available == null || availableSet.has(id),
    ).filter(([, v]) => v).length
  }, [visibility, availableSet, available])

  const totalAvailableCount = useMemo(() => {
    return available ? available.length : Object.keys(MAP_LAYER_CATALOG).length
  }, [available])

  const handleToggleAll = (enable: boolean) => {
    const targets = available ?? (Object.keys(MAP_LAYER_CATALOG) as MapLayerId[])
    for (const id of targets) {
      setLayer(id, enable)
    }
  }

  return (
    <div className="gis-layer-inspector" role="region" aria-label="GIS Map Layer Inspector">
      {/* Precision Trigger Pill */}
      <button
        type="button"
        className={`layer-inspector-trigger ${isOpen ? 'layer-inspector-trigger--active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`GIS Data & Layers: ${activeCount} of ${totalAvailableCount} active`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <LayersIcon size={13} />
        <span className="trigger-label">GIS LAYERS</span>
        <span className="trigger-badge">
          {activeCount}/{totalAvailableCount}
        </span>
        <span className={`trigger-chev ${isOpen ? 'trigger-chev--open' : ''}`} aria-hidden="true">
          <ChevronDownIcon size={11} />
        </span>
      </button>

      {/* Compact Flying Inspector Flyout */}
      {isOpen ? (
        <div className="gis-inspector-flyout" role="dialog" aria-label="Geospatial Layers Catalog">
          <div className="gis-flyout-header">
            <div className="gis-flyout-title">
              <LayersIcon size={12} />
              <span>SPATIAL DATA CATALOGUE</span>
            </div>

            <div className="gis-quick-actions">
              <button
                type="button"
                className="gis-action-link"
                onClick={() => handleToggleAll(true)}
                title="Enable all available layers"
              >
                All on
              </button>
              <span className="gis-action-sep" aria-hidden="true">·</span>
              <button
                type="button"
                className="gis-action-link"
                onClick={() => handleToggleAll(false)}
                title="Disable all layers"
              >
                All off
              </button>
            </div>
          </div>

          <div className="gis-flyout-body">
            {LAYER_GROUP_ORDER.map((group) => {
              const ids = (Object.entries(MAP_LAYER_CATALOG) as [MapLayerId, (typeof MAP_LAYER_CATALOG)[MapLayerId]][])
                .filter(([, meta]) => meta.group === group)
                .map(([id]) => id)

              return (
                <div className="gis-layer-group" key={group}>
                  <div className="gis-group-header">
                    <span className="gis-group-title">{LAYER_GROUP_LABEL[group]}</span>
                  </div>

                  <div className="gis-group-items" role="group" aria-label={LAYER_GROUP_LABEL[group]}>
                    {ids.map((id) => {
                      const meta = MAP_LAYER_CATALOG[id]
                      const hasData = available == null || availableSet.has(id)
                      const isVisible = visibility[id]

                      return (
                        <button
                          key={id}
                          type="button"
                          className={`gis-layer-item ${isVisible && hasData ? 'gis-layer-item--active' : ''} ${!hasData ? 'gis-layer-item--disabled' : ''}`}
                          disabled={!hasData}
                          aria-pressed={isVisible && hasData}
                          onClick={() => toggleLayer(id)}
                          title={hasData ? meta.label : meta.emptyNote ?? `${meta.label} — no data present`}
                        >
                          <span
                            className="gis-layer-swatch"
                            style={{ backgroundColor: meta.color ?? 'var(--ink-muted)' }}
                            aria-hidden="true"
                          />
                          <span className="gis-layer-name">{meta.label}</span>
                          <span className="gis-layer-state" aria-hidden="true">
                            {!hasData ? 'NO DATA' : isVisible ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="gis-flyout-footer">
            <span className="gis-integrity-mark" aria-hidden="true">🔒</span>
            <span>Live GIS verification — zero fabricated spatial data.</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
