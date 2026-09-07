/**
 * Application design tokens — single source of truth for the visual language.
 *
 * The maritime "command centre" palette:
 *   - Deep-sea charcoal base with layered elevation.
 *   - Signal cyan for interactive / focus.
 *   - Discipline hues that never collide: SAR amber-orange (slicks),
 *     drift teal (forward model), source gold (backtracking), vessel sky.
 * Everything in index.css is mirrored from /SYNCED to these values.
 */

/**
 * Base map style: OpenFreeMap Dark vector tiles.
 *
 * - No API key, no registration, no usage limits.
 * - Full CORS (`*`), open-source, hosted public instance.
 * - Smooth zoom, crisp labels, dark muted palette — perfect for data overlays.
 * - Attribution: © OpenStreetMap contributors © OpenMapTiles © OpenFreeMap
 *
 * Falls back to CARTO dark raster when offline (swap the line below).
 */
export const DARK_MAP_STYLE: string =
  'https://tiles.openfreemap.org/styles/dark'

/**
 * Semantic tokens shared with the deck.gl overlays. Deck reads colour here,
 * CSS mirrors it in index.css — the map and the UI can never drift apart.
 */
export const VSCO = {
  styles: {
    dark: DARK_MAP_STYLE,
  },

  base: {
    bg: '#04070b',
    elev: '#070c13',
    panel: '#0b1420',
    panel2: '#0e1a28',
    inset: '#060c14',
    line: '#16242f',
    lineStrong: '#27405a',
    text: '#e9f1f8',
    textDim: '#9db0c2',
    textFaint: '#5d7085',
  },

  accent: {
    cyan: '#38bdf8',
    cyanStrong: '#7dd3fc',
  },

  ok: '#2fd89a',
  warn: '#f0b23f',
  danger: '#f4575a',

  /** Discipline hues (RGB arrays for deck.gl layers). */
  evidence: {
    dim: [82, 99, 118] as const,
    slick: [186, 110, 48] as const, // observed spill point
    vessel: [122, 212, 255] as const, // live vessels
    trail: [60, 106, 138] as const, // recorded vessel tracks
    origin: [240, 192, 90] as const, // probable source
  },

  drift: {
    particle: [88, 224, 185] as const,
    extent: [58, 168, 150] as const,
    extentFill: [58, 168, 150] as const,
  },

  sar: {
    slick: [255, 138, 99] as const,
    slickFill: [255, 138, 99] as const,
    lookalike: [208, 163, 95] as const,
    lookalikeFill: [208, 163, 95] as const,
    footprint: [96, 165, 205] as const,
    footprintFill: [96, 165, 205] as const,
  },
} as const