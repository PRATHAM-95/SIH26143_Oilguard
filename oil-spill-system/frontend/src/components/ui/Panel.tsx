import type { ReactNode } from 'react'

export type PanelVariant = 'solid' | 'elevated' | 'glass'

export function Panel({
  title,
  kicker,
  icon,
  badge,
  right,
  children,
  footer,
  flush = false,
  variant = 'solid',
  className,
  style,
}: {
  title?: string
  kicker?: string
  icon?: ReactNode
  badge?: ReactNode
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
  flush?: boolean
  variant?: PanelVariant
  className?: string
  style?: React.CSSProperties
}) {
  const variantClass =
    variant === 'glass' ? 'panel--glass' : variant === 'elevated' ? 'panel--elevated' : ''

  return (
    <section className={`panel ${variantClass} ${className ?? ''}`.trim()} style={style}>
      {title || right || kicker || icon || badge ? (
        <header className="panel-head">
          <div className="panel-head-titles">
            {kicker ? <span className="eyebrow">{kicker}</span> : null}
            {title ? (
              <h2 className="panel-title">
                {icon ? <span className="panel-title-icon" aria-hidden="true">{icon}</span> : null}
                <span>{title}</span>
                {badge ? <span className="panel-title-badge">{badge}</span> : null}
              </h2>
            ) : <span />}
          </div>
          {right}
        </header>
      ) : null}
      <div className={flush ? 'panel-body panel-body--flush' : 'panel-body'}>{children}</div>
      {footer ? <footer className="panel-footer">{footer}</footer> : null}
    </section>
  )
}

export function KeyValue({
  label,
  value,
  mono = true,
  hint,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  hint?: string
}) {
  return (
    <div className="kv" title={hint}>
      <span className="kv-label">{label}</span>
      <span className={`kv-value ${mono ? 'text-mono' : ''}`.trim()}>{value ?? '—'}</span>
    </div>
  )
}

export function EmptyState({
  title,
  label,
  hint,
  description,
  action,
  icon,
  className,
}: {
  title?: string
  label?: string
  hint?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  const heading = title ?? label ?? 'No data available'
  const explanation = description ?? hint

  return (
    <div className={`empty-state ${className ?? ''}`.trim()}>
      {icon ? <div className="empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <div className="empty-state-content">
        <h4 className="empty-state-title">{heading}</h4>
        {explanation ? <p className="empty-state-desc">{explanation}</p> : null}
        {action ? <div className="empty-state-action">{action}</div> : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  value,
  hint,
  error,
}: {
  label: string
  value?: ReactNode
  hint?: string
  error?: string
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {value != null ? <span className="field-value">{value}</span> : null}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}

export function Callout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`callout ${className ?? ''}`.trim()}>{children}</div>
}

export function Alert({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`alert ${className ?? ''}`.trim()}>{children}</div>
}

export function LoadingState({ label = 'Processing telemetry...' }: { label?: string }) {
  return (
    <div className="empty" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
      <span className="loading-spinner" aria-hidden="true" />
      <span className="text-secondary">{label}</span>
    </div>
  )
}