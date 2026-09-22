import React, { useRef, useState, useEffect, useTransition } from 'react'
import WelcomeScene from '../welcome/WelcomeScene'
import WelcomeNarrative from '../welcome/WelcomeNarrative'
import WelcomeFallback from '../welcome/WelcomeFallback'
import { useWelcomeScroll } from '../welcome/useWelcomeScroll'
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

// Keyframe scroll positions for jumping to chapters
const SECTION_PROGRESS_TARGETS = [0.0, 0.22, 0.44, 0.68, 0.95]

export const WelcomePage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true)
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const [, startTransition] = useTransition()

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

  // Hook managing native scroll progress & GSAP ScrollTrigger
  const scrollState = useWelcomeScroll(containerRef, reducedMotion)

  // Jump to specific chapter from header navigation
  const handleJumpToSection = (sectionIndex: number) => {
    const container = containerRef.current
    if (!container) return
    const targetProgress = SECTION_PROGRESS_TARGETS[sectionIndex] ?? 0
    const scrollableDistance = container.scrollHeight - window.innerHeight
    const targetScrollY = container.offsetTop + scrollableDistance * targetProgress

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
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
          scrollState={scrollState}
          reducedMotion={reducedMotion}
        />

        {/* Narrative HTML / UI Overlay */}
        <WelcomeNarrative
          scrollState={scrollState}
          onJumpToSection={handleJumpToSection}
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
