/**
 * Phase definitions and vertical separation mathematics for the Exploded Evidence Stack.
 * Metaphor: ONE INCIDENT → MULTIPLE EVIDENCE LAYERS → RECONSTRUCTED EXPLANATION
 * Three phases: STACKED (s=0) → EXPLODED (s=1) → CONVERGED (s=0.35)
 */

export type EvidencePhase = 'stacked' | 'exploded' | 'converged'

export interface EvidenceStackPhaseState {
  phase: EvidencePhase
  separation: number // 0 to 1
  focusedLayerId: string | null
}

export const STACKED_SEPARATION = 0.0
export const EXPLODED_SEPARATION = 1.0
export const CONVERGED_SEPARATION = 0.35

export const MAX_LAYER_SPREAD = 1.8 // Vertical units per layer at full explosion
export const MIN_LAYER_SPREAD = 0.08 // Minimal offset to eliminate Z-fighting when stacked

/**
 * Calculates the vertical Y coordinate of a given layer based on separation (0..1)
 */
export function calculateLayerY(layerIndex: number, separation: number, phase: EvidencePhase): number {
  if (phase === 'converged') {
    // In converged mode, layers compress tightly while top attribution resolves with focus
    const baseY = layerIndex * 0.45
    return baseY
  }

  // Smooth interpolation from stacked (s=0) to exploded (s=1)
  const spread = MIN_LAYER_SPREAD + (MAX_LAYER_SPREAD - MIN_LAYER_SPREAD) * Math.max(0, Math.min(1, separation))
  return layerIndex * spread
}

/**
 * Computes layer opacity accounting for layer focus isolation
 */
export function calculateLayerOpacity(
  layerIndex: number,
  focusedIndex: number | null,
  baseOpacity = 1.0
): number {
  if (focusedIndex === null) {
    return baseOpacity
  }
  return layerIndex === focusedIndex ? 1.0 : 0.25 * baseOpacity
}
