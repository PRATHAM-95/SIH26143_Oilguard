import React from 'react'
import { PROVENANCE_CONFIG, type ProvenanceKind } from './tokens'
import { clsx } from 'clsx'

export interface ProvenanceLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: ProvenanceKind
  /** Optional custom text override; defaults to official provenance label */
  text?: string
  /** If true, shows a tooltip-style title explaining the data provenance */
  showDescription?: boolean
}

/**
 * Renders data provenance in accordance with Amendment 1:
 * Small clean text with an inline status dot.
 * Never rendered as a pill, chip, or rounded box.
 */
export function ProvenanceLabel({
  kind,
  text,
  showDescription = true,
  className,
  ...props
}: ProvenanceLabelProps) {
  const config = PROVENANCE_CONFIG[kind] ?? PROVENANCE_CONFIG.empty
  const label = text ?? config.label

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs text-mist font-normal select-none',
        className,
      )}
      title={showDescription ? `${label} — ${config.description}` : undefined}
      {...props}
    >
      <span
        className={clsx('w-1.5 h-1.5 rounded shrink-0', config.dotColor)}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}
