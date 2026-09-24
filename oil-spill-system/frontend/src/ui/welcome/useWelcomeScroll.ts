import { useEffect, useRef, useState, useCallback } from 'react'
import type { MutableRefObject } from 'react'

/**
 * Single-owner Welcome scroll model.
 *
 * One passive native scroll listener writes RAW progress into a ref; a single
 * requestAnimationFrame driver derives the eased scene frame each rAF and writes
 * it into `scrollRef.current`. React state only changes when `activeSection`
 * actually changes. The 3D scene reads `scrollRef.current` imperatively from its
 * own frame callbacks — no per-scroll React re-renders, no object churn.
 */

export interface SceneScrollFrame {
  progress: number
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  vesselOpacity: number
  sheenOpacity: number
  reconstructionOpacity: number
}

export type WelcomeScrollRef = MutableRefObject<SceneScrollFrame>

export type ParallaxListener = (progress: number) => void

/**
 * SINGLE SOURCE OF TRUTH for the 5-section choreography.
 * Chapter-jump targets, narrative section flips and camera arrivals all align
 * to these progress boundaries.
 */
export const WELCOME_SECTION_POSITIONS = [0.0, 0.22, 0.44, 0.68, 0.95] as const

interface CameraKeyframe {
  pos: [number, number, number]
  target: [number, number, number]
  vesselOpacity: number
  sheenOpacity: number
  reconstructionOpacity: number
}

// Keyframes pinned to the section boundaries so the camera arrives exactly as the
// chapter activates. The trailing 1.00 keyframe settles the final pose for the
// Enter section without any further travel.
const KEYFRAMES: { at: number; frame: CameraKeyframe }[] = [
  {
    at: 0.0, // Scene 01: Ocean vastness
    frame: {
      pos: [0, 22, 42],
      target: [0, 1, 0],
      vesselOpacity: 0.35,
      sheenOpacity: 0.0,
      reconstructionOpacity: 0.0,
    },
  },
  {
    at: 0.22, // Scene 02: Vessel discovery
    frame: {
      pos: [14, 8, 18],
      target: [0, 2.2, 0],
      vesselOpacity: 1.0,
      sheenOpacity: 0.0,
      reconstructionOpacity: 0.0,
    },
  },
  {
    at: 0.44, // Scene 03: Spill inspection
    frame: {
      pos: [-5, 4.2, -3],
      target: [-2, 0.4, -11],
      vesselOpacity: 1.0,
      sheenOpacity: 1.0,
      reconstructionOpacity: 0.0,
    },
  },
  {
    at: 0.68, // Scene 04: Tactical reconstruction
    frame: {
      pos: [-12, 26, 8],
      target: [-5, 0, -12],
      vesselOpacity: 0.85,
      sheenOpacity: 0.8,
      reconstructionOpacity: 1.0,
    },
  },
  {
    at: 0.95, // Scene 05: Operational horizon & Command Center CTA
    frame: {
      pos: [0, 18, 28],
      target: [0, 1.5, -3],
      vesselOpacity: 0.95,
      sheenOpacity: 0.75,
      reconstructionOpacity: 0.85,
    },
  },
  {
    at: 1.0, // Final settle — identical to Scene 05 pose (deliberate rest window)
    frame: {
      pos: [0, 18, 28],
      target: [0, 1.5, -3],
      vesselOpacity: 0.95,
      sheenOpacity: 0.75,
      reconstructionOpacity: 0.85,
    },
  },
]

// Smooth sinusoidal cubic easing between keyframes
function easeSmooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function deriveFrame(clamped: number): SceneScrollFrame {
  let k0 = KEYFRAMES[0]
  let k1 = KEYFRAMES[1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (clamped >= KEYFRAMES[i].at && clamped <= KEYFRAMES[i + 1].at) {
      k0 = KEYFRAMES[i]
      k1 = KEYFRAMES[i + 1]
      break
    }
  }

  const segmentSpan = k1.at - k0.at
  const tRaw = segmentSpan > 0 ? (clamped - k0.at) / segmentSpan : 0
  const t = easeSmooth(tRaw)

  return {
    progress: clamped,
    cameraPosition: lerp3(k0.frame.pos, k1.frame.pos, t),
    cameraTarget: lerp3(k0.frame.target, k1.frame.target, t),
    vesselOpacity: lerp(k0.frame.vesselOpacity, k1.frame.vesselOpacity, t),
    sheenOpacity: lerp(k0.frame.sheenOpacity, k1.frame.sheenOpacity, t),
    reconstructionOpacity: lerp(
      k0.frame.reconstructionOpacity,
      k1.frame.reconstructionOpacity,
      t
    ),
  }
}

function getActiveSection(progress: number): number {
  const p = Math.max(0, Math.min(1, progress))
  for (let i = WELCOME_SECTION_POSITIONS.length - 1; i >= 0; i--) {
    if (p >= WELCOME_SECTION_POSITIONS[i]) return i
  }
  return 0
}

export interface WelcomeScrollModel {
  scrollRef: WelcomeScrollRef
  activeSection: number
  /** Register a per-frame progress listener (no React re-renders). Returns unsubscribe. */
  subscribeParallax: (listener: ParallaxListener) => () => void
}

export function useWelcomeScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  reducedMotion = false
): WelcomeScrollModel {
  const scrollRef = useRef<SceneScrollFrame>({ ...deriveFrame(0) })

  const [activeSection, setActiveSection] = useState<number>(0)

  const rawProgressRef = useRef(0)
  const lastHandledProgressRef = useRef(-1)
  const rafRef = useRef<number>(0)
  const parallaxListenersRef = useRef<Set<ParallaxListener>>(new Set())

  useEffect(() => {
    if (reducedMotion) {
      // High-quality static perspective for accessibility / reduced motion
      scrollRef.current = {
        progress: 0,
        cameraPosition: [12, 12, 22],
        cameraTarget: [0, 2, 0],
        vesselOpacity: 1.0,
        sheenOpacity: 0.85,
        reconstructionOpacity: 0.8,
      }
      rawProgressRef.current = 0
      lastHandledProgressRef.current = 0
      setActiveSection(0)
      return
    }

    const container = containerRef.current
    if (!container) return

    // Sole scroll owner: passive native listener writes raw progress to a ref.
    const handleScroll = () => {
      const maxScroll = container.scrollHeight - window.innerHeight
      if (maxScroll <= 0) return
      rawProgressRef.current = Math.max(
        0,
        Math.min(1, window.scrollY / maxScroll)
      )
    }

    // Single rAF driver: derive eased frame once per animation frame.
    // Skips work entirely when raw progress has not changed (idle).
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const raw = rawProgressRef.current
      if (raw === lastHandledProgressRef.current) return
      lastHandledProgressRef.current = raw

      scrollRef.current = deriveFrame(raw)

      const section = getActiveSection(raw)
      setActiveSection(section)

      parallaxListenersRef.current.forEach((listener) => listener(raw))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Sync initial scroll position
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef, reducedMotion])

  const subscribeParallax = useCallback((listener: ParallaxListener): (() => void) => {
    parallaxListenersRef.current.add(listener)
    return () => {
      parallaxListenersRef.current.delete(listener)
    }
  }, [])

  return { scrollRef, activeSection, subscribeParallax }
}