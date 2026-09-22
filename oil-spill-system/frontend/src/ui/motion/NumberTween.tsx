import React, { useEffect, useRef, useState } from 'react'
import { MOTION } from './tokens'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface NumberTweenProps {
  /** The target numeric value. Null or undefined indicates missing/unknown data. */
  value: number | null | undefined
  /** Optional formatter. Defaults to rounding to 1 decimal place if floating, or integer. */
  format?: (val: number) => string
  /** Placeholder text when value is null or undefined. Defaults to '—'. */
  placeholder?: string
  /** Duration of tween in seconds. Defaults to MOTION.duration.ui (0.22s). */
  duration?: number
  /** Optional CSS class name for styling. */
  className?: string
}

function defaultFormatter(val: number): string {
  if (Number.isInteger(val)) {
    return val.toLocaleString()
  }
  return Number(val.toFixed(1)).toLocaleString()
}

/**
 * Reusable presentational component for data-honest numeric transitions.
 *
 * Rules:
 * 1. null/undefined/no-data -> displays placeholder
 * 2. Never tweens from 0 when previous value is unknown
 * 3. First real value appears immediately without tweening
 * 4. Only tweens real value -> another real value
 * 5. Reduced motion snaps immediately
 * 6. rAF loop is active strictly while a real transition is running
 */
export const NumberTween: React.FC<NumberTweenProps> = ({
  value,
  format = defaultFormatter,
  placeholder = '—',
  duration = MOTION.duration.ui,
  className,
}) => {
  const reducedMotion = usePrefersReducedMotion()
  const isReal = typeof value === 'number' && !Number.isNaN(value)

  // Current display value
  const [displayValue, setDisplayValue] = useState<number | null>(() => (isReal ? value : null))

  // Track previous target value and current intermediate animated value
  const prevTargetRef = useRef<number | null>(isReal ? value : null)
  const currentValRef = useRef<number | null>(isReal ? value : null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    // Cancel any existing animation loop
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (!isReal) {
      // Missing or invalid value: immediately revert to placeholder state
      prevTargetRef.current = null
      currentValRef.current = null
      setDisplayValue(null)
      return
    }

    const targetVal = value as number
    const previousTarget = prevTargetRef.current

    if (previousTarget === null) {
      // First real value: Honesty Rule #3 - appear immediately, never tween from 0
      prevTargetRef.current = targetVal
      currentValRef.current = targetVal
      setDisplayValue(targetVal)
      return
    }

    if (previousTarget === targetVal) {
      // No change in value
      return
    }

    if (reducedMotion || duration <= 0) {
      // Reduced motion or zero duration: Honesty Rule #5 - snap immediately
      prevTargetRef.current = targetVal
      currentValRef.current = targetVal
      setDisplayValue(targetVal)
      return
    }

    // Tween from current intermediate value to new target
    const startVal = currentValRef.current ?? previousTarget
    const durationMs = duration * 1000
    const startTime = performance.now()
    prevTargetRef.current = targetVal

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      // Cubic ease-out: 1 - (1 - t)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const currentInterpolated = startVal + (targetVal - startVal) * easeProgress

      currentValRef.current = currentInterpolated
      setDisplayValue(currentInterpolated)

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step)
      } else {
        // Settled exactly at target
        currentValRef.current = targetVal
        setDisplayValue(targetVal)
        rafIdRef.current = null
      }
    }

    rafIdRef.current = requestAnimationFrame(step)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [value, isReal, duration, reducedMotion])

  if (displayValue === null) {
    return <span className={className}>{placeholder}</span>
  }

  return <span className={className}>{format(displayValue)}</span>
}

export default NumberTween
