import { create } from 'zustand'
import { useMapStore, type Bounds } from '@/store/mapStore'

export type EezStatus = 'idle' | 'loading' | 'available' | 'failed'

/**
 * Exclusive Economic Zone boundaries — streamed from the Marine Regions /
 * VLIZ "Maritime Boundaries and Exclusive Economic Zones (200NM), v11"
 * dataset, served as GeoJSON by a public Esri ArcGIS feature service and
 * simplified server-side (`maxAllowableOffset`) to keep the payload small.
 *
 * Honesty: this is a real, attributed public dataset. If it cannot be
 * fetched the status stays `failed` and the layer reports "no data" — it is
 * never faked.
 */
type EezStoreState = {
  status: EezStatus
  /** Simplified boundary polylines as [lon, lat] rings, ready for deck.gl. */
  lines: [number, number][][]
  featureCount: number
  error: string | null
  attribution: string
  load: (bounds?: Bounds) => Promise<void>
}

const IOR_BOUNDS: Bounds = [
  [30, -30],
  [110, 32],
]

const SERVICE =
  'https://services3.arcgis.com/2LJ6Q6yCIIUOP8qx/arcgis/rest/services/eez_boundaries_v11_adj/FeatureServer/0/query'

function boundsQuery(bounds: Bounds): string {
  const [[w, s], [e, n]] = bounds
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    geometry: `${w},${s},${e},${n}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    maxAllowableOffset: '0.02',
    f: 'geojson',
  })
  return `${SERVICE}?${params.toString()}`
}

function extractLines(geometry: unknown): [number, number][] {
  if (!geometry || typeof geometry !== 'object') return []
  const g = geometry as { type: string; coordinates?: unknown }
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return (g.coordinates as [number, number][]).map(([lon, lat]) => [lon, lat])
  }
  if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
    const parts: [number, number][] = []
    for (const ring of g.coordinates as [number, number][][]) {
      for (const [lon, lat] of ring) parts.push([lon, lat])
    }
    return parts
  }
  return []
}

export const useEezStore = create<EezStoreState>((set, get) => ({
  status: 'idle',
  lines: [],
  featureCount: 0,
  error: null,
  attribution:
    'Marine Regions / VLIZ — Maritime Boundaries and EEZ (200NM), version 11',

  load: async (bounds = IOR_BOUNDS) => {
    if (get().status === 'loading') return
    set({ status: 'loading', error: null })
    try {
      const res = await fetch(boundsQuery(bounds), { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`EEZ service responded ${res.status}`)
      const json = (await res.json()) as {
        features?: { geometry?: unknown }[]
      }
      const lines: [number, number][][] = []
      for (const f of json.features ?? []) {
        const ring = extractLines(f.geometry)
        if (ring.length >= 2) lines.push(ring)
      }
      if (lines.length === 0) throw new Error('EEZ service returned no boundaries for this region')
      set({ status: 'available', lines, featureCount: lines.length })
      useMapStore.getState().setLayer('eez', true)
    } catch (e) {
      set({
        status: 'failed',
        error: e instanceof Error ? e.message : 'EEZ fetch failed',
      })
    }
  },
}))