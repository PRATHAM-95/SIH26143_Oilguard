import { useState } from 'react'
import { REGIONS, REGION_BY_ID, useMapStore, type RegionId } from '@/store/mapStore'

/**
 * Operating-region selector, bottom-right of the map. Switching a region
 * flies the camera to that operating box (via the map store's fit request).
 */
export function RegionSelector() {
  const requestFit = useMapStore((s) => s.requestFit)
  const [open, setOpen] = useState(false)

  const pick = (id: RegionId) => {
    requestFit(REGION_BY_ID[id].bounds)
    setOpen(false)
  }

  return (
    <div className={`region-selector${open ? ' region-selector--open' : ''}`}>
      <button
        type="button"
        className="region-selector-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="region-selector-globe" aria-hidden="true">
          ○
        </span>
        <span className="region-selector-name">{REGION_BY_ID.io.short} · {REGION_BY_ID.io.label}</span>
        <span className="region-selector-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="region-selector-menu" role="listbox" aria-label="Operating region">
          {REGIONS.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={r.id === 'io'}
                className="region-option"
                onClick={() => pick(r.id)}
                title={r.note}
              >
                <span className="region-option-short">{r.short}</span>
                <span className="region-option-label">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}