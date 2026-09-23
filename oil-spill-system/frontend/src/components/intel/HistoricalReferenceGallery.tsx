import { useEffect } from 'react'
import { useState } from 'react'
import { REFERENCE_IMAGERY, type ReferenceImagery } from '@/lib/referenceImagery'
import { REFERENCE_NOTE } from '@/lib/referenceImagery'
import { useUiStore } from '@/store/uiStore'

/**
 * Historical reference gallery — real public-domain Deepwater Horizon archive
 * imagery (NASA / NOAA), shipped local so an offline demo still has honest
 * reference material. Every tile is labelled with its true source, licence and
 * attribution. Remote sensing in this tool NEVER fakes a live SAR scene; an
 * image marked "reference" is exactly that — decorator, never evidence.
 *
 * Open/close is driven by the shared UI store so the map toolbar chip and the
 * command centre can both reach it; the payload itself is the catalog verbatim.
 */
export function HistoricalReferenceGallery() {
  const open = useUiStore((s) => s.referenceOpen)
  const setReferenceOpen = useUiStore((s) => s.setReferenceOpen)
  const [active, setActive] = useState<ReferenceImagery | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReferenceOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setReferenceOpen])

  if (!open) return null

  return (
    <div className="ref-overlay" role="dialog" aria-modal="true" aria-label="Historical reference imagery">
      <div className="ref-overlay-inner">
        <div className="ref-head">
          <div>
            <div className="ref-kicker">Reference archive · public domain</div>
            <div className="ref-title">Deepwater Horizon — satellite reference imagery</div>
          </div>
          <button type="button" className="ref-close" onClick={() => setReferenceOpen(false)} aria-label="Close reference gallery">
            ×
          </button>
        </div>
        <div className="ref-grid">
          {REFERENCE_IMAGERY.map((img) => (
            <button
              key={img.id}
              type="button"
              className="ref-card"
              onClick={() => setActive(active?.id === img.id ? null : img)}
              aria-pressed={active?.id === img.id}
            >
              <img src={img.src} alt={img.title} className="ref-card-img" loading="lazy" />
              <div className="ref-card-body">
                <div className="ref-card-meta">
                  <span className="ref-tag">{img.kind}</span>
                  <span className="ref-instrument">{img.instrument}</span>
                </div>
                <div className="ref-card-title">{img.title}</div>
                <div className="ref-card-source">{img.source} · {img.acquired}</div>
              </div>
            </button>
          ))}
        </div>

        {active ? (
          <div className="ref-detail">
            <img src={active.src} alt={active.title} className="ref-detail-img" />
            <div className="ref-detail-copy">
              <div className="ref-tag">{active.kind}</div>
              <h4>{active.title}</h4>
              <p>{active.note}</p>
              <dl className="ref-prov">
                <dt>Instrument</dt><dd>{active.instrument}</dd>
                <dt>Acquired</dt><dd>{active.acquired}</dd>
                <dt>Source</dt><dd>{active.source}</dd>
                <dt>Licence</dt><dd>{active.license}</dd>
                <dt>Attribution</dt><dd>{active.attribution}</dd>
              </dl>
            </div>
          </div>
        ) : (
          <div className="ref-hint">{REFERENCE_NOTE}</div>
        )}
      </div>
    </div>
  )
}
