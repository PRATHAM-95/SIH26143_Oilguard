import { useMemo } from 'react'
import { TextLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useMapStore } from '@/store/mapStore'

/**
 * Curated place-name layer for the satellite basemap.
 *
 * The Esri reference raster bakes cities, towns and water features into the
 * tile, so it cannot be filtered by importance - at regional zoom it produces a
 * dense, evenly weighted carpet of place names that competes with the incident
 * for attention. Rather than fight it, the reference raster is dimmed and the
 * naming hierarchy is restated here as deck.gl text, where prominence is
 * explicit and collision-free by construction.
 *
 * Cartographic convention: land names in upright light grey, water names in
 * italic cyan so the sea reads as a distinct surface from the land.
 *
 * Only two tiers exist on purpose. A third "city" tier would reintroduce the
 * noise this layer removes.
 */

type PlaceName = {
  coordinates: [number, number]
  text: string
}

/** Land: upright, light grey, quiet. */
const COUNTRIES: PlaceName[] = [
  { coordinates: [78.6, 23.2], text: 'INDIA' },
  { coordinates: [69.4, 29.6], text: 'PAKISTAN' },
  { coordinates: [66.4, 32.4], text: 'AFGHANISTAN' },
  { coordinates: [54.4, 32.6], text: 'IRAN' },
  { coordinates: [45.2, 24.2], text: 'SAUDI ARABIA' },
  { coordinates: [56.4, 21.6], text: 'OMAN' },
  { coordinates: [53.6, 24.2], text: 'U.A.E.' },
  { coordinates: [47.4, 15.4], text: 'YEMEN' },
  { coordinates: [45.6, 5.4], text: 'SOMALIA' },
  { coordinates: [80.7, 7.5], text: 'SRI LANKA' },
  { coordinates: [73.4, 3.4], text: 'MALDIVES' },
  { coordinates: [90.2, 23.8], text: 'BANGLADESH' },
  { coordinates: [96.2, 21.4], text: 'MYANMAR' },
  { coordinates: [70.8, 15.4], text: 'GOA' },
]

/** Water: italic, cyan, wide tracking - the dominant water names. */
const SEAS: PlaceName[] = [
  { coordinates: [64.2, 17.2], text: 'ARABIAN SEA' },
  { coordinates: [88.6, 12.4], text: 'BAY OF BENGAL' },
  { coordinates: [80.4, -6.4], text: 'INDIAN OCEAN' },
  { coordinates: [47.2, 12.4], text: 'GULF OF ADEN' },
  { coordinates: [58.2, 24.4], text: 'GULF OF OMAN' },
  { coordinates: [73.6, 8.2], text: 'LACCADIVEE SEA' },
  { coordinates: [95.6, 9.4], text: 'ANDAMAN SEA' },
]

/**
 * deck.gl builds the canvas font as `${fontWeight} ${fontSize}px ${fontFamily}`
 * (font-atlas-manager `setTextStyle`). The CSS font shorthand accepts
 * `font-style` in that leading slot, so passing 'italic' here produces a real
 * italic face - there is no dedicated font-style prop in the public API.
 */
const ITALIC_SLOT = 'italic'

const WATER_COLOR: [number, number, number] = [124, 176, 212]
const LAND_COLOR: [number, number, number] = [206, 214, 222]

export function useBasemapLabelLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const basemap = useMapStore((s) => s.basemap)

  return useMemo(() => {
    // The dark vector basemap ships its own well-graded labels; adding a second
    // set on top of it would double the place names.
    if (basemap !== 'satellite') return []
    return [
      new TextLayer({
        id: 'basemap-water-labels',
        data: SEAS,
        getPosition: (d: PlaceName) => d.coordinates,
        getText: (d: PlaceName) => d.text,
        getSize: 12,
        getColor: WATER_COLOR,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: [0, 0],
        fontFamily: "'Newsreader Variable', Georgia, 'Times New Roman', serif",
        fontWeight: ITALIC_SLOT,
        outlineWidth: 3,
        outlineColor: [4, 12, 20, 210],
        characterSet: 'auto',
        pickable: false,
      }),
      new TextLayer({
        id: 'basemap-land-labels',
        data: COUNTRIES,
        getPosition: (d: PlaceName) => d.coordinates,
        getText: (d: PlaceName) => d.text,
        getSize: 9.5,
        getColor: LAND_COLOR,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: [0, 0],
        fontFamily: "'Schibsted Grotesk Variable', 'Segoe UI', sans-serif",
        fontWeight: 500,
        outlineWidth: 2.5,
        outlineColor: [4, 12, 20, 200],
        characterSet: 'auto',
        pickable: false,
      }),
    ]
  }, [basemap])
}
