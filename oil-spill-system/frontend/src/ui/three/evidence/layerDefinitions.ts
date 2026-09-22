/**
 * Layer definitions for OilGuard M7 Exploded Evidence Stack.
 * Represents one maritime incident across 9 forensic evidence layers (ordered bottom to top, index 0 to 8).
 */

export interface EvidenceLayerDef {
  id: string
  index: number // 0 (bottom) to 8 (top)
  numberStr: string
  title: string
  descriptor: string
  accentColor: string
  defaultProvenance: string
  isAvailableInStore: boolean
  provenanceTone: 'ok' | 'warn' | 'sonar' | 'dim' | 'danger'
}

export const EVIDENCE_LAYERS: EvidenceLayerDef[] = [
  {
    id: 'sar',
    index: 0,
    numberStr: '01',
    title: 'SATELLITE / SAR SCENE',
    descriptor: 'Radar Backscatter Footprint',
    accentColor: '#00d98b', // Green detection
    defaultProvenance: 'LIVE',
    isAvailableInStore: true,
    provenanceTone: 'ok',
  },
  {
    id: 'slick',
    index: 1,
    numberStr: '02',
    title: 'OIL SLICK MASK',
    descriptor: 'Surface Hydrocarbon Delineation',
    accentColor: '#ffb020', // Amber sheen
    defaultProvenance: 'SIMULATED',
    isAvailableInStore: true,
    provenanceTone: 'warn',
  },
  {
    id: 'wind',
    index: 2,
    numberStr: '03',
    title: 'WIND FIELD',
    descriptor: 'Atmospheric Forcing',
    accentColor: '#727d89', // Dim slate
    defaultProvenance: 'NOT YET CALCULATED',
    isAvailableInStore: false,
    provenanceTone: 'dim',
  },
  {
    id: 'currents',
    index: 3,
    numberStr: '04',
    title: 'OCEAN CURRENTS',
    descriptor: 'Hydrodynamic Circulation',
    accentColor: '#727d89', // Dim slate
    defaultProvenance: 'NOT YET CALCULATED',
    isAvailableInStore: false,
    provenanceTone: 'dim',
  },
  {
    id: 'drift',
    index: 4,
    numberStr: '05',
    title: 'FORWARD DRIFT',
    descriptor: 'Lagrangian Particle Dispersion',
    accentColor: '#00d98b', // Sonar/green
    defaultProvenance: 'SIMULATED',
    isAvailableInStore: true,
    provenanceTone: 'ok',
  },
  {
    id: 'backtracking',
    index: 5,
    numberStr: '06',
    title: 'BACKTRACKING ENSEMBLE',
    descriptor: 'Reverse Trajectory Fan',
    accentColor: '#0057ff', // Signal blue
    defaultProvenance: 'SIMULATED',
    isAvailableInStore: true,
    provenanceTone: 'sonar',
  },
  {
    id: 'ais',
    index: 6,
    numberStr: '07',
    title: 'AIS VESSEL TRACKS',
    descriptor: 'Transit Track / Interrogation Locus',
    accentColor: '#727d89', // Dim slate
    defaultProvenance: 'UNAVAILABLE',
    isAvailableInStore: false,
    provenanceTone: 'dim',
  },
  {
    id: 'source',
    index: 7,
    numberStr: '08',
    title: 'PROBABLE SOURCE REGION',
    descriptor: 'Reverse-Drift Probability Contours',
    accentColor: '#ffb020', // Amber contour
    defaultProvenance: 'CALCULATED',
    isAvailableInStore: true,
    provenanceTone: 'warn',
  },
  {
    id: 'attribution',
    index: 8,
    numberStr: '09',
    title: 'ATTRIBUTION MARKER',
    descriptor: 'Ranked Vessel Target / Resolution',
    accentColor: '#0057ff', // Signal blue / target
    defaultProvenance: 'CORRELATED',
    isAvailableInStore: true,
    provenanceTone: 'sonar',
  },
]

export const LAYER_COUNT = EVIDENCE_LAYERS.length
