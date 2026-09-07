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
  | 'backtracking'
  | 'sourceProbability'
  | 'uncertainty'
  | 'attribution'
  | 'sarSlicks'
  | 'sarFootprint'
  | 'drift'

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
    visible: false,
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
    emptyNote: 'ERA5 not connected — no data, never faked',
  },
  currents: {
    visible: false,
    label: 'Ocean currents',
    group: 'environment',
    color: '#4f8f9c',
    emptyNote: 'CMEMS not connected — no data, never faked',
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
    label: 'SAR scene coverage',
    group: 'observation',
    color: '#60a5cd',
  },
  drift: {
    visible: false,
    label: 'Forward drift',
    group: 'simulation',
    color: '#3aa896',
    note: 'Forward model output — simulated oil movement',
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

/** Default target for the western Indian Ocean demonstration region. */
export const DEFAULT_VIEW: MapViewState = {
  longitude: 72.4,
  latitude: 14.5,
  zoom: 5.6,
  pitch: 0,
  bearing: 0,
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
  setView: (view: Partial<MapViewState>) => void
  toggleLayer: (id: MapLayerId) => void
  setLayer: (id: MapLayerId, visible: boolean) => void
  setReady: (ready: boolean) => void
  select: (selection: MapSelection | null) => void
  clearSelection: () => void
  setCursor: (cursor: { lon: number; lat: number } | null) => void
  requestFit: (bounds: Bounds) => void
  clearFit: () => void
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
}))