import type { ReactNode } from 'react'

export function Panel({
  title,
  right,
  children,
  flush = false,
  className,
  style,
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section className={`panel ${className ?? ''}`} style={style}>
      {title || right ? (
        <header className="panel-head">
          {title ? <h2 className="panel-title">{title}</h2> : <span />}
          {right}
        </header>
      ) : null}
      <div className={flush ? 'panel-body panel-body--flush' : 'panel-body'}>{children}</div>
    </section>
  )
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value ?? '—'}</span>
    </div>
  )
}

export function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="empty-label">{label}</span>
      {hint ? <span className="text-faint">{hint}</span> : null}
    </div>
  )
}

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value ?? '—'}</span>
    </div>
  )
}