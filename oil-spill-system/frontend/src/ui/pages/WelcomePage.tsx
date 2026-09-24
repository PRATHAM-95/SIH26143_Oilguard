import React, { useRef, useState, useEffect, useTransition } from 'react'
import WelcomeScene from '../welcome/WelcomeScene'
import WelcomeNarrative from '../welcome/WelcomeNarrative'
import WelcomeFallback from '../welcome/WelcomeFallback'
import { useWelcomeScroll, WELCOME_SECTION_POSITIONS } from '../welcome/useWelcomeScroll'
import { prefersReducedMotion } from '../motion/tokens'

// Robust WebGL availability detector
function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl && gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext))
  } catch {
    return false
  }
}

export const WelcomePage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true)
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const [, startTransition] = useTransition()

  // Evidence-stack HTML badges are hidden below 768px (mobile clutter control)
  const [showStackLabels, setShowStackLabels] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : true
  )

  useEffect(() => {
    // Set document title
    document.title = 'OilGuard // Maritime Forensic Intelligence'

    // Enable native browser scrolling for the standalone welcome experience
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    html.style.overflowY = 'auto'
    html.style.height = 'auto'
    body.style.overflowY = 'auto'
    body.style.height = 'auto'
    if (root) {
      root.style.overflowY = 'visible'
      root.style.height = 'auto'
    }

    // Check WebGL and reduced motion
    const hasWebGL = checkWebGLSupport()
    const isReduced = prefersReducedMotion()

    startTransition(() => {
      setWebGLSupported(hasWebGL)
      setReducedMotion(isReduced)
    })

    return () => {
      html.style.overflowY = ''
      html.style.height = ''
      body.style.overflowY = ''
      body.style.height = ''
      if (root) {
        root.style.overflowY = ''
        root.style.height = ''
      }
    }
  }, [])

  // Show the 9 evidence badges only on viewports that have room for them
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(min-width: 768px)')
    const handleChange = () => setShowStackLabels(mql.matches)
    handleChange()
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange)
    } else {
      mql.addListener(handleChange)
    }
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleChange)
      } else {
        mql.removeListener(handleChange)
      }
    }
  }, [])

  // Single-owner scroll model: one rAF driver, imperative ref for the scene.
  // React state changes only when the active section actually changes.
  const { scrollRef, activeSection, subscribeParallax } = useWelcomeScroll(
    containerRef,
    reducedMotion
  )

  // Jump to specific chapter from header navigation — targets are the single
  // source of truth aligned with camera arrivals & narrative flips.
  const handleJumpToSection = (sectionIndex: number) => {
    const container = containerRef.current
    if (!container) return
    const targetProgress = WELCOME_SECTION_POSITIONS[sectionIndex] ?? 0
    const scrollableDistance = container.scrollHeight - window.innerHeight
    // Ceil + 1px overshoot: scrollTop snaps to integers, and a boundary like 0.68
    // can otherwise settle 1px short (e.g. 1909.44 -> 1909/2808 < 0.68), leaving the
    // chapter inactive. A hair past the boundary guarantees the section engages.
    const targetScrollY =
      container.offsetTop +
      (targetProgress <= 0 ? 0 : Math.ceil(scrollableDistance * targetProgress) + 1)

    window.scrollTo({
      top: targetScrollY,
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
  }

  // If WebGL is unavailable, render intentional 2D architectural fallback
  if (!webGLSupported) {
    return <WelcomeFallback reason="no-webgl" />
  }

  return (
    <div
      ref={containerRef}
      className="welcome-page-root relative w-full bg-[#070b10] text-[#f8f7f4] select-none"
    >
      {/* Fixed Fullscreen 3D Viewport & Overlay — permanently pinned to screen */}
      <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none">
        {/* 3D Scene Layer */}
        <WelcomeScene
          scrollRef={scrollRef}
          activeSection={activeSection}
          reducedMotion={reducedMotion}
          showStackLabels={showStackLabels}
        />

        {/* Narrative HTML / UI Overlay */}
        <WelcomeNarrative
          activeSection={activeSection}
          onJumpToSection={handleJumpToSection}
          subscribeParallax={subscribeParallax}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Native scroll track providing scrollable document distance */}
      <div
        style={{ height: reducedMotion ? '100vh' : '360vh' }}
        className="w-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
}

export default WelcomePage