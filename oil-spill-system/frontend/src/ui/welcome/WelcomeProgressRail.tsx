import { useEffect, useRef, memo } from 'react'
import { WELCOME_SECTION_POSITIONS, type ParallaxListener } from './useWelcomeScroll'

interface WelcomeProgressRailProps {
  activeSection: number
  onJumpToSection?: (sectionIndex: number) => void
  subscribeParallax?: (listener: ParallaxListener) => () => void
  reducedMotion?: boolean
}

const CHAPTERS = [
  { label: '01', name: 'OCEAN' },
  { label: '02', name: 'VESSEL' },
  { label: '03', name: 'SPILL' },
  { label: '04', name: 'RECONSTRUCT' },
  { label: '05', name: 'ENTER' },
]

/**
 * Fixed-edge scroll progress rail — the "sliding bar" for the welcome story.
 *
 * The fill, thumb and percentage readout are driven imperatively from the single
 * scroll model through `subscribeParallax`, so the rail animates without adding
 * any React re-render to the scroll hot path. Only `activeSection` (5 discrete
 * values) touches React state, and only to highlight the active chapter tick.
 */
export const WelcomeProgressRail = memo(function WelcomeProgressRail({
  activeSection,
  onJumpToSection,
  subscribeParallax,
  reducedMotion = false,
}: WelcomeProgressRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const rail = railRef.current
    const percent = percentRef.current
    if (!rail || !subscribeParallax) return

    return subscribeParallax((progress) => {
      const clamped = Math.max(0, Math.min(1, progress))
      rail.style.setProperty('--progress', clamped.toFixed(4))
      if (percent) {
        percent.textContent = `${Math.round(clamped * 100)}%`
      }
    })
  }, [subscribeParallax])

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 flex items-center pr-2 sm:pr-4 pointer-events-auto"
      aria-label="Welcome scroll progress"
      data-welcome-rail
    >
      <div
        ref={railRef}
        className={`welcome-progress-rail${reducedMotion ? ' welcome-progress-rail--reduced' : ''}`}
      >
        {/* Percentage readout, rides the thumb */}
        <span
          ref={percentRef}
          className="welcome-progress-rail__percent"
          data-welcome-rail-percent
          aria-hidden="true"
        >
          0%
        </span>

        {/* Track + fill */}
        <div className="welcome-progress-rail__track" aria-hidden="true">
          <div className="welcome-progress-rail__fill" data-welcome-rail-fill />
        </div>

        {/* Sliding thumb */}
        <div className="welcome-progress-rail__thumb" data-welcome-rail-thumb aria-hidden="true" />

        {/* Chapter ticks */}
        <div className="welcome-progress-rail__ticks">
          {CHAPTERS.map((chapter, index) => {
            const isActive = index === activeSection
            const position = WELCOME_SECTION_POSITIONS[index] ?? 0
            return (
              <button
                key={chapter.name}
                type="button"
                data-welcome-rail-tick
                data-active={isActive || undefined}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Jump to chapter ${chapter.label} ${chapter.name}`}
                onClick={() => onJumpToSection?.(index)}
                className="welcome-progress-rail__tick"
                style={{ top: `${position * 100}%` }}
              >
                <span className="welcome-progress-rail__tick-mark" aria-hidden="true" />
                <span className="welcome-progress-rail__tick-label" aria-hidden="true">
                  {chapter.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default WelcomeProgressRail
