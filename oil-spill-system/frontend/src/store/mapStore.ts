import { create } from 'zustand'

/**
 * Layer registry — the catalogue of every map layer the product can render.
 * Each entry is independent so layers can be added or removed without touching
 * the map component. Visibility is gated per layer; the "Data & Layers" table
 * of contents reads labels / groups / availability from here, so the TOC can
 * never drift from the map palette.
 */
export type MapLayerId =
  | 'satellite'
  | 'slick'
  | 'vessels'
  | 'vesselTrails'
  | 'wind'
  | 'currents'
  | 'weather'
  | 'incidents'
  | 'backtracking'
  | 'sourceProbability'
  | 'uncertainty'
  | 'attribution'
  | 'sarSlicks'
  | 'sarFootprint'
  | 'shippingLanes'
  | 'drift'
  | 'eez'

export type LayerGroup = 'observation' | 'simulation' | 'environment' | 'analysis'

export type LayerVisibility = {
  visible: boolean
  /** Human label shown in the layer table of contents / legend. */
  label: string
  group: LayerGroup
  /** Legend swatch (CSS colour). Present = the layer carries a legend colour. */
  color?: string
  /** Why the user might see this layer — used by the legend footer. */
  note?: string
  /** Shown when a row is disabled because there is no data for it. */
  emptyNote?: string
}

export const LAYER_GROUP_LABEL: Record<LayerGroup, string> = {
  observation: 'Observation',
  simulation: 'Simulation',
  environment: 'Environment',
  analysis: 'Analysis',
}

export const LAYER_GROUP_ORDER: LayerGroup[] = ['observation', 'simulation', 'environment', 'analysis']

/** Colour swatches mirror styles/vsco.ts so the palette can never drift. */
export const MAP_LAYER_CATALOG: Record<MapLayerId, LayerVisibility> = {
  satellite: {
    visible: false,
    label: 'Satellite imagery',
    group: 'observation',
    color: '#4f6c83',
    note: 'Base reference imagery',
    emptyNote: 'No scene ingested — observation required',
  },
  slick: {
    visible: true,
    label: 'Observed spill point',
    group: 'simulation',
    color: '#ba6e30',
    note: 'App-level spill observation point',
  },
  vessels: {
    visible: true,
    label: 'Vessels',
    group: 'simulation',
    color: '#7ad4ff',
  },
  vesselTrails: {
    visible: false,
    label: 'Vessel tracks',
    group: 'simulation',
    color: '#3c6a8a',
    emptyNote: 'Tracks are recorded live as vessels move',
  },
  wind: {
    visible: false,
    label: 'Wind field',
    group: 'environment',
    color: '#8aa4bd',
    note: 'Synthetic demo grid in demo mode',
    emptyNote: 'ERA5 not connected — no live wind, never faked',
  },
  currents: {
    visible: false,
    label: 'Ocean currents',
    group: 'environment',
    color: '#4f8f9c',
    note: 'Synthetic demo grid in demo mode',
    emptyNote: 'CMEMS not connected — no live current, never faked',
  },
  weather: {
    visible: false,
    label: 'Live weather',
    group: 'environment',
    color: '#7ad4ff',
    note: 'Live wind & waves — Open-Meteo',
    emptyNote: 'Open-Meteo not connected — no live weather, never faked',
  },
  incidents: {
    visible: false,
    label: 'Live marine incidents',
    group: 'environment',
    color: '#ffb020',
    note: 'Real events — NASA EONET',
    emptyNote: 'No live marine incidents — EONET',
  },
  backtracking: {
    visible: false,
    label: 'Backtracking ensemble',
    group: 'analysis',
    color: '#58e0b9',
    note: 'Ensemble backward trajectories',
  },
  sourceProbability: {
    visible: false,
    label: 'Source confidence contours',
    group: 'analysis',
    color: '#f0c05a',
    note: '50 / 75 / 90% confidence contours',
  },
  uncertainty: {
    visible: false,
    label: 'Probable source region',
    group: 'analysis',
    color: '#f0c05a',
    note: 'Region, not a single point',
  },
  attribution: {
    visible: false,
    label: 'AIS candidate vessels',
    group: 'analysis',
    color: '#ffc85a',
    note: 'Ranked candidates, not confirmed ships of interest',
  },
  sarSlicks: {
    visible: false,
    label: 'Potential oil slick',
    group: 'observation',
    color: '#ff8a63',
    note: 'Detector classification, not ground truth',
  },
  sarFootprint: {
    visible: false,
    label: 'Satellite passes',
    group: 'observation',
    color: '#7fd3f7',
    note: 'Sentinel-1 pass tracks and scene footprint',
    emptyNote: 'No pass ingested — observation required',
  },
  shippingLanes: {
    visible: false,
    label: 'Shipping lanes',
    group: 'environment',
    color: '#93a7ba',
    note: 'Regional trade corridor network',
    emptyNote: 'No lane source connected — never faked',
  },
  drift: {
    visible: false,
    label: 'Forward drift',
    group: 'simulation',
    color: '#3aa896',
    note: 'Forward model output — simulated oil movement',
  },
  eez: {
    visible: false,
    label: 'EEZ boundaries',
    group: 'environment',
    color: '#5cb2d6',
    note: 'Maritime Boundaries & EEZ (v11, Marine Regions)',
    emptyNote: 'Not loaded — boundaries are fetched from Marine Regions on demand',
  },
}

export type MapViewState = {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

export type Bounds = [[number, number], [number, number]]

/**
 * Default operating extent — the Indian Ocean Region. Tuned so the opening
 * frame carries genuine maritime context rather than a coastal close-up: East
 * Africa and the Arabian Sea on the west, the Bay of Bengal, Sri Lanka, the
 * Maldives and into Southeast Asia on the east, with open ocean above and below
 * the subcontinent.
 */
export const DEFAULT_VIEW: MapViewState = {
  longitude: 72,
  latitude: 7,
  zoom: 3.6,
  pitch: 0,
  bearing: 0,
}

/* ------------------------------------------------------------------ */
/* Operating regions — bounds in [west, south] / [east, north] order.  */
/* ------------------------------------------------------------------ */

export type RegionId =
  | 'io'
  | 'arabian'
  | 'bengal'
  | 'persian'
  | 'east_africa'
  | 'seasia'

export type RegionDef = {
  id: RegionId
  label: string
  short: string
  /** Approximate operating box: [[westLon, southLat], [eastLon, northLat]]. */
  bounds: Bounds
  note?: string
}

export const REGIONS: RegionDef[] = [
  {
    id: 'arabian',
    label: 'Arabian Sea',
    short: 'AS',
    bounds: [[50, -5], [78, 26]],
    note: 'Western shelf of the Indian subcontinent',
  },
  {
    id: 'bengal',
    label: 'Bay of Bengal',
    short: 'BB',
    bounds: [[80, 6], [100, 24]],
  },
  {
    id: 'persian',
    label: 'Arabian Peninsula',
    short: 'PE',
    bounds: [[35, 12], [60, 30]],
  },
  {
    id: 'east_africa',
    label: 'East Africa',
    short: 'EA',
    bounds: [[30, -32], [52, 10]],
  },
  {
    id: 'seasia',
    label: 'Southeast Asia',
    short: 'SA',
    bounds: [[95, 0], [125, 28]],
  },
  {
    id: 'io',
    label: 'Indian Ocean',
    short: 'IO',
    bounds: [[30, -25], [110, 30]],
    note: 'Primary area of interest — 25.0°S–30.0°N, 30.0°E–110.0°E',
  },
]

export const REGION_BY_ID: Record<RegionId, RegionDef> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
) as Record<RegionId, RegionDef>

/** Human region name for a coordinate, or null when outside all regions. */
export function regionFor(lat: number, lon: number): string | null {
  for (const r of REGIONS) {
    const [[w, s], [e, n]] = r.bounds
    if (lat >= s && lat <= n && lon >= w && lon <= e) return r.label
  }
  return null
}

/**
 * Map object selection model. Workspace maps emit pickable deck.gl objects
 * through MapView's onSelect; the intelligence rail renders the matching detail
 * from the application stores.
 */
export type SelectionKind =
  | 'spill'
  | 'slick'
  | 'sar_candidate'
  | 'source_region'
  | 'origin'
  | 'vessel'
  | 'ais_candidate'

export type MapSelection = {
  kind: SelectionKind
  id?: string | null
  rank?: number | null
  mmsi?: string | null
  name?: string | null
}

type MapStoreState = {
  view: MapViewState
  visibility: Record<MapLayerId, boolean>
  ready: boolean
  selection: MapSelection | null
  /** Live cursor position in the map pane, for the coordinate readout. */
  cursor: { lon: number; lat: number } | null
  /** Bounds requested by pages to fit the area of interest. */
  fitBounds: Bounds | null
  /**
   * Active basemap — satellite imagery (default) or dark vector.
   * Imagery leads because the command center is an earth-observation product;
   * the dark vector remains available for label legibility over overlays.
   */
  basemap: 'dark' | 'satellite'
  /** Ambient process pulse (oil-slick emphasis), toggled by a driver. */
  pulse: boolean
  setView: (view: Partial<MapViewState>) => void
  toggleLayer: (id: MapLayerId) => void
  setLayer: (id: MapLayerId, visible: boolean) => void
  setReady: (ready: boolean) => void
  select: (selection: MapSelection | null) => void
  clearSelection: () => void
  setCursor: (cursor: { lon: number; lat: number } | null) => void
  requestFit: (bounds: Bounds) => void
  clearFit: () => void
  setBasemap: (basemap: 'dark' | 'satellite') => void
  setPulse: (pulse: boolean) => void
}

export const useMapStore = create<MapStoreState>((set) => ({
  view: { ...DEFAULT_VIEW },
  visibility: Object.fromEntries(
    Object.entries(MAP_LAYER_CATALOG).map(([id, l]) => [id, l.visible]),
  ) as Record<MapLayerId, boolean>,
  ready: false,
  selection: null,
  cursor: null,
  fitBounds: null,
  basemap: 'satellite',
  pulse: false,
  setView: (view) =>
    set((s) => ({ view: { ...s.view, ...view } })),
  toggleLayer: (id) =>
    set((s) => ({ visibility: { ...s.visibility, [id]: !s.visibility[id] } })),
  setLayer: (id, visible) =>
    set((s) => ({ visibility: { ...s.visibility, [id]: visible } })),
  setReady: (ready) => set({ ready }),
  select: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),
  setCursor: (cursor) => set({ cursor }),
  requestFit: (bounds) => set({ fitBounds: bounds }),
  clearFit: () => set({ fitBounds: null }),
  setBasemap: (basemap) => set({ basemap }),
  setPulse: (pulse) => set({ pulse }),
}))