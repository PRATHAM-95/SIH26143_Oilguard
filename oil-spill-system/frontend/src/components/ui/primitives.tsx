import type { ReactNode } from 'react'

/**
 * Shared display primitives for the operational workspace: provenance pills,
 * score bars, rank badges, and provenance-aware disclaimer notes. All status
 * is conveyed by text as well as colour (accessibility).

 */

const PROVENANCE_TIERS: { match: RegExp; tone: 'ok' | 'warn' | 'danger' | 'idle'; label: string }[] = [
  { match: /UNAVAILABLE|UNAVAIL|NONE/i, tone: 'danger', label: 'Unavailable' },
  { match: /REAL|CACHED|CMEMS|ERA5|SENTINEL/i, tone: 'ok', label: 'Real / cached' },
  { match: /LIVE|OPEN[- ]?METEO|ETOPO/i, tone: 'ok', label: 'Live / real' },
  { match: /MIXED|PARTIAL/i, tone: 'warn', label: 'Mixed / partial' },
  { match: /FIXTURE|SYNTHETIC|CONTROLLED|DEMO|SEEDED/i, tone: 'warn', label: 'Controlled / demo' },
]

/** Expand a provenance token into {label, tone} without pretending demo data is real. */
export function provenanceStatus(value: string | null | undefined): {
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'idle'
} {
  if (!value) return { label: 'Unspecified', tone: 'idle' }
  for (const tier of PROVENANCE_TIERS) {
    if (tier.match.test(value)) return { label: tier.label, tone: tier.tone }
  }
  return { label: value, tone: 'idle' }
}

export function ProvenancePill({
  value,
  full = false,
  label,
}: {
  value: string | null | undefined
  full?: boolean
  label?: string
}) {
  const { label: statusLabel, tone } = provenanceStatus(value)
  return (
    <span className={`pill pill--${tone}`} title={full ? (value ?? '') : statusLabel}>
      {label ? <span className="text-faint">{label}: </span> : null}
      {full && value ? value : statusLabel}
    </span>
  )
}

export function ScoreBar({
  label,
  value,
  display,
  tone = 'auto',
  weight,
}: {
  label: string
  value: number | null
  display?: string
  tone?: 'auto' | 'ok' | 'warn' | 'danger'
  weight?: number | null
}) {
  const pct = value != null ? Math.max(0, Math.min(1, value)) * 100 : 0
  const resolved: 'ok' | 'warn' | 'danger' =
    tone !== 'auto' ? tone : value != null ? (value >= 0.5 ? 'ok' : 'warn') : 'danger'
  return (
    <div className="score-row">
      <div className="score-label">
        <span>{label}</span>
        {weight != null ? <span className="score-weight">{(weight * 100).toFixed(0)}%</span> : null}
      </div>
      <div className="score-track" aria-hidden="true">
        <div className={`score-fill score-fill--${resolved}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="score-value">{display ?? (value != null ? `${(value * 100).toFixed(1)}%` : '—')}</span>
    </div>
  )
}

const RANK_COLOR_CLASS: Record<number, string> = {
  1: 'rank--1',
  2: 'rank--2',
  3: 'rank--3',
}

/** Small "#n" badge coloured by rank. Rank is a ranking, never a verdict. */
export function RankBadge({ rank }: { rank: number | null | undefined }) {
  if (rank == null) return <span className="rank-badge">#?</span>
  return <span className={`rank-badge ${RANK_COLOR_CLASS[rank] ?? 'rank--4'}`}>#{rank}</span>
}

/** Framed honesty note — used wherever a result could be over-read. */
export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="disclaimer">
      <span aria-hidden="true" style={{ marginRight: 6 }}>⚠</span>
      <span>{children}</span>
    </div>
  )
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mini-stat">
      <span className="mini-stat-label">{label}</span>
      <span className="mini-stat-value">{value ?? '—'}</span>
    </div>
  )
}

export function fmtLatLng(loc: { lon: number; lat: number } | null | undefined): string {
  if (!loc) return '—'
  return `${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°`
}

export function fmtTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace('.000Z', 'Z')
}

/** Operational tooltip wrapper providing instant zero-JS data-tooltip hover cues. */
export function Tooltip({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return (
    <span className={className} data-tooltip={text} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  )
}

/** Radar-sweep loading spinner */
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`loading-spinner ${className ?? ''}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

/** Shimmer skeleton for content loading */
export function Skeleton({
  width = '100%',
  height = '14px',
  className,
}: {
  width?: string | number
  height?: string | number
  className?: string
}) {
  return (
    <div
      className={`loading-shimmer ${className ?? ''}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

export type Column<T> = {
  header: string
  accessor: (item: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  width?: string
}

/** Standardized operational data table conforming to the Maritime Design System */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedId,
  onSelect,
  emptyMessage = 'No records available in this telemetry frame.',
}: {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  selectedId?: string | null
  onSelect?: (item: T) => void
  emptyMessage?: string
}) {
  if (!data || data.length === 0) {
    return (
      <div className="table-container">
        <table className="data-table">
          <tbody>
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  textAlign: col.align ?? 'left',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const key = keyExtractor(item)
            const isSelected = selectedId === key
            return (
              <tr
                key={key}
                className={isSelected ? 'table-row--selected selected' : ''}
                onClick={() => onSelect?.(item)}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              >
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    className={[
                      col.mono ? 'table-cell--mono' : '',
                      col.align === 'right' ? 'table-cell--numeric' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.accessor(item)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export type ErrorCategory = 'system' | 'unavailable' | 'action_required' | 'network'

const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  system: 'SYSTEM FAILURE',
  unavailable: 'DATA UNAVAILABLE',
  action_required: 'ACTION REQUIRED',
  network: 'TELEMETRY OFFLINE',
}

/** Operational error banner distinguishing failure categories with actionable remedy */
export function ErrorBanner({
  category = 'system',
  title,
  message,
  action,
  className,
}: {
  category?: ErrorCategory
  title?: string
  message: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`error-banner error-banner--${category} ${className ?? ''}`.trim()} role="alert">
      <div className="error-banner-lead">
        <span className="error-banner-badge">{ERROR_CATEGORY_LABELS[category]}</span>
        {title ? <span className="error-banner-title">{title}</span> : null}
      </div>
      <p className="error-banner-message">{message}</p>
      {action ? <div className="error-banner-action">{action}</div> : null}
    </div>
  )
}

/** Calm, honest computational progress display for active model / service jobs */
export function ProcessingBanner({
  title,
  subtitle,
  className,
}: {
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={`processing-banner ${className ?? ''}`.trim()} aria-live="polite">
      <Spinner size={16} />
      <div className="processing-banner-body">
        <span className="processing-banner-title">{title}</span>
        {subtitle ? <span className="processing-banner-sub">{subtitle}</span> : null}
      </div>
    </div>
  )
}