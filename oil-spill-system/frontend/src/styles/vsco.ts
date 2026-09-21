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
    bg: '#070B10',
    elev: '#0B1118',
    panel: '#0B1118',
    panel2: '#111923',
    panel3: '#182433',
    inset: '#05080D',
    glass: 'rgba(11, 17, 24, 0.88)',
    line: '#273340',
    lineStrong: '#38485B',
    text: '#F8F7F4',
    textDim: '#B2BBC5',
    textFaint: '#727D89',
    porcelain: '#F8F7F4',
  },

  accent: {
    signalBlue: '#0057FF',
    signalBlueStrong: '#3378FF',
    signalBlueSubtle: 'rgba(0, 87, 255, 0.12)',
    cyan: '#0057FF',
    cyanStrong: '#3378FF',
    cyanSubtle: 'rgba(0, 87, 255, 0.12)',
  },

  ok: '#00D98B',
  warn: '#FFB020',
  danger: '#FF4D5A',

  /** Discipline hues (RGB arrays for deck.gl layers). */
  evidence: {
    dim: [114, 125, 137] as const,
    slick: [186, 110, 48] as const, // observed spill point
    vessel: [178, 187, 197] as const, // standard vessel silhouette
    selectedVessel: [248, 247, 244] as const, // Porcelain highlight
    selectionRing: [0, 87, 255] as const, // Signal Blue selection
    trail: [39, 51, 64] as const, // recorded vessel tracks (chartline)
    selectedTrail: [0, 87, 255] as const, // selected vessel track (Signal Blue)
    origin: [255, 176, 32] as const, // probable source
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
      sans: "'Schibsted Grotesk Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      serif: "'Newsreader Variable', Georgia, serif",
      mono: "'JetBrains Mono Variable', 'Cascadia Code', Consolas, monospace",
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