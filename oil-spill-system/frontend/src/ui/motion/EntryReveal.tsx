import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { MOTION } from './tokens'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface EntryRevealProps {
  active?: boolean
  children: ReactNode
}

/**
 * One-shot "chapter entry" refinement for the /welcome -> / transition.
 *
 * Intentionally transform-only (a subtle `y: 4px -> 0` settle). It never
 * animates opacity — the existing RouteTransitionBoundary owns the fade — so
 * the two compose into a single coherent 300–500ms arrival instead of
 * stacking competing fades.
 *
 * `active` is latched once on mount so the reveal runs exactly once per
 * Layout mount, even after the caller clears navigation state. Reduced
 * motion renders children directly (instant, no animation, no rAF loop).
 */
export function EntryReveal({ active = false, children }: EntryRevealProps) {
  const [reveal] = useState(active)
  const reducedMotion = usePrefersReducedMotion()

  if (!reveal || reducedMotion) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ y: 4 }}
      animate={{ y: 0 }}
      transition={{ duration: MOTION.duration.layout, ease: MOTION.ease.out }}
    >
      {children}
    </motion.div>
  )
}

export default EntryReveal