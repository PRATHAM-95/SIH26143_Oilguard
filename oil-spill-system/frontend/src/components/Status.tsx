import type { ReactNode } from 'react'

type Tone = 'ok' | 'warn' | 'danger' | 'run' | 'idle'

const dotClass: Record<Tone, string> = {
  ok: 'dot dot--ok',
  warn: 'dot dot--warn',
  danger: 'dot dot--danger',
  run: 'dot dot--running',
  idle: 'dot dot--idle',
}

/**
 * Status chip with a non-colour cue (dot + text) for accessibility:
 * status is never conveyed by colour alone.
 */
export function StatusChip({
  tone,
  label,
  children,
}: {
  tone: Tone
  label: string
  children?: ReactNode
}) {
  const chipClass =
    tone === 'ok'
      ? 'status-chip status-chip--ok'
      : tone === 'danger'
        ? 'status-chip status-chip--danger'
        : tone === 'warn'
          ? 'status-chip status-chip--warn'
          : tone === 'run'
            ? 'status-chip status-chip--run'
            : 'status-chip'

  return (
    <span className={chipClass} title={label}>
      <span aria-hidden="true" className={dotClass[tone]} />
      <span>{children ?? label}</span>
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