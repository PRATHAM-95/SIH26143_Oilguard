import type { ReactNode } from 'react'

export type StatusTone = 'ok' | 'warn' | 'danger' | 'run' | 'idle'

export type SemanticStatus =
  | 'live'
  | 'healthy'
  | 'running'
  | 'awaiting'
  | 'complete'
  | 'completed'
  | 'failed'
  | 'offline'
  | 'no_data'
  | 'not_started'
  | 'idle'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'run'

const dotClass: Record<StatusTone, string> = {
  ok: 'dot dot--ok',
  warn: 'dot dot--warn',
  danger: 'dot dot--danger',
  run: 'dot dot--running',
  idle: 'dot dot--idle',
}

/** Resolves any domain status string into a strict 5-tone semantic palette. */
export function resolveStatusTone(status: string | null | undefined): StatusTone {
  if (!status) return 'idle'
  const s = status.toLowerCase().trim()
  if (['ok', 'healthy', 'live', 'complete', 'completed', 'online', 'available'].includes(s)) return 'ok'
  if (['run', 'running', 'simulating', 'processing'].includes(s)) return 'run'
  if (
    [
      'warn',
      'awaiting',
      'pending',
      'partial',
      'demo',
      'synthetic',
      'not_started',
      'unconfirmed',
      'no_data',
    ].includes(s)
  )
    return 'warn'
  if (['danger', 'failed', 'offline', 'unavailable', 'error', 'cancelled'].includes(s)) return 'danger'
  return 'idle'
}

/**
 * Status chip with a non-colour cue (dot + text) for accessibility:
 * status is never conveyed by colour alone.
 */
export function StatusChip({
  tone,
  status,
  label,
  size = 'md',
  className,
  children,
}: {
  tone?: StatusTone
  status?: SemanticStatus | string
  label?: string
  size?: 'sm' | 'md'
  className?: string
  children?: ReactNode
}) {
  const resolvedTone = tone ?? resolveStatusTone(status)
  const displayLabel = label ?? (typeof status === 'string' ? status.toUpperCase() : 'STATUS')

  const chipClass = [
    'status-chip',
    `status-chip--${resolvedTone}`,
    size === 'sm' ? 'status-chip--sm' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={chipClass} title={displayLabel}>
      <span aria-hidden="true" className={dotClass[resolvedTone]} />
      <span>{children ?? displayLabel}</span>
    </span>
  )
}

/** Text-only uptime/status block for the header. */
export function ConnectionStatus() {
  return (
    <span className="status-chip status-chip--ok">
      <span aria-hidden="true" className="dot dot--ok" />
      <span>API online</span>
    </span>
  )
}