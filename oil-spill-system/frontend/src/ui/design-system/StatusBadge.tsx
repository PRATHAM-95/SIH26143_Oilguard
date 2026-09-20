import React from 'react'
import { clsx } from 'clsx'

export type OperationalStatusTone = 'ok' | 'warn' | 'danger' | 'run' | 'idle'

const TONE_DOT_CLASSES: Record<OperationalStatusTone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  danger: 'bg-rose-500',
  run: 'bg-cyan-400 animate-pulse',
  idle: 'bg-slate-500',
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: OperationalStatusTone
  children: React.ReactNode
}

/**
 * Operational execution status indicator (stage status, engine state).
 * Formatted cleanly with an inline status indicator rather than a capsule pill.
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
        'inline-flex items-center gap-1.5 text-xs text-mist font-mono uppercase tracking-wider',
        className,
      )}
      {...props}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
