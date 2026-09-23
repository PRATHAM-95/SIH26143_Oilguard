/**
 * Shared OilGuard brand lockup — pure presentation.
 *
 * Renders the mono wordmark + descriptor that anchors both the /welcome
 * chapter and the operational chrome. Deliberately dumb: it reads no
 * stores, hooks, or server state. Parents that want to surface a truthful
 * status pass a plain `statusLabel` string.
 *
 * This component never renders a status dot, animation, or implied-live
 * indicator. Decorative marks are supplied by the parent only.
 */
export interface BrandLockupProps {
  statusLabel?: string
  className?: string
}

export function BrandLockup({ statusLabel, className = '' }: BrandLockupProps) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`.trim()}>
      <span className="font-mono text-xs font-semibold tracking-widest text-foam uppercase">
        OILGUARD
      </span>
      <span className="text-dim text-xs" aria-hidden="true">
        /
      </span>
      <span className="font-mono text-[11px] text-dim tracking-wider hidden sm:inline">
        MARITIME FORENSIC INTELLIGENCE
      </span>
      {statusLabel ? (
        <span className="font-mono text-[10px] tracking-wider text-dim uppercase">
          {statusLabel}
        </span>
      ) : null}
    </span>
  )
}

export default BrandLockup