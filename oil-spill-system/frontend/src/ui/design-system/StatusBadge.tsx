import React from 'react'
import { clsx } from 'clsx'

export type OperationalStatusTone = 'ok' | 'warn' | 'danger' | 'run' | 'idle'

const TONE_DOT_CLASSES: Record<OperationalStatusTone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  danger: 'bg-rose-500',
  run: 'bg-signal-blue',
  idle: 'bg-slate-500',
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: OperationalStatusTone
  children: React.ReactNode
}

/**
 * Operational execution status indicator (stage status, engine state).
 * Formatted cleanly with small text and an inline status dot per Master Brief §6.3 & §6.5.
 * Strictly avoids pill shapes (no container border, background fill, or rounded container)
 * and avoids monospace / typography for status words.
 */
export function StatusBadge({
  tone = 'idle',
  children,
  className,
  ...props
}: StatusBadgeProps) {
  const dotColor = TONE_DOT_CLASSES[tone] ?? TONE_DOT_CLASSES.idle

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs text-mist font-normal select-none',
        className,
      )}
      {...props}
    >
      <span className={clsx('w-1.5 h-1.5 rounded shrink-0', dotColor)} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
