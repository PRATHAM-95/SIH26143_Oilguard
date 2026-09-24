import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMap } from 'react-map-gl/maplibre'
import { useMapStore, type MapSelection, regionFor } from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { stageRankedVessels } from '@/components/map/InvestigationMap'
import { useSelectionFocus } from '@/components/workspace/selection'
import { useConnectionStore } from '@/store/connectionStore'
import { dms, haversineKm } from '@/components/map/maritime/geo'

const POPUP_KINDS = new Set(['spill', 'slick', 'sar_candidate', 'vessel', 'ais_candidate'])

type Pixel = { x: number; y: number } | null

function severityClass(value: number): { cls: string; label: string } {
  if (value >= 0.85) return { cls: 'mm-pop-badge--high', label: 'HIGH' }
  if (value >= 0.6) return { cls: 'mm-pop-badge--med', label: 'MEDIUM' }
  return { cls: 'mm-pop-badge--low', label: 'LOW' }
}

/**
 * Compact on-map popup shown next to the clicked spill / vessel. Position is
 * projected from the selected object's coordinates so the card follows the
 * map as it moves. It re-uses real store data only — no fabricated values.
 */
export function MapSelectionPopup() {
  const map = useMap().current
  const focus = useSelectionFocus()
  const [pos, setPos] = useState<Pixel>(null)
  const selection = focus?.selection ?? null

  useLayoutEffect(() => {
    if (!map || !focus?.coords) {
      setPos(null)
      return
    }
    const gl = map.getMap()
    if (!gl) return
    const update = () => {
      try {
        const p = gl.project(focus.coords as [number, number])
        const el = gl.getContainer()
        const w = el.clientWidth
        const h = el.clientHeight
        if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) {
          setPos(null)
          return
        }
        const cardW = 264
        const cardH = 320
        let x = p.x + 14
        let y = p.y - 24
        if (x + cardW > w - 8) x = Math.max(8, p.x - cardW - 14)
        if (y + cardH > h - 8) y = Math.max(8, h - cardH - 8)
        if (y < 8) y = 8
        setPos({ x, y })
      } catch {
        setPos(null)
      }
    }
    update()
    gl.on('move', update)
    gl.on('rotate', update)
    return () => {
      gl.off('move', update)
      gl.off('rotate', update)
    }
  }, [map, focus])

  if (!selection || !POPUP_KINDS.has(selection.kind) || !pos) return null

  return (
    <div className="mm-pop" style={{ left: pos.x, top: pos.y }}>
      <MapSelectionCard selection={selection} />
    </div>
  )
}

function MapSelectionCard({ selection }: { selection: MapSelection }) {
  const clear = () => useMapStore.getState().clearSelection()

  /* All store subscriptions up front — hook order never varies. */
  const spill = useSimulationStore((s) => s.spill)
  const vessel = useSimulationStore((s) =>
    selection.kind === 'vessel'
      ? s.vessels.find((v) => v.id === selection.id) ?? null
      : null,
  )
  const candidate = useSarStore((s) =>
    selection.kind === 'sar_candidate'
      ? s.candidates.find((c) => c.id === selection.id) ?? null
      : null,
  )
  const sarHead = useSarStore((s) => ({
    acquisitionTime: s.acquisitionTime,
    provenance: s.provenance,
  }))
  const stages = useInvestigationStore((s) => s.stages)
  const ranked = useMemo(() => stageRankedVessels(stages), [stages])
  const live = useConnectionStore((s) => s.connections.websocket === 'online')
  const setLayer = useMapStore((s) => s.setLayer)

  const close = (
    <button type="button" className="mm-pop-close" aria-label="Close popup" onClick={clear}>
      ×
    </button>
  )

  /* ---- SAR slick / observed spill ---- */
  if (selection.kind === 'spill' || selection.kind === 'slick' || selection.kind === 'sar_candidate') {
    const coord =
      selection.kind === 'sar_candidate' && candidate
        ? candidate.centroid
        : spill?.location ?? null
    const head =
      selection.kind === 'sar_candidate'
        ? `SLICK-${String(candidate?.id ?? '').slice(0, 16).toUpperCase() || 'TBD'}`
        : `SLICK-${String(spill?.spillEventId ?? '').slice(0, 16).toUpperCase() || 'TBD'}`
    const kindLabel = candidate
      ? `SAR · ${candidate.classification.replace('_', ' ')}`
      : 'Observed spill'
    const coordLabel = coord ? dms(coord.lat, coord.lon) : 'position unavailable'
    const regionName = coord ? regionFor(coord.lat, coord.lon) : null

    let body: ReactNode
    let footer: ReactNode = null

    if (candidate) {
      const sev = severityClass(candidate.confidence)
      body = (
        <>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Detected</span>
            <span className="mm-pop-v">{sarHead.acquisitionTime ?? sarHead.provenance ?? 'UNAVAILABLE'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Area</span>
            <span className="mm-pop-v">{candidate.areaKm2.toFixed(2)} km²</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Confidence</span>
            <span className="mm-pop-v">{(candidate.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Length</span>
            <span className="mm-pop-v">
              {candidate.lengthKm != null ? `${candidate.lengthKm.toFixed(1)} km` : '—'}
            </span>
          </div>
        </>
      )
      footer = (
        <>
          <span className={`mm-pop-badge ${sev.cls}`}>{sev.label}</span>
          <Link className="mm-pop-link" to="/investigation" onClick={clear}>
            Open full case →
          </Link>
        </>
      )
    } else if (spill?.location) {
      body = (
        <>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Released at</span>
            <span className="mm-pop-v">{spill.time ?? '—'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Oil type</span>
            <span className="mm-pop-v">{spill.oilType ?? '—'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Quantity</span>
            <span className="mm-pop-v">
              {spill.quantityKg != null ? `${spill.quantityKg.toLocaleString()} kg` : '—'}
            </span>
          </div>
        </>
      )
      footer = <span className="mm-pop-badge mm-pop-badge--med">OBSERVED</span>
    } else {
      body = <div className="mm-pop-empty">No observation data for this slick yet.</div>
    }

    return (
      <>
        {close}
        <div className="mm-pop-head" style={{ borderLeftColor: 'var(--c-sar)' }}>
          <div className="mm-sar-thumb" aria-hidden="true">
            <span>SAR</span>
            <em>preview n/a</em>
          </div>
          <div className="mm-pop-title">
            <div className="mm-pop-kind">{kindLabel}</div>
            <div className="mm-pop-name">{head}</div>
          </div>
        </div>
        <div className="mm-pop-body">
          <div className="mm-pop-row">
            <span className="mm-pop-k">Position</span>
            <span className="mm-pop-v mono">{coordLabel}</span>
          </div>
          {regionName ? (
            <div className="mm-pop-row">
              <span className="mm-pop-k">Region</span>
              <span className="mm-pop-v">{regionName}</span>
            </div>
          ) : null}
          {body}
        </div>
        {footer ? <div className="mm-pop-foot">{footer}</div> : null}
      </>
    )
  }

  /* ---- live simulation vessel ---- */
  if (selection.kind === 'vessel' && vessel) {
    const dist = spill?.location ? haversineKm(vessel.position, spill.location) : null
    return (
      <>
        {close}
        <div className="mm-pop-head mm-pop-head--vessel" style={{ borderLeftColor: 'var(--c-vessel)' }}>
          <div className="mm-pop-title">
            <div className="mm-pop-kind">{vessel.type || 'Vessel'}</div>
            <div className="mm-pop-name">{vessel.name}</div>
          </div>
        </div>
        <div className="mm-pop-body">
          <div className="mm-pop-row">
            <span className="mm-pop-k">Position</span>
            <span className="mm-pop-v mono">
              {dms(vessel.position.lat, vessel.position.lon)}
            </span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Region</span>
            <span className="mm-pop-v">{regionFor(vessel.position.lat, vessel.position.lon) ?? '—'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">MMSI</span>
            <span className="mm-pop-v mono">{vessel.mmsi || '—'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Speed</span>
            <span className="mm-pop-v">
              {vessel.speed != null ? `${vessel.speed.toFixed(1)} kn` : '—'}
            </span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Heading</span>
            <span className="mm-pop-v">
              {vessel.heading != null ? `${vessel.heading.toFixed(0)}°` : '—'}
            </span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">AIS status</span>
            <span className="mm-pop-v">{live ? 'live stream' : 'cached'}</span>
          </div>
          <div className="mm-pop-row">
            <span className="mm-pop-k">Dist. to slick</span>
            <span className="mm-pop-v">{dist != null ? `${dist.toFixed(1)} km` : '—'}</span>
          </div>
        </div>
        <div className="mm-pop-foot">
          <button
            type="button"
            className="mm-pop-btn"
            onClick={() => setLayer('vesselTrails', true)}
          >
            View track
          </button>
          <span className="mm-pop-badge mm-pop-badge--vessel">▲ VESSEL</span>
        </div>
      </>
    )
  }

  /* ---- ranked AIS candidate (attribution) ---- */
  if (selection.kind === 'ais_candidate') {
    const individual = ranked.find((c) => c.rank === (selection.rank ?? -1))
    if (individual?.name) {
      const pos = individual.closestPosition
      return (
        <>
          {close}
          <div className="mm-pop-head" style={{ borderLeftColor: 'var(--warn)' }}>
            <div className="mm-pop-title">
              <div className="mm-pop-kind">{`Candidate #${individual.rank}`}</div>
              <div className="mm-pop-name">{individual.name}</div>
            </div>
          </div>
          <div className="mm-pop-body">
            <div className="mm-pop-row">
              <span className="mm-pop-k">Position</span>
              <span className="mm-pop-v mono">
                {pos ? dms(pos.lat, pos.lon) : 'position unavailable'}
              </span>
            </div>
            {pos ? (
              <div className="mm-pop-row">
                <span className="mm-pop-k">Region</span>
                <span className="mm-pop-v">{regionFor(pos.lat, pos.lon) ?? '—'}</span>
              </div>
            ) : null}
            <div className="mm-pop-row">
              <span className="mm-pop-k">Score</span>
              <span className="mm-pop-v">
                {individual.score != null ? `${(individual.score * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="mm-pop-row">
              <span className="mm-pop-k">Closest approach</span>
              <span className="mm-pop-v">
                {individual.minDistanceKm != null ? `${individual.minDistanceKm.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div className="mm-pop-row">
              <span className="mm-pop-k">At</span>
              <span className="mm-pop-v mono">{individual.timeOfClosestApproach ?? '—'}</span>
            </div>
          </div>
          <div className="mm-pop-foot">
            <span className="mm-pop-badge mm-pop-badge--cand">RANKED CANDIDATE</span>
          </div>
        </>
      )
    }
  }

  return (
    <>
      {close}
      <div className="mm-pop-empty">No detail record for this selection.</div>
    </>
  )
}