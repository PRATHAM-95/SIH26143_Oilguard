import React from 'react'
import { clsx } from 'clsx'

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT SECTION — structural wrapper, NOT a card.
 * Uses hairline dividers and generous whitespace instead of box containers.
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportSection({
  id,
  number,
  title,
  children,
  className,
  variant = 'standard',
}: {
  id: string
  number?: string
  title: string
  children: React.ReactNode
  className?: string
  variant?: 'standard' | 'hero' | 'conclusion' | 'appendix'
}) {
  return (
    <section
      id={id}
      className={clsx(
        'report-section',
        variant === 'hero' && 'report-section--hero',
        variant === 'conclusion' && 'report-section--conclusion',
        variant === 'appendix' && 'report-section--appendix',
        className,
      )}
    >
      {variant !== 'hero' && (
        <div className="report-section__header">
          {number && (
            <span className="report-section__number">{number}</span>
          )}
          <h2 className="report-section__title">{title}</h2>
        </div>
      )}
      <div className="report-section__body">{children}</div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT METRIC — single key measurement with label + unit
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportMetric({
  label,
  value,
  unit,
  mono = false,
  className,
}: {
  label: string
  value: string | number | null | undefined
  unit?: string
  mono?: boolean
  className?: string
}) {
  const display = value == null || value === '' ? '—' : String(value)
  return (
    <div className={clsx('report-metric', className)}>
      <dt className="report-metric__label">{label}</dt>
      <dd className={clsx('report-metric__value', mono && 'font-mono')}>
        {display}
        {unit && value != null && value !== '' && (
          <span className="report-metric__unit">{unit}</span>
        )}
      </dd>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT METRIC GRID — arranges metrics in a responsive grid
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportMetricGrid({
  children,
  columns = 3,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}) {
  const colClass =
    columns === 2
      ? 'grid-cols-2'
      : columns === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3'
  return <dl className={clsx('report-metric-grid grid gap-x-8 gap-y-4', colClass)}>{children}</dl>
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT TABLE — editorial forensic table (hairlines, no pills)
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportTable({
  columns,
  rows,
  caption,
}: {
  columns: { key: string; label: string; mono?: boolean; align?: 'left' | 'right' | 'center' }[]
  rows: Record<string, React.ReactNode>[]
  caption?: string
}) {
  if (rows.length === 0) {
    return <ReportEmpty label="No data available" />
  }
  return (
    <figure className="report-figure">
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'report-table__th',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="report-table__row">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'report-table__td',
                      col.mono && 'font-mono',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                  >
                    {row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <figcaption className="report-figure__caption">{caption}</figcaption>}
    </figure>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT FIGURE — captioned analytical figure / map plate
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportFigure({
  title,
  description,
  provenance,
  timeRef,
  children,
  className,
}: {
  title: string
  description?: string
  provenance?: string
  timeRef?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <figure className={clsx('report-figure', className)}>
      <div className="report-figure__content">{children}</div>
      <figcaption className="report-figure__caption">
        <strong className="report-figure__caption-title">{title}</strong>
        {description && <span className="report-figure__caption-desc">{description}</span>}
        <span className="report-figure__caption-meta">
          {provenance && <span>Source: {provenance}</span>}
          {timeRef && <span>Reference: {timeRef}</span>}
        </span>
      </figcaption>
    </figure>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT EMPTY — honest empty / unavailable / not-yet-calculated state
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportEmpty({
  label = 'Not available',
  hint,
}: {
  label?: string
  hint?: string
}) {
  return (
    <div className="report-empty">
      <span className="report-empty__label">{label}</span>
      {hint && <span className="report-empty__hint">{hint}</span>}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT NARRATIVE — editorial prose block (Newsreader)
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportNarrative({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={clsx('report-narrative', className)}>{children}</div>
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT PROVENANCE TAG — inline provenance indicator
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportProvenance({ value }: { value: string | null | undefined }) {
  if (!value) return null
  const normalized = value.toLowerCase()
  const colorClass =
    normalized === 'live' || normalized === 'real_sentinel1'
      ? 'text-ok'
      : normalized.includes('controlled') ||
          normalized.includes('demo') ||
          normalized.includes('fixture') ||
          normalized.includes('local_fixture')
        ? 'text-warn'
        : normalized.includes('simulated') ||
            normalized.includes('synthetic') ||
            normalized.includes('model')
          ? 'text-signal-blue'
          : 'text-dim'
  return (
    <span className={clsx('report-provenance', colorClass)}>
      {value}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * REPORT DIVIDER — subtle section break
 * ──────────────────────────────────────────────────────────────────────────── */

export function ReportDivider() {
  return <hr className="report-divider" />
}
