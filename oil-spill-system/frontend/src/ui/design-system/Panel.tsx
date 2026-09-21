import React from 'react'
import { clsx } from 'clsx'

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  headerActions?: React.ReactNode
  variant?: 'trench' | 'deck' | 'glass'
}

/**
 * Structural surface for forensic intelligence workstations.
 * Uses restrained hairlines and tonal depth, avoiding heavy drop shadows.
 */
export function Panel({
  title,
  subtitle,
  headerActions,
  variant = 'trench',
  className,
  children,
  ...props
}: PanelProps) {
  const bgClass =
    variant === 'deck'
      ? 'bg-deck'
      : variant === 'glass'
      ? 'bg-trench'
      : 'bg-trench'

  return (
    <div
      className={clsx(
        'border border-chartline rounded-sm overflow-hidden flex flex-col',
        bgClass,
        className,
      )}
      {...props}
    >
      {title || headerActions ? (
        <div className="flex items-center justify-between px-3 py-2 border-b border-chartline min-h-[36px] select-none bg-trench/40">
          <div className="flex flex-col">
            {title ? (
              <span className="text-xs font-semibold text-foam tracking-wide font-sans">
                {title}
              </span>
            ) : null}
            {subtitle ? (
              <span className="text-[10px] text-mist font-normal font-sans">{subtitle}</span>
            ) : null}
          </div>
          {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className="p-3 flex-1 overflow-auto">{children}</div>
    </div>
  )
}
