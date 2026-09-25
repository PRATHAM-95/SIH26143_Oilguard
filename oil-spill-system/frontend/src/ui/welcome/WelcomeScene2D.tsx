import React, { useRef, memo, useEffect } from 'react'
import { type WelcomeScrollRef } from './useWelcomeScroll'

interface WelcomeScene2DProps {
  scrollRef: WelcomeScrollRef
  activeSection: number
  reducedMotion?: boolean
  showStackLabels?: boolean
}

const EVIDENCE_LAYERS = [
  'SAR SCENE',
  'SPILL MASK',
  'DRIFT FIELD',
  'AIS GAPS',
  'CANDIDATES',
  'SCORE',
  'SOURCE ZONE',
  'CONFIDENCE',
  'DOSSIER',
]

/**
 * Pure CSS/SVG stand-in for the WebGL welcome scene.
 *
 * Rendered only when `checkWebGLSupport()` fails (hardware acceleration off,
 * blocklisted driver, VM/RDP session). It reads the SAME `scrollRef` frame the
 * 3D scene reads, so the five-chapter choreography, narrative flip points and
 * progress rail stay perfectly in sync — the experience degrades in fidelity,
 * never in behaviour.
 *
 * Zero React re-renders: one rAF loop writes CSS custom properties and every
 * layer derives its transform/opacity from those variables in CSS.
 */
export const WelcomeScene2D = memo(function WelcomeScene2D({
  scrollRef,
  activeSection,
  reducedMotion = false,
  showStackLabels = true,
}: WelcomeScene2DProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let raf = 0
    let lastP = -1
    let lastVessel = -1
    let lastSheen = -1
    let lastRecon = -1

    const paint = () => {
      raf = requestAnimationFrame(paint)
      const { progress, vesselOpacity, sheenOpacity, reconstructionOpacity } =
        scrollRef.current

      if (progress !== lastP) {
        root.style.setProperty('--p', progress.toFixed(4))
        lastP = progress
      }
      if (vesselOpacity !== lastVessel) {
        root.style.setProperty('--vessel', vesselOpacity.toFixed(4))
        lastVessel = vesselOpacity
      }
      if (sheenOpacity !== lastSheen) {
        root.style.setProperty('--sheen', sheenOpacity.toFixed(4))
        lastSheen = sheenOpacity
      }
      if (reconstructionOpacity !== lastRecon) {
        root.style.setProperty('--recon', reconstructionOpacity.toFixed(4))
        lastRecon = reconstructionOpacity
      }
    }

    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  }, [scrollRef])

  // Reconstruction & evidence layers mount with the Reconstruction section,
  // mirroring WelcomeScene so the 2D and 3D paths share one choreography.
  const showReconstruction = activeSection >= 2 || reducedMotion

  return (
    <div
      ref={rootRef}
      data-welcome-scene="2d"
      className="welcome-scene-2d absolute inset-0 w-full h-full pointer-events-none"
    >
      {/* --- ABYSS / SKY GRADIENT --- */}
      <div className="welcome-scene-2d__sky" aria-hidden="true" />

      {/* --- STAR FIELD --- */}
      <div className="welcome-scene-2d__stars" aria-hidden="true" />

      {/* --- HORIZONTAL MOONLIGHT GLOW --- */}
      <div className="welcome-scene-2d__horizon" aria-hidden="true" />

      {/* --- OCEAN PLANE (perspective grid) --- */}
      <div className="welcome-scene-2d__ocean" aria-hidden="true">
        <div className="welcome-scene-2d__ocean-grid" />
      </div>

      {/* --- TANKER VESSEL --- */}
      <div className="welcome-scene-2d__vessel" aria-hidden="true">
        <svg
          viewBox="0 0 420 150"
          className="welcome-scene-2d__vessel-svg"
          role="presentation"
          focusable="false"
        >
          <path
            d="M28 96 L392 96 L368 128 Q360 138 344 138 L74 138 Q58 138 50 128 Z"
            fill="#0d1826"
            stroke="#33506e"
            strokeWidth="1.5"
          />
          <line x1="40" y1="96" x2="384" y2="96" stroke="#33506e" strokeWidth="1.5" />
          <rect x="300" y="52" width="62" height="44" fill="#132236" stroke="#33506e" strokeWidth="1.5" />
          <rect x="312" y="62" width="14" height="10" fill="#0b1118" stroke="#4a6d92" strokeWidth="1" />
          <rect x="332" y="62" width="14" height="10" fill="#0b1118" stroke="#4a6d92" strokeWidth="1" />
          <rect x="340" y="30" width="16" height="22" fill="#16273a" stroke="#33506e" strokeWidth="1.5" />
          <line x1="90" y1="96" x2="90" y2="62" stroke="#33506e" strokeWidth="1.5" />
          <line x1="82" y1="62" x2="98" y2="62" stroke="#33506e" strokeWidth="1.5" />
          <line x1="180" y1="96" x2="180" y2="58" stroke="#33506e" strokeWidth="1.5" />
          <line x1="170" y1="58" x2="190" y2="58" stroke="#33506e" strokeWidth="1.5" />
          <line x1="28" y1="146" x2="392" y2="146" stroke="#1c3350" strokeWidth="1" opacity="0.5" />
        </svg>
      </div>

      {/* --- OIL SHEEN --- */}
      <div className="welcome-scene-2d__sheen" aria-hidden="true">
        <div className="welcome-scene-2d__sheen-blob" />
        <div className="welcome-scene-2d__sheen-iridescence" />
      </div>

      {/* --- RECONSTRUCTION OVERLAY --- */}
      {showReconstruction && (
        <div className="welcome-scene-2d__recon" aria-hidden="true">
          <div className="welcome-scene-2d__recon-ring welcome-scene-2d__recon-ring--a" />
          <div className="welcome-scene-2d__recon-ring welcome-scene-2d__recon-ring--b" />
          <div className="welcome-scene-2d__recon-ring welcome-scene-2d__recon-ring--c" />
          <div className="welcome-scene-2d__recon-reticle" />
        </div>
      )}

      {/* --- 9-LAYER EXPLODED EVIDENCE STACK --- */}
      {showReconstruction && (
        <div
          className={`welcome-scene-2d__evidence${showStackLabels ? '' : ' welcome-scene-2d__evidence--compact'}`}
          aria-hidden="true"
        >
          {EVIDENCE_LAYERS.map((label, i) => (
            <div key={label} className="welcome-scene-2d__plate" style={{ '--i': i } as React.CSSProperties}>
              <span className="welcome-scene-2d__plate-rule" />
              <span className="welcome-scene-2d__plate-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- HONEST DEGRADATION BADGE (project provenance principle) --- */}
      <div className="welcome-scene-2d__badge" aria-hidden="true">
        <span className="welcome-scene-2d__badge-dot" />
        <span>2D SCHEMATIC · WEBGL UNAVAILABLE</span>
      </div>

      {/* The scene is decorative; expose the active chapter for assistive tech. */}
      <span className="sr-only" role="status">
        {`Welcome chapter ${activeSection + 1} of 5`}
      </span>
    </div>
  )
})

export default WelcomeScene2D
