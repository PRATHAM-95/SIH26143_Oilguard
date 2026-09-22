import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface SceneScrollState {
  progress: number
  activeSection: number
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  vesselOpacity: number
  sheenOpacity: number
  reconstructionOpacity: number
}

// Keyframe definition for smooth scroll interpolation
interface CameraKeyframe {
  pos: [number, number, number]
  target: [number, number, number]
  vesselOpacity: number
  sheenOpacity: number
  reconstructionOpacity: number
}

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
    at: 0.18, // Transition to Scene 02: Vessel discovery
    frame: {
      pos: [14, 8, 18],
      target: [0, 2.2, 0],
      vesselOpacity: 1.0,
      sheenOpacity: 0.0,
      reconstructionOpacity: 0.0,
    },
  },
  {
    at: 0.38, // Transition to Scene 03: Spill inspection
    frame: {
      pos: [-5, 4.2, -3],
      target: [-2, 0.4, -11],
      vesselOpacity: 1.0,
      sheenOpacity: 1.0,
      reconstructionOpacity: 0.0,
    },
  },
  {
    at: 0.62, // Transition to Scene 04: Tactical reconstruction
    frame: {
      pos: [-12, 26, 8],
      target: [-5, 0, -12],
      vesselOpacity: 0.85,
      sheenOpacity: 0.8,
      reconstructionOpacity: 1.0,
    },
  },
  {
    at: 1.0, // Scene 05: Operational horizon & Command Center CTA
    frame: {
      pos: [0, 18, 28],
      target: [0, 1.5, -3],
      vesselOpacity: 0.95,
      sheenOpacity: 0.75,
      reconstructionOpacity: 0.85,
    },
  },
]

// Helper for linear interpolation between two 3D vectors
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

function getActiveSection(progress: number): number {
  if (progress >= 0.82) return 4
  if (progress >= 0.58) return 3
  if (progress >= 0.38) return 2
  if (progress >= 0.18) return 1
  return 0
}

export function useWelcomeScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  reducedMotion = false
): SceneScrollState {
  const [state, setState] = useState<SceneScrollState>(() => ({
    progress: 0,
    activeSection: 0,
    cameraPosition: KEYFRAMES[0].frame.pos,
    cameraTarget: KEYFRAMES[0].frame.target,
    vesselOpacity: KEYFRAMES[0].frame.vesselOpacity,
    sheenOpacity: KEYFRAMES[0].frame.sheenOpacity,
    reconstructionOpacity: KEYFRAMES[0].frame.reconstructionOpacity,
  }))

  const triggerRef = useRef<ScrollTrigger | null>(null)

  useEffect(() => {
    if (reducedMotion) {
      // High-quality static perspective for accessibility / reduced motion
      setState({
        progress: 0,
        activeSection: 0,
        cameraPosition: [12, 12, 22],
        cameraTarget: [0, 2, 0],
        vesselOpacity: 1.0,
        sheenOpacity: 0.85,
        reconstructionOpacity: 0.8,
      })
      return
    }

    const container = containerRef.current
    if (!container) return

    const updateStateFromProgress = (progress: number) => {
      const clamped = Math.max(0, Math.min(1, progress))
      const activeSection = getActiveSection(clamped)

      // Find surrounding keyframes
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
      // Smooth sinusoidal cubic easing between keyframes
      const t = tRaw * tRaw * (3 - 2 * tRaw)

      setState({
        progress: clamped,
        activeSection,
        cameraPosition: lerp3(k0.frame.pos, k1.frame.pos, t),
        cameraTarget: lerp3(k0.frame.target, k1.frame.target, t),
        vesselOpacity: lerp(k0.frame.vesselOpacity, k1.frame.vesselOpacity, t),
        sheenOpacity: lerp(k0.frame.sheenOpacity, k1.frame.sheenOpacity, t),
        reconstructionOpacity: lerp(
          k0.frame.reconstructionOpacity,
          k1.frame.reconstructionOpacity,
          t
        ),
      })
    }

    // Native scroll event listener for immediate, zero-lag progress updates
    const handleScroll = () => {
      const maxScroll = container.scrollHeight - window.innerHeight
      if (maxScroll <= 0) return
      const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll))
      updateStateFromProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Sync initial scroll position

    // Bind GSAP ScrollTrigger to the scrollable welcome container
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        updateStateFromProgress(self.progress)
      },
    })

    triggerRef.current = trigger

    return () => {
      window.removeEventListener('scroll', handleScroll)
      trigger.kill()
      triggerRef.current = null
    }
  }, [containerRef, reducedMotion])

  return state
}
