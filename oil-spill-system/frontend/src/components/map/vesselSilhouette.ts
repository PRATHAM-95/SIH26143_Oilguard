/**
 * vesselSilhouette.ts - Ship silhouette SVG and styling for Deck.gl IconLayer.
 *
 * Provides a top-down ship silhouette (pointed bow, bridge superstructure, transom stern)
 * that renders as an authentic vessel rather than a circular dot.
 * Sizing uses pixel units so the ship is clearly recognizable at any map zoom level.
 */

// Top-down vessel silhouette SVG (mask-compatible)
// White hull with transparent background and subtle structural contrast.
const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="64" viewBox="0 0 32 64">
  <!-- Hull: hydrodynamic pointed bow, midship flare, square transom stern -->
  <path d="M 16,1 C 21,12 28,24 28,46 C 28,55 25,61 16,61 C 7,61 4,55 4,46 C 4,24 11,12 16,1 Z" fill="#ffffff" />
  <!-- Bridge superstructure (darker alpha for depth in mask) -->
  <rect x="9" y="42" width="14" height="10" rx="1.5" fill="#ffffff" opacity="0.4" />
  <rect x="12" y="37" width="8" height="5" rx="1" fill="#ffffff" opacity="0.3" />
  <!-- Forward cargo hatches -->
  <rect x="12" y="14" width="8" height="8" rx="1" fill="#ffffff" opacity="0.5" />
  <rect x="12" y="25" width="8" height="8" rx="1" fill="#ffffff" opacity="0.5" />
</svg>`

export const SHIP_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SHIP_SVG)}`

export type RgbaColor = [number, number, number, number]

/**
 * Returns domain-driven RGBA color for a vessel:
 * - Selected: Bright white / signal cyan highlight
 * - Spilled/Target: Warning/Danger accent
 * - Tanker: Hydrocarbon amber
 * - Cargo/Container: Sonar cyan
 * - Fishing: Emerald green
 * - Default: Maritime mist blue
 */
export function getVesselColor(vessel: { type?: string; id?: string }, isSelected: boolean, isTarget?: boolean): RgbaColor {
  if (isSelected) {
    return [248, 247, 244, 255] // Porcelain highlight
  }
  if (isTarget) {
    return [255, 77, 90, 245] // semantic danger red (#FF4D5A)
  }

  const type = vessel.type?.toLowerCase() ?? ''
  if (type.includes('tanker')) {
    return [255, 176, 32, 235] // hydrocarbon amber (#FFB020)
  }
  if (type.includes('cargo') || type.includes('container') || type.includes('carrier')) {
    return [140, 160, 180, 225] // maritime slate
  }
  if (type.includes('fish') || type.includes('trawler')) {
    return [0, 217, 139, 220] // emerald (#00D98B)
  }
  if (type.includes('passenger') || type.includes('cruise') || type.includes('ferry')) {
    return [167, 139, 250, 220] // violet
  }

  return [178, 187, 197, 210] // mist (#B2BBC5)
}

/**
 * Role a vessel plays in the current investigation. This, not its type, is what
 * the command-centre map encodes: an operator needs to see who is under
 * suspicion at a glance, and a hull-type palette cannot say that. A candidate
 * bulk carrier and a non-candidate tanker would otherwise be the only two
 * colours on screen, indistinguishable in meaning.
 */
export type VesselRole = 'selected' | 'candidate' | 'shipOfInterest' | 'normal' | 'stale'

/**
 * Investigation-role palette, most significant first.
 *
 * Normal traffic is a deliberately desaturated slate rather than a full blue:
 * there are around twenty background vessels in view, and at the mandated
 * density a saturated fill for each of them would out-shout the three that
 * matter. "Blue = normal" holds, but quietly.
 */
export function getVesselRoleColor(role: VesselRole, isHovered: boolean): RgbaColor {
  const lift = (c: RgbaColor, by = 26): RgbaColor => [
    Math.min(255, c[0] + by),
    Math.min(255, c[1] + by),
    Math.min(255, c[2] + by),
    c[3],
  ]
  switch (role) {
    case 'selected':
      return [248, 247, 244, 255] // porcelain, ringed in signal blue
    case 'candidate':
      return isHovered ? [255, 138, 74, 255] : [240, 112, 58, 245]
    case 'shipOfInterest':
      return [0, 217, 139, 240]
    case 'stale':
      return [114, 125, 137, 150] // grey: position known, record too old to trust
    case 'normal':
    default:
      return isHovered ? lift([122, 158, 196, 235]) : [122, 158, 196, 195]
  }
}

/**
 * Computes heading vector end-point coordinates based on actual heading and genuine SOG.
 * Length reflects speed when genuinely available (e.g. 10 kn -> ~0.05°), never invented.
 */
export function computeHeadingVector(
  lon: number,
  lat: number,
  headingDeg: number,
  speedKnots: number | null | undefined,
): [number, number] {
  const rad = (headingDeg * Math.PI) / 180
  // Genuine SOG vector scaling: base 0.02° + speed * 0.003° (capped at 0.08° for readability)
  const hasSpeed = typeof speedKnots === 'number' && speedKnots > 0
  const geoLength = hasSpeed ? Math.min(0.08, 0.02 + speedKnots * 0.003) : 0.025

  return [
    lon + geoLength * Math.sin(rad),
    lat + geoLength * Math.cos(rad),
  ]
}
