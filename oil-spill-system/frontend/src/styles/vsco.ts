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
    bg: '#03070c',
    elev: '#070c13',
    panel: '#0b131e',
    panel2: '#0f1a28',
    panel3: '#142234',
    inset: '#04080f',
    glass: 'rgba(11, 19, 30, 0.82)',
    line: '#16242f',
    lineStrong: '#27405a',
    text: '#f1f5f9',
    textDim: '#94a3b8',
    textFaint: '#64748b',
  },

  accent: {
    cyan: '#38bdf8',
    cyanStrong: '#7dd3fc',
    cyanSubtle: 'rgba(56, 189, 248, 0.12)',
  },

  ok: '#2fd89a',
  warn: '#f0b23f',
  danger: '#f43f5e',

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

  /** Design System Typed Tokens (synchronized with CSS variables) */
  tokens: {
    fonts: {
      sans: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Cascadia Code', Consolas, 'SF Mono', monospace",
    },
    zIndex: {
      canvas: 0,
      base: 1,
      surface: 10,
      mapControl: 20,
      mapOverlay: 30,
      header: 40,
      rail: 40,
      dock: 50,
      popover: 60,
      modal: 70,
      tooltip: 80,
      notification: 90,
    },
    elevation: {
      sm: '0 1px 3px rgba(0, 0, 0, 0.40)',
      md: '0 4px 12px rgba(0, 0, 0, 0.50)',
      lg: '0 8px 24px rgba(0, 0, 0, 0.65)',
      glass: '0 12px 36px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    },
    motion: {
      fast: '120ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      normal: '200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      moderate: '320ms cubic-bezier(0.16, 1, 0.3, 1)',
    },
  },
} as const