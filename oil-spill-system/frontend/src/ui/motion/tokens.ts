/**
 * Standardized motion tokens for the OilGuard interface (MASTER_BRIEF §9).
 * Premium feel: snappy, decisive, never sluggish.
 */

export const MOTION = {
  duration: {
    micro: 0.12,     // 120ms: hover, focus rings, status dot transitions
    ui: 0.22,        // 220ms: dropdowns, drawer slide, tab switches, tooltips
    layout: 0.38,    // 380ms: panel collapse/expand, flightpath progression
    cinematic: 0.85, // 850ms: scene camera sweeps on /welcome
  },
  ease: {
    out: [0.16, 1, 0.3, 1],       // standard decisive ease-out
    inOut: [0.65, 0, 0.35, 1],    // smooth bidirectional layout transitions
    spring: { damping: 26, stiffness: 220 }, // micro-spring without bounce
  },
} as const

/**
 * Checks if the user operating system preference requests reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
