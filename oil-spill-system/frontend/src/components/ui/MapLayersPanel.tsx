import { useMemo, useState } from 'react'
import {
  MAP_LAYER_CATALOG,
  LAYER_GROUP_LABEL,
  LAYER_GROUP_ORDER,
  useMapStore,
  type MapLayerId,
} from '@/store/mapStore'
import { ChevronDownIcon, LayersIcon } from '@/components/ui/Icon'

/**
 * "Data & Layers" table of contents — grouped, catalogue-driven layer toggles
 * that float over the map pane. Rows for layers with no data on the current
 * screen are disabled and annotated (never offered silently). The catalogue is
 * the single source of labels/group/colour, so the TOC can never drift from
 * the map palette.
 */
export function MapLayersPanel({ available }: { available?: MapLayerId[] }) {
  const visibility = useMapStore((s) => s.visibility)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const [open, setOpen] = useState(true)

  const availableSet = useMemo(() => new Set<MapLayerId>(available ?? []), [available])

  const activeCount = useMemo(() => {
    return (Object.entries(visibility) as [MapLayerId, boolean][]).filter(
      ([id]) => available == null || availableSet.has(id),
    ).filter(([, v]) => v).length
  }, [visibility, availableSet, available])

  return (
    <div className="layers-panel" data-open={open ? 'true' : 'false'} aria-hidden={!open}>
      <div
        className="layers-panel-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <span className="layers-title">
          <LayersIcon size={14} />
          Data &amp; Layers
        </span>
        {open ? <span className="layers-count">{activeCount} on</span> : null}
        <span className="chev" aria-hidden="true" style={{ color: 'var(--ink-2)' }}>
          <ChevronDownIcon size={13} />
        </span>
      </div>
      {open ? (
        <div className="layers-body">
          {LAYER_GROUP_ORDER.map((group) => {
            const ids = (Object.entries(MAP_LAYER_CATALOG) as [MapLayerId, (typeof MAP_LAYER_CATALOG)[MapLayerId]][])
              .filter(([, meta]) => meta.group === group)
              .map(([id]) => id)
            return (
              <div className="layers-group" key={group}>
                <div className="layers-group-title">{LAYER_GROUP_LABEL[group]}</div>
                {ids.map((id) => {
                  const meta = MAP_LAYER_CATALOG[id]
                  const hasData = available == null || availableSet.has(id)
                  const visible = visibility[id]
                  const stateLabel = hasData ? (visible ? 'on' : 'off') : 'no data'
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`layer-row${visible && hasData ? ' layer-row--on' : ''}`}
                      disabled={!hasData}
                      aria-pressed={visible}
                      title={hasData ? meta.label : meta.emptyNote ?? `${meta.label} — no data`}
                      onClick={() => toggleLayer(id)}
                    >
                      <span
                        className="layer-swatch"
                        style={{ background: meta.color ?? 'transparent' }}
                        aria-hidden="true"
                      />
                      <span className="layer-row-decor" aria-hidden="true">
                        <LayersIcon size={11} style={{ opacity: visible ? 1 : 0.45 }} />
                      </span>
                      <span className="layer-row-label">{meta.label}</span>
                      <span
                        className={`layer-state${!hasData ? ' layer-state--nodata' : ''}`}
                        aria-label={stateLabel}
                      >
                        {stateLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
          <div className="layers-foot">
            A visible layer always reflects data the system actually holds; layers with
            no data are marked and never fabricated.
          </div>
        </div>
      ) : null}
    </div>
  )
}