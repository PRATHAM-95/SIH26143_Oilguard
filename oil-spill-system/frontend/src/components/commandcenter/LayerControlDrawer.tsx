import { useMemo, useState } from 'react'
import {
  MAP_LAYER_CATALOG,
  LAYER_GROUP_LABEL,
  LAYER_GROUP_ORDER,
  useMapStore,
  type MapLayerId,
} from '@/store/mapStore'
import { LayersIcon, ChevronDownIcon } from '@/components/ui/Icon'

export function LayerControlDrawer({ available }: { available?: MapLayerId[] }) {
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
    <div className="layer-drawer-container" role="region" aria-label="Geospatial Layers Drawer">
      <button
        type="button"
        className={`layer-drawer-trigger ${isOpen ? 'layer-drawer-trigger--active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`GIS Data Layers: ${activeCount} of ${totalAvailableCount} active`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <LayersIcon size={13} />
        <span className="layer-trigger-title">GIS LAYERS</span>
        <span className="layer-trigger-count">
          {activeCount}/{totalAvailableCount}
        </span>
        <span className={`layer-trigger-arrow ${isOpen ? 'layer-trigger-arrow--open' : ''}`}>
          <ChevronDownIcon size={11} />
        </span>
      </button>

      {isOpen ? (
        <div className="layer-drawer-flyout" role="dialog" aria-label="Spatial Data Layers">
          <div className="layer-flyout-header">
            <div className="layer-flyout-title-wrap">
              <LayersIcon size={13} />
              <span className="layer-flyout-heading">GEOSPATIAL CATALOGUE</span>
            </div>

            <div className="layer-batch-actions">
              <button
                type="button"
                className="layer-batch-btn"
                onClick={() => handleToggleAll(true)}
              >
                All on
              </button>
              <span className="layer-batch-sep">·</span>
              <button
                type="button"
                className="layer-batch-btn"
                onClick={() => handleToggleAll(false)}
              >
                All off
              </button>
            </div>
          </div>

          <div className="layer-flyout-content">
            {LAYER_GROUP_ORDER.map((group) => {
              const ids = (Object.entries(MAP_LAYER_CATALOG) as [MapLayerId, (typeof MAP_LAYER_CATALOG)[MapLayerId]][])
                .filter(([, meta]) => meta.group === group)
                .map(([id]) => id)

              return (
                <div className="layer-group-block" key={group}>
                  <div className="layer-group-title">{LAYER_GROUP_LABEL[group]}</div>
                  <div className="layer-group-items" role="group" aria-label={LAYER_GROUP_LABEL[group]}>
                    {ids.map((id) => {
                      const meta = MAP_LAYER_CATALOG[id]
                      const hasData = available == null || availableSet.has(id)
                      const isVisible = visibility[id]

                      return (
                        <button
                          key={id}
                          type="button"
                          className={`layer-item-btn ${isVisible && hasData ? 'layer-item-btn--active' : ''} ${!hasData ? 'layer-item-btn--disabled' : ''}`}
                          disabled={!hasData}
                          aria-pressed={isVisible && hasData}
                          onClick={() => toggleLayer(id)}
                          title={hasData ? meta.label : meta.emptyNote ?? `${meta.label} — no data present`}
                        >
                          <span
                            className="layer-swatch"
                            style={{ backgroundColor: meta.color ?? 'var(--ink-muted)' }}
                            aria-hidden="true"
                          />
                          <span className="layer-name">{meta.label}</span>
                          <span className="layer-status-pill">
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

          <div className="layer-flyout-footer">
            <span className="layer-verified-glyph" aria-hidden="true">🔒</span>
            <span>Deterministic GIS feed — zero interpolated data points</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
