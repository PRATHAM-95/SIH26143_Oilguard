// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NumberTween } from '../ui/motion/NumberTween'

describe('NumberTween', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    // @ts-expect-error configure react act environment flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    // Default: matchMedia prefers-reduced-motion false
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders placeholder when value is null', () => {
    act(() => {
      root.render(<NumberTween value={null} placeholder="No data" />)
    })
    expect(container.textContent).toBe('No data')
  })

  it('renders default placeholder "—" when value is undefined', () => {
    act(() => {
      root.render(<NumberTween value={undefined} />)
    })
    expect(container.textContent).toBe('—')
  })

  it('appears immediately with first real value (no tween from 0)', () => {
    // If it tweened from 0, initial synchronous render might be 0
    act(() => {
      root.render(<NumberTween value={87.5} />)
    })
    expect(container.textContent).toBe('87.5')
  })

  it('preserves custom formatting', () => {
    act(() => {
      root.render(<NumberTween value={42} format={(n) => `${n.toFixed(0)} knots`} />)
    })
    expect(container.textContent).toBe('42 knots')
  })

  it('transitions between real values and settles at final value', async () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    let rafCallback: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafCallback = null
    })

    // Mount with initial real value
    act(() => {
      root.render(<NumberTween value={100} duration={0.2} format={(n) => Math.round(n).toString()} />)
    })
    expect(container.textContent).toBe('100')

    // Update to new real value
    act(() => {
      root.render(<NumberTween value={200} duration={0.2} format={(n) => Math.round(n).toString()} />)
    })

    // Intermediate frame
    now = 1100 // 100ms in (halfway)
    act(() => {
      if (rafCallback) rafCallback(now)
    })
    const intermediateVal = parseInt(container.textContent || '0', 10)
    expect(intermediateVal).toBeGreaterThan(100)
    expect(intermediateVal).toBeLessThan(200)

    // Complete transition
    now = 1250 // beyond 200ms
    act(() => {
      if (rafCallback) rafCallback(now)
    })
    expect(container.textContent).toBe('200')
  })

  it('snaps immediately to target value when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

    // Mount initial
    act(() => {
      root.render(<NumberTween value={50} />)
    })
    expect(container.textContent).toBe('50')

    // Update value with reduced motion enabled
    act(() => {
      root.render(<NumberTween value={99} />)
    })
    // Must snap immediately to 99 without requesting animation frame
    expect(container.textContent).toBe('99')
    expect(rafSpy).not.toHaveBeenCalled()
  })
})
