/** Geo helpers shared by the maritime map surface. */
import { regionFor } from '@/store/mapStore'

export function dms(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${latDir} · ${Math.abs(lon).toFixed(2)}°${lonDir}`
}

export { regionFor }

/** Great-circle distance in kilometres (haversine). */
export function haversineKm(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number | null {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  const d = 2 * R * Math.asin(Math.sqrt(s))
  return Number.isFinite(d) ? d : null
}

/** Compact UTC clock (HH:MMZ) from an ISO string; null when unparseable. */
export function hhmmZ(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(11, 16).concat('Z')
}

/**
 * Age of an AIS fix, phrased for an operator ("4 min ago").
 *
 * A raw ISO timestamp answers "when was this recorded?" but the question an
 * operator actually has is "how stale is this position?". Shared by the hover
 * card and the selection popup so the same vessel never shows two different
 * notions of its age.
 *
 * `nowMs` defaults to wall-clock time, but a controlled demo runs on a
 * synthetic epoch - pass `referenceNowMs()` there or every demo fix reads as
 * months stale.
 */
export function ageFromNow(iso: string | null | undefined, nowMs?: number): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const mins = Math.max(0, Math.round(((nowMs ?? Date.now()) - t) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

const KM_DEG_LAT = 111.32

/** Deck.gl-friendly circle ring in [lon, lat] pairs (for selection rings). */
export function circleRing(
  lon: number,
  lat: number,
  radiusKm: number,
  segments = 48,
): [number, number][] {
  const lonScale = KM_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const dLat = radiusKm / KM_DEG_LAT
  const dLon = radiusKm / lonScale
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * 2 * Math.PI
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number]
  })
}