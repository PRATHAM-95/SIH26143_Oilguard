import { describe, it, expect } from 'vitest'
import { APP_ROUTE_PATHS } from '../routes'
import { STAGE_ORDER } from '../store/investigationStore'
import { MAP_LAYER_CATALOG } from '../store/mapStore'

describe('Protected Architecture Contracts (M0-M9)', () => {
  it('asserts the 6 protected route paths from the router source match literal expected contracts', () => {
    const EXPECTED_ROUTES = [
      '/',
      '/simulation',
      '/investigation',
      '/backtracking',
      '/attribution',
      '/report',
    ]

    expect(APP_ROUTE_PATHS).toHaveLength(6)
    expect(APP_ROUTE_PATHS).toEqual(EXPECTED_ROUTES)
  })

  it('asserts the 8 forensic investigation stage IDs from the store match literal expected sequence', () => {
    const EXPECTED_STAGES = [
      'detection',
      'characterization',
      'environment',
      'forward_drift',
      'backtracking',
      'ais',
      'attribution',
      'conclusion',
    ]

    expect(STAGE_ORDER).toHaveLength(8)
    expect(STAGE_ORDER).toEqual(EXPECTED_STAGES)
  })

  it('asserts the protected map layer IDs from the map catalog match literal expected IDs', () => {
    // M10: weather, incidents and eez are additive compatible layers (approved
    // integration decision). The original 13 protected IDs keep their order;
    // weather+incidents sit after 'currents', eez is appended after 'drift'.
    const EXPECTED_MAP_LAYERS = [
      'satellite',
      'slick',
      'vessels',
      'vesselTrails',
      'wind',
      'currents',
      'weather',
      'incidents',
      'backtracking',
      'sourceProbability',
      'uncertainty',
      'attribution',
      'sarSlicks',
      'sarFootprint',
      'drift',
      'eez',
    ]

    const actualLayerIds = Object.keys(MAP_LAYER_CATALOG)
    expect(actualLayerIds).toHaveLength(16)
    expect(actualLayerIds).toEqual(EXPECTED_MAP_LAYERS)
  })
})
