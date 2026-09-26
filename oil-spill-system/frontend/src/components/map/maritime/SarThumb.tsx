import { useEffect, useRef } from 'react'
import type { SarCandidateState } from '@/types/domain'

/**
 * Grayscale SAR thumbnail for the selection popup.
 *
 * There is no Sentinel-1 raster in the bundle - the app works from the
 * *detector output*, i.e. the candidate's organic polygon plus its measured area,
 * length and confidence. So the thumbnail draws that polygon the way oil actually
 * presents in a SAR amplitude image: a dark, damp-smoothed mass over speckled
 * backscatter, with the low-confidence fringe slightly lighter.
 *
 * It is a schematic of the detection, not a photograph of the scene, and it is
 * captioned as such - passing off generated speckle as real imagery would be the
 * one genuinely dishonest thing this card could do.
 *
 * The speckle is seeded from the candidate id, so the same detection always
 * renders the same texture instead of shimmering on every re-render.
 */

const W = 42
const H = 36

/** Cheap deterministic PRNG so the sea texture is stable per candidate. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Drop the duplicated closing vertex so the path does not double back. */
function ring(polygon: [number, number][]): [number, number][] {
  if (polygon.length < 2) return polygon
  const first = polygon[0]
  const last = polygon[polygon.length - 1]
  return first[0] === last[0] && first[1] === last[1] ? polygon.slice(0, -1) : polygon
}

export function SarThumb({ candidate }: { candidate: SarCandidateState | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, W, H)

    const points = ring(candidate?.polygon ?? [])

    // ---- sea: speckled backscatter --------------------------------------
    const rand = mulberry32(seedFrom(candidate?.id ?? 'oilguard'))
    const img = ctx.createImageData(W, H)
    for (let i = 0; i < W * H; i++) {
      // Multiplicative speckle is what gives SAR its grain; a little
      // low-frequency variation stops it reading as TV static.
      const grain = 128 + (rand() - 0.5) * 96
      const swell = Math.sin((i % W) / 7) * 6 + Math.cos(((i / W) | 0) / 5) * 5
      const v = Math.max(0, Math.min(255, grain + swell))
      img.data[i * 4] = v
      img.data[i * 4 + 1] = v
      img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    if (points.length < 3) {
      // No detector geometry to show: leave the honest bare sea rather than
      // inventing a blob.
      return
    }

    // ---- fit the detection into the thumb --------------------------------
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const pad = 3
    const spanX = Math.max(maxX - minX, 1e-6)
    const spanY = Math.max(maxY - minY, 1e-6)
    const k = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY)
    const ox = (W - spanX * k) / 2
    const oy = (H - spanY * k) / 2
    const px = ([x, y]: [number, number]): [number, number] => [
      ox + (x - minX) * k,
      oy + (maxY - y) * k, // screen y grows downward
    ]

    const trace = () => {
      ctx.beginPath()
      const [sx, sy] = px(points[0])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < points.length; i++) {
        const [cx, cy] = px(points[i])
        ctx.lineTo(cx, cy)
      }
      ctx.closePath()
    }

    // Fringe: a soft, slightly lighter halo standing in for the low-confidence
    // sheen that surrounds a real detection.
    ctx.save()
    ctx.filter = 'blur(2px)'
    trace()
    ctx.fillStyle = 'rgba(58, 62, 66, 0.85)'
    ctx.fill()
    ctx.restore()

    // Core: oil damps the radar return, so the slick is dark.
    trace()
    ctx.fillStyle = 'rgba(16, 18, 20, 0.94)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(210, 214, 218, 0.55)'
    ctx.lineWidth = 1
    ctx.stroke()

    // A single hairline down the long axis hints at the measured length without
    // inventing a heading.
    if (candidate?.lengthKm != null && candidate.lengthKm > 0) {
      ctx.save()
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = 'rgba(226, 230, 234, 0.4)'
      ctx.beginPath()
      ctx.moveTo(ox, H / 2)
      ctx.lineTo(ox + spanX * k, H / 2)
      ctx.stroke()
      ctx.restore()
    }
  }, [candidate])

  if (!candidate) {
    return (
      <div className="mm-sar-thumb" aria-hidden="true">
        <span>SAR</span>
        <em>no detection</em>
      </div>
    )
  }

  return (
    <div className="mm-sar-thumb mm-sar-thumb--img" role="img"
      aria-label={`Schematic SAR detection outline for ${candidate.id}, ${candidate.areaKm2.toFixed(2)} square kilometres at ${Math.round(candidate.confidence * 100)} percent confidence`}>
      <canvas ref={ref} width={W} height={H} />
    </div>
  )
}
