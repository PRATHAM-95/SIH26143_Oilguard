/**
 * Design system tokens and semantic constants for the "Instrument at Sea" aesthetic.
 * All color values align with Tailwind CSS v4 @theme in index.css.
 */

export const TOKENS = {
  colors: {
    abyss: '#070B10',
    trench: '#0B1118',
    deck: '#111923',
    chartline: '#273340',
    foam: '#F8F7F4',
    porcelain: '#F8F7F4',
    mist: '#B2BBC5',
    dim: '#727D89',
    signalBlue: '#0057FF',
    accent: '#0057FF',
    sonar: '#0057FF',
    ok: '#00D98B',
    warn: '#FFB020',
    danger: '#FF4D5A',
  },
  gradientSheen:
    'linear-gradient(115deg, rgba(0, 87, 255, 0.25) 0%, rgba(248, 247, 244, 0.05) 100%)',
  fonts: {
    sans: "'Schibsted Grotesk Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "'Newsreader Variable', Georgia, serif",
    mono: "'JetBrains Mono Variable', Consolas, monospace",
  },
} as const

export type ProvenanceKind =
  | 'live'
  | 'controlled'
  | 'simulated'
  | 'awaiting'
  | 'uncalculated'
  | 'unavailable'
  | 'empty'

export const PROVENANCE_CONFIG: Record<
  ProvenanceKind,
  { label: string; dotColor: string; description: string }
> = {
  live: {
    label: 'Live',
    dotColor: 'bg-emerald-400',
    description: 'Real operational observation or active live data stream',
  },
  controlled: {
    label: 'Controlled (demo)',
    dotColor: 'bg-amber-400',
    description: 'Controlled demonstration scenario or synthetic injection in historical AIS',
  },
  simulated: {
    label: 'Simulated',
    dotColor: 'bg-cyan-400',
    description: 'Output from OpenDrift physical simulation models',
  },
  awaiting: {
    label: 'Awaiting acquisition',
    dotColor: 'bg-slate-500',
    description: 'Scheduled acquisition pending satellite or data provider capture',
  },
  uncalculated: {
    label: 'Not yet calculated',
    dotColor: 'bg-slate-500',
    description: 'Pending execution of antecedent investigation stages',
  },
  unavailable: {
    label: 'Unavailable',
    dotColor: 'bg-slate-500',
    description: 'External data source or provider currently unreachable',
  },
  empty: {
    label: 'No data',
    dotColor: 'bg-slate-500',
    description: 'Query executed successfully with zero records found in region',
  },
}
