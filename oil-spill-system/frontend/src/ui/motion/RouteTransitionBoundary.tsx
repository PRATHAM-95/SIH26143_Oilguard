import React from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MOTION } from './tokens'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface RouteTransitionBoundaryProps {
  children: React.ReactNode
}

/**
 * RouteTransitionBoundary wraps the workstation Outlet with a restrained
 * opacity crossfade between workstation routes.
 *
 * Rules:
 * - Opacity only (no layout animation, no scale/drift)
 * - Restrained duration: ~180ms
 * - AnimatePresence mode="wait" ensures WebGL contexts do not overlap simultaneously
 * - /welcome -> / is NOT animated (welcome is outside Layout shell)
 * - Reduced motion renders plain children immediately
 */
export const RouteTransitionBoundary: React.FC<RouteTransitionBoundaryProps> = ({ children }) => {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()

  // Reduced motion: snap immediately, plain render without Motion wrapping
  if (reducedMotion) {
    return <>{children}</>
  }

  // /welcome is outside Layout, but safeguard against any /welcome paths
  if (location.pathname === '/welcome') {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.18,
          ease: MOTION.ease.out,
        }}
        className="w-full h-full flex-1 flex flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default RouteTransitionBoundary
