/**
 * Design system tokens and semantic constants for the "Instrument at Sea" aesthetic.
 * All color values align with Tailwind CSS v4 @theme in index.css.
 */

export const TOKENS = {
  colors: {
    abyss: '#050B14',
    trench: '#0B1A2B',
    deck: '#122336',
    chartline: '#1E3550',
    foam: '#E8F0F7',
    mist: '#9DB2C8',
    dim: '#5F7690',
    sonar: '#4FD1E8',
    ok: '#3DD68C',
    warn: '#F2B84B',
    danger: '#F0616D',
  },
  gradientSheen:
    'linear-gradient(115deg, #7B61FF 0%, #2DD4BF 38%, #F2C14E 68%, #EF6461 100%)',
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
