import { useMemo } from 'react'
import { useSarStore } from '@/store/sarStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { SarProvenance } from '@/types/domain'

/**
 * Read-only derived data provenance for the shared header.
 *
 * Provenance describes the ORIGIN of the data being shown, not whether the
 * backend or WebSocket is reachable. Connection state is exposed separately by
 * the connection store and must never be surfaced as data provenance.
 *
 * This hook reads only store fields that explicitly describe data origin:
 *  - SAR observation provenance enum (`REAL_SENTINEL1` … `UNAVAILABLE`)
 *  - Investigation aggregation / conclusion provenance strings
 *  - Presence of a released spill event (controlled demo scenario) or a
 *    completed forward-drift run (model simulation output)
 *
 * When none of those provenance-bearing fields exist, the honest label is
 * "No data" rather than an inferred or optimistic value.
 */
export type DataProvenanceKind =
  | 'live'
  | 'controlled'
  | 'simulated'
  | 'unavailable'
  | 'no-data'

export type DataProvenance = {
  kind: DataProvenanceKind
  label: string
  toneClass: string
  dotClass: string
}

const LABELS: Record<DataProvenanceKind, { label: string; toneClass: string; dotClass: string }> = {
  live: { label: 'Live', toneClass: 'text-ok', dotClass: 'bg-ok' },
  controlled: { label: 'Controlled', toneClass: 'text-warn', dotClass: 'bg-warn' },
  simulated: { label: 'Simulated', toneClass: 'text-sonar', dotClass: 'bg-sonar' },
  unavailable: { label: 'Unavailable', toneClass: 'text-dim', dotClass: 'bg-slate-500' },
  'no-data': { label: 'No data', toneClass: 'text-dim', dotClass: 'bg-slate-500' },
}

function fromSarProvenance(provenance: SarProvenance | null): DataProvenanceKind | null {
  switch (provenance) {
    case 'REAL_SENTINEL1':
    case 'CACHED_SENTINEL1':
      return 'live'
    case 'LOCAL_FIXTURE':
      return 'controlled'
    case 'SYNTHETIC':
      return 'simulated'
    case 'UNAVAILABLE':
      return 'unavailable'
    default:
      return null
  }
}

function fromProvenanceString(value: string | null | undefined): DataProvenanceKind | null {
  if (!value) return null
  const v = value.toUpperCase()
  if (v.includes('REAL') || v.includes('LIVE') || v.includes('SENTINEL')) return 'live'
  if (v.includes('CONTROL') || v.includes('FIXTURE') || v.includes('DEMO')) return 'controlled'
  if (v.includes('SYNTH') || v.includes('SIMUL') || v.includes('MODEL')) return 'simulated'
  if (v.includes('UNAVAIL')) return 'unavailable'
  return null
}

export function useDataProvenance(): DataProvenance {
  const sarProvenance = useSarStore((s) => s.provenance)
  const aggregation = useInvestigationStore((s) => s.provenance?.aggregation ?? null)
  const conclusionProvenance = useInvestigationStore((s) => s.conclusion?.provenance ?? null)
  const spill = useSimulationStore((s) => s.spill)
  const driftParticles = useSimulationStore((s) => s.drift.particles.length)
  const driftExtentLength = useSimulationStore((s) => s.drift.extent?.length ?? 0)

  return useMemo(() => {
    const kind: DataProvenanceKind =
      fromSarProvenance(sarProvenance) ??
      fromProvenanceString(aggregation) ??
      fromProvenanceString(conclusionProvenance) ??
      (spill ? 'controlled' : null) ??
      (driftParticles > 0 || driftExtentLength > 0 ? 'simulated' : null) ??
      'no-data'
    return { kind, ...LABELS[kind] }
  }, [sarProvenance, aggregation, conclusionProvenance, spill, driftParticles, driftExtentLength])
}
