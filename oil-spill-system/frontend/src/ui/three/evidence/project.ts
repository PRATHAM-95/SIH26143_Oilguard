/**
 * Geospatial presentation mapper for the 9-layer Exploded Evidence Stack.
 * Converts [lon, lat] coordinates to local 3D plate [x, z] coordinates using
 * the equirectangular projection standard aligned with AttributionMap.tsx and SelectionInspector.
 *
 * All 9 layers share the identical local coordinate frame and plate dimensions.
 */

export const KM_DEG_LAT = 111.32
export const EVIDENCE_PLATE_WIDTH = 16.0 // Width along X axis
export const EVIDENCE_PLATE_DEPTH = 11.0 // Depth along Z axis
export const DEFAULT_VIEW_SPAN_KM = 20.0 // Default radius mapped to plate boundary

/**
 * Projects a geographic coordinate [lon, lat] onto local plate plane coordinates [x, z].
 * x is East-West [-WIDTH/2, WIDTH/2], z is North-South [-DEPTH/2, DEPTH/2].
 */
export function projectGeoToPlate(
  lon: number,
  lat: number,
  center: [number, number] = [54.3667, 24.4667], // fallback Arabian Gulf / default
  spanKm: number = DEFAULT_VIEW_SPAN_KM
): [number, number] {
  const [centerLon, centerLat] = center
  const lonScale = KM_DEG_LAT * Math.cos((centerLat * Math.PI) / 180)

  // Distance in kilometers from center
  const dxKm = (lon - centerLon) * lonScale
  const dzKm = (lat - centerLat) * KM_DEG_LAT

  // Scale to plate extents (clamped to plate margins)
  const halfW = EVIDENCE_PLATE_WIDTH * 0.45
  const halfD = EVIDENCE_PLATE_DEPTH * 0.45

  const x = Math.max(-halfW, Math.min(halfW, (dxKm / spanKm) * halfW))
  // In Three.js: -Z is North, +Z is South
  const z = Math.max(-halfD, Math.min(halfD, -(dzKm / spanKm) * halfD))

  return [x, z]
}

/**
 * Generates circular contour ring points on the local 3D plate
 */
export function createPlateCircleRing(
  centerLon: number,
  centerLat: number,
  radiusKm: number,
  plateCenter: [number, number],
  spanKm: number = DEFAULT_VIEW_SPAN_KM,
  segments = 48
): [number, number][] {
  const [originX, originZ] = projectGeoToPlate(centerLon, centerLat, plateCenter, spanKm)
  const lonScale = KM_DEG_LAT * Math.cos((centerLat * Math.PI) / 180)
  const rScaleX = ((radiusKm / lonScale) / (spanKm / lonScale)) * (EVIDENCE_PLATE_WIDTH * 0.45)
  const rScaleZ = ((radiusKm / KM_DEG_LAT) / (spanKm / KM_DEG_LAT)) * (EVIDENCE_PLATE_DEPTH * 0.45)

  const points: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    points.push([
      originX + rScaleX * Math.cos(angle),
      originZ + rScaleZ * Math.sin(angle),
    ])
  }
  return points
}
