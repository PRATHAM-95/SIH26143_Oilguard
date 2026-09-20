# OilGuard Design Plan: "Instrument at Sea"

Generated during Milestone M1.
This document defines the visual design system, token architecture, typographic hierarchy, ASCII wireframes for all 7 routes, and an explicit verification pass against the MASTER_BRIEF §6.5 avoid-list.

---

## 1. Core Visual Concept: "Instrument at Sea"

OilGuard is designed not as a generic SaaS web dashboard, but as a **high-precision maritime forensic instrument** mounted on an Admiralty nautical chart.

### 1.1 Structural Metaphor: The Graticule Frame
- Surrounding the primary map viewport is a fine 1px hairline graticule frame (`chartline: #1E3550`).
- The graticule ticks are **functional information, not decoration**: they dynamically calculate and display the **real latitude and longitude coordinates** corresponding to the visible bounds of the viewport.
- As the user pans, zooms, or pitches the map, the tick labels update smoothly with `tabular-nums` monospace formatting.

### 1.2 Depth Through Restraint
- **No heavy drop shadows or saturated glowing neon outlines**.
- Depth is achieved via **disciplined tonal layering**:
  1. Base void: `abyss (#050B14)`
  2. Deep panels and rails: `trench (#0B1A2B)`
  3. Raised actionable surfaces and active tabs: `deck (#122336)`
  4. Hairline separators and graticule borders: `chartline (#1E3550)`
- Floating overlays over the map use restrained dark glass (`rgba(11, 26, 43, 0.85)` with `backdrop-filter: blur(8px)`) with crisp 1px chartline borders.

### 1.3 The Signature Moment: Thin-Film Oil Sheen
- A vibrant, thin-film iridescent gradient:
  `--gradient-sheen: linear-gradient(115deg, #7B61FF 0%, #2DD4BF 38%, #F2C14E 68%, #EF6461 100%)`
- **Reserved exclusively for oil manifestations**:
  - The SAR slick candidate polygon boundary.
  - The 3D oil slick in the hero ocean scene.
  - The oil slick layer in the 9-layer exploded evidence stack.
- It is never used on generic buttons, cards, headers, or backgrounds. The rest of the interface remains calm, austere, and disciplined.

---

## 2. Design Tokens & Palette

### 2.1 Color Tokens (Tailwind v4 `@theme`)

```css
@theme {
  /* Tonal Palette */
  --color-abyss:     #050B14;  /* Deep oceanic base background */
  --color-trench:    #0B1A2B;  /* Structural panels, side drawers, command spine */
  --color-deck:      #122336;  /* Raised cards, active stage surfaces, inspector wells */
  --color-chartline: #1E3550;  /* 1px hairlines, graticule rules, dividers */

  /* Text & Contrast (WCAG 2.2 AA / AAA compliant) */
  --color-foam:      #E8F0F7;  /* Primary headings, active metrics (16.8:1 contrast on abyss) */
  --color-mist:      #9DB2C8;  /* Secondary descriptions, stage summaries (7.8:1 contrast) */
  --color-dim:       #5F7690;  /* Tertiary readouts, units, disabled states (4.6:1 contrast) */

  /* Nautical Sonar Accent (Single restrained accent) */
  --color-sonar:     #4FD1E8;  /* Active focus rings, selected tracks, current stage marker */

  /* Status Semantics */
  --color-ok:        #3DD68C;  /* Completed stages, live links, healthy telemetry */
  --color-warn:      #F2B84B;  /* Controlled demo data, warnings, anomalies */
  --color-danger:    #F0616D;  /* Failed steps, high-probability culprit candidate */

  /* Signature Iridescent Gradient */
  --gradient-sheen:  linear-gradient(115deg, #7B61FF 0%, #2DD4BF 38%, #F2C14E 68%, #EF6461 100%);
}
```

### 2.2 Typography Roles (Self-Hosted via `@fontsource-variable/*`)

| Role | Font Family | Variable Axes / Weights | Usage |
|---|---|---|---|
| **UI & Headings** | **Schibsted Grotesk** | Weight 400 to 700 | Navigation labels, panel titles, button text, dialog headers, table headers. Clean, authoritative Scandinavian sans-serif. |
| **Forensic Dossier** | **Newsreader** | Optical size 6-72, Weight 400/500 | Narrative case overview, method summaries, limitation disclosures, incident report body text. Maximum readability, line-length capped under 80ch. |
| **Technical Values** | **JetBrains Mono** | Weight 400/500, `tabular-nums` | Latitude/longitude, UTC Zulu timestamps, MMSI, IMO, speeds (knots), headings (°), confidence scores (0.00-1.00), distances (km). |

---

## 3. Provenance System (Amendment 1 Specification)

In strict accordance with the Master Brief §3.2 and Amendment 1:
- **NO CHIPS, PILLS, OR ROUNDED BADGES** for data provenance.
- Provenance is rendered as **small clean text with an inline status dot** (`w-1.5 h-1.5 rounded-full inline-block mr-1.5`):

| Provenance Kind | Status Dot Color | Display Label | Exact Semantic Meaning |
|---|---|---|---|
| `live` | `#3DD68C` (green) | `● Live` | Real-time observation, live AIS feed, or active telemetry stream. |
| `controlled` | `#F2B84B` (amber) | `● Controlled` | Controlled demo scenario (e.g. simulated spill in real AIS historical traffic). |
| `simulated` | `#4FD1E8` (sonar) | `● Simulated` | Model simulation output (OpenDrift forward particles, synthetic slick). |
| `awaiting` | `#5F7690` (dim) | `○ Awaiting acquisition` | Awaiting scheduled satellite pass or pipeline trigger. |
| `uncalculated` | `#5F7690` (dim) | `○ Not yet calculated` | Pending antecedent stage in the 8-stage sequence. |
| `unavailable` | `#5F7690` (dim) | `○ Unavailable` | Sensor offline, ERA5/CMEMS feed unreachable. |
| `empty` | `#5F7690` (dim) | `○ No data` | Query returned zero records in spatial/temporal window. |

---

## 4. ASCII Wireframes by Route

### 4.1 Route `/` — Command Center (Operational Theater)
```
+---+-------------------------------------------------------------------------------+
|   | OPERATIONAL BAR: [◈ Case: SIM-84920] [● Live AIS] [UTC: 14:32:05Z] [Ctrl+K]  |
| C +-------------------------------------------------------------------------------+
| M | GRATICULE TOP (Lat: 15°30'00"N ··········································)    |
| D | +---------------------------------------------------------+--------------------+ |
|   | |                                                         | CONTEXTUAL CONSOLE | |
| S | |                                                         | Stage: ATTRIBUTION | |
| P | |                      MAP THEATER                        | Status: ● Live     | |
| I | |                                                         |                    | |
| N | |     ▲ Vessel A (12.4 kn)                                | Top Candidate:     | |
| E | |                                                         | MT PACIFIC STAR    | |
|   | |            ◈ Estimated Origin (90% conf)                | MMSI: 412984920    | |
| C | |            /                                            | Score: 0.892       | |
| C | |           /                                             |                    | |
|   | |          * Observed Slick (SAR)                         | Factor Breakdown:  | |
| S | |                                                         | Spatial    [======]| |
| I | |                                                         | Temporal   [===== ]| |
| M | |                                                         | Trajectory [===== ]| |
|   | |                                                         | Anomaly    [====  ]| |
| I | |                                                         | Envr       [======]| |
| N | |                                                         |                    | |
| V | | [Layers ▤]                           [Inspector ℹ]      | [Open Dossier →]   | |
|   | +---------------------------------------------------------+--------------------+ |
|   | FLIGHTPATH: 1.Det ● ── 2.Char ● ── 3.Env ● ── 4.Drift ● ── 5.Bck ● ── 6.Ais ● ── 7.Atr ● ── 8.Con ○ |
+---+-------------------------------------------------------------------------------+
```

### 4.2 Route `/simulation` — Scenario Control Room
```
+---+-------------------------------------------------------------------------------+
|   | OPERATIONAL BAR: Fleet Simulation [Case: SIM-84920] [Mode: Captain]           |
| C +-------------------------------------------------------------------------------+
| M | +-------------------------+---------------------------------------------------+ |
| D | | SCENARIO CONTROLS       | FLEET POSITION & DRIFT MAP                        | |
|   | | Active: SIM-84920       |                                                   | |
| S | | Clock: 2026-09-20T12:00Z|       ▲ Nordic Hawk                               | |
| P | |                         |                                                   | |
| I | | [Start] [Pause] [+1h]   |                  ▲ Pacific Star                   | |
| N | |                         |                   (Selected)                      | |
| E | | VESSEL MANEUVERING      |                     * Spill Release Point         | |
|   | | Selected: Pacific Star  |                      ░░░ Forward Drift Particles  | |
|   | | Lat: 14.520 Lon: 72.410 |                                                   | |
|   | | Speed: 14.2 kn          |                                                   | |
|   | | Heading: 245°           |                                                   | |
|   | | [Reposition Vessel]     |                                                   | |
|   | |                         |                                                   | |
|   | | [Release Oil Spill]     |                                                   | |
|   | | [Run Forward Drift]     |                                                   | |
|   | +-------------------------+---------------------------------------------------+ |
|   | TIME SCRUBBER: [◀◀] [▶] [▶▶] ├───●──────────────────────────┤ 12:00Z (+04:00) |
+---+-------------------------------------------------------------------------------+
```

### 4.3 Route `/investigation` — 8-Stage Forensic Pipeline
```
+---+-------------------------------------------------------------------------------+
|   | OPERATIONAL BAR: Investigation Pipeline [INV-2026-092] [Progress: 87%]        |
| C +-------------------------------------------------------------------------------+
| M | +------------------------------------+----------------------------------------+ |
| D | | 8-STAGE SEQUENCE                   | EVIDENCE WORKSPACE (Selected: Stage 5) | |
|   | | 1. Detection        ● Completed    |                                        | |
| S | | 2. Characterization ● Completed    | STAGE 5: BACKTRACKING ENSEMBLE         | |
| P | | 3. Environment      ● Completed    | Status: ● Completed                    | |
| I | | 4. Forward Drift    ● Completed    | Provenance: ● Simulated (OpenDrift)    | |
| N | | 5. Backtracking     ● Completed ◄  | Model Version: v2.4.1-ensemble         | |
| E | | 6. AIS Analysis     ● Completed    |                                        | |
|   | | 7. Attribution      ● Completed    | Estimated Origin: 14.281°N, 72.194°E   | |
|   | | 8. Conclusion       ○ Pending      | Uncertainty Radius: 4.8 km             | |
|   | |                                    | Time Window: -6h to -12h               | |
|   | | [Retry Stage] [Cancel Run]         | Trajectory Agreement: 0.91             | |
|   | |                                    | Ensemble Convergence: 88/100 members   | |
|   | | GROUND TRUTH VERIFICATION          |                                        | |
|   | | [Reveal Benchmark Ground Truth]    | [View Ensemble Map] [Inspect Vectors]  | |
|   | +------------------------------------+----------------------------------------+ |
+---+-------------------------------------------------------------------------------+
```

### 4.4 Route `/backtracking` — Inverse Drift Analysis
```
+---+-------------------------------------------------------------------------------+
|   | OPERATIONAL BAR: Inverse Lagrangian Backtracking [Run: BT-7721]               |
| C +-------------------------------------------------------------------------------+
| M | +----------------------------------------------+------------------------------+ |
| D | | BACKTRACKING MAP THEATER                     | ENSEMBLE TELEMETRY           | |
|   | |                                              | Members: 100 particles       | |
| S | |             - - - 90% Confidence Contour     | Duration: 12 hours backward  | |
| P | |           /       \                          | Environment: CMEMS + ERA5    | |
| I | |          |    ◈    |  Origin Estimate        |                              | |
| N | |           \       /                          | UNCERTAINTY PROFILE          | |
| E | |             - - -                            | Trajectory Agreement: 0.89   | |
|   | |             \  \                             | Source Conc.: High           | |
|   | |              \  \ Backward Trajectories      | Spatial Spread: ±4.8 km      | |
|   | |               \  \                           |                              | |
|   | |                * Slick Point (T0)            | TIME WINDOW ESTIMATE         | |
|   | |                                              | Earliest: 03:15Z             | |
|   | |                                              | Preferred: 05:30Z            | |
|   | |                                              | Latest: 07:45Z               | |
|   | +----------------------------------------------+------------------------------+ |
|   | ENSEMBLE TIMELINE: 00:00Z ────────────●──────────────────────── 12:00Z        |
+---+-------------------------------------------------------------------------------+
```

### 4.5 Route `/attribution` — Candidate Ranking & 3D Vessel Inspector
```
+---+-------------------------------------------------------------------------------+
|   | OPERATIONAL BAR: Vessel Attribution & Forensic Ranking [Case: INV-2026-092]   |
| C +-------------------------------------------------------------------------------+
| M | +------------------------------------------------+----------------------------+ |
| D | | CANDIDATE RANKING TABLE (Virtualized)          | 3D VESSEL INSPECTOR        | |
|   | | # | Vessel Name     | MMSI      | Score | Rank | +------------------------+ | |
| S | |---|-----------------|-----------|-------|------| |    [ 3D Ship Mesh ]    | | |
| P | | 1 | MT PACIFIC STAR | 412984920 | 0.892 | Culpr| |  Crude Oil Tanker     | | |
| I | | 2 | NORDIC VOYAGER  | 219384012 | 0.412 | Clear| |  Representative Model  | | |
| N | | 3 | EVER GLORY      | 352918231 | 0.285 | Clear| +------------------------+ | |
| E | | 4 | OCEAN NAVIGATOR | 636018293 | 0.190 | Clear| "Representative model,     | |
|   | |                                                | not vessel-specific geom"  | |
|   | | FIVE-FACTOR FORENSIC SCORE BREAKDOWN           |                            | |
|   | | Spatial Proximity:   0.94 [█████████ ] 2.1 km  | MMSI: 412984920            | |
|   | | Temporal Agreement:  0.88 [████████  ] 14 min  | Closest Approach: 05:44Z   | |
|   | | Track Correlation:   0.91 [█████████ ]         | Min Distance: 2.1 km       | |
|   | | Speed Anomaly:       0.79 [███████   ] -4.2 kn | Course: 244° at 14.1 kn    | |
|   | | Drift Compatibility: 0.94 [█████████ ]         | Flag: Liberia (LR)         | |
|   | +------------------------------------------------+----------------------------+ |
+---+-------------------------------------------------------------------------------+
```

### 4.6 Route `/report` — Forensic Incident Dossier (Document & Print CSS)
```
+---+-------------------------------------------------------------------------------+
|   | DOSSIER NAVIGATION: [Print PDF] [Download JSON] [Verify Hash: 7a8f...c912]    |
| C +-------------------------------------------------------------------------------+
| M | +---------------+-------------------------------------------------------------+ |
| D | | SECTION INDEX | MARITIME INCIDENT ATTRIBUTION DOSSIER                       | |
|   | | 01. Summary   | Case Reference: OILGUARD-2026-092                           | |
| S | | 02. Detection | Date of Incident: 2026-09-20 05:30:00 UTC                   | |
| P | | 03. Metocean  |                                                             | |
| I | | 04. Drift     | 1. EXECUTIVE SUMMARY                                        | |
| N | | 05. Backtrack | On 20 September 2026, Sentinel-1 SAR acquisition detected a | |
| E | | 06. AIS Fleet | verified oil slick of 14.2 km² in the Arabian Sea...        | |
|   | | 07. Scoring   | Forensic backtracking and AIS trajectory reconstruction     | |
|   | | 08. Verdict   | attribute the discharge to MT PACIFIC STAR (MMSI 412984920) | |
|   | | 09. Caveats   | with a composite confidence score of 0.892.                 | |
|   | |               |                                                             | |
|   | |               | 2. EVIDENCE CONVERGENCE SUMMARY                             | |
|   | |               | [Static SVG Vector Chart: Trajectories converging on slick] | |
|   | |               |                                                             | |
|   | |               | 3. METHODOLOGICAL LIMITATIONS & UNCERTAINTIES               | |
|   | |               | - Metocean Forcing: ERA5 wind resolution 0.25°              | |
|   | |               | - AIS Coverage: 42-minute latency gap between 04:18-05:00Z  | |
|   | +---------------+-------------------------------------------------------------+ |
+---+-------------------------------------------------------------------------------+
```

### 4.7 Route `/welcome` — Cinematic Pinned Scroll Narrative (New in M6)
```
+-----------------------------------------------------------------------------------+
| OILGUARD MARITIME FORENSICS                                      [Open Console →] |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                                                                                   |
|                            [ 3D REAL-TIME OCEAN ]                                 |
|                         Gerstner Wave GLSL Shader                                 |
|                                                                                   |
|                          ▲ Rocking Crude Tanker                                   |
|                                                                                   |
|                        ░░░ Iridescent Thin-Film                                   |
|                            Oil Sheen Surface                                      |
|                                                                                   |
|                "From a satellite detection to an attributable vessel."             |
|                                                                                   |
|                                                                                   |
|                              Scroll to investigate                                |
|                                       ▼                                           |
+-----------------------------------------------------------------------------------+
| [PINNED SCENE 2: The 8-Stage Sequential Forensic Journey]                         |
| Camera lowers; layers separate into the 9-layer Exploded Evidence Stack           |
|                                                                                   |
| [PINNED SCENE 3: Evidence Convergence & Vessel Attribution]                       |
| AIS trajectories converge; ranked candidate resolves                              |
+-----------------------------------------------------------------------------------+
```

---

## 5. Section 6.5 Avoid-List Audit

Before writing any UI code, each generic anti-pattern listed in MASTER_BRIEF §6.5 is explicitly addressed:

| Forbidden Anti-Pattern | How OilGuard Strictly Prevents It |
|---|---|
| **Card-inside-card nesting** | Flat tonal hierarchy. Primary surfaces use `deck` (#122336); internal data groups are separated by crisp 1px `chartline` rules without nested rounded boxes. |
| **Every element as a rounded card** | Graded, purposeful corner radii: controls `rounded-sm` (2px), docked panels `rounded-none` (flush with graticule edges), floating map dialogs `rounded-md` (6px). Never pill-shaped everywhere. |
| **Pills and status chips everywhere** | **Eliminated by Amendment 1**: Provenance and status use clean inline text with a 6px status dot (`● Live`, `○ Simulated`), never rounded chip capsules. |
| **Tracked-out ALL-CAPS eyebrow labels** | Sentence case used for titles and descriptions. Micro-eyebrows restricted strictly to legal coordinate labels (LAT, LON, UTC). |
| **"WORD: fragment" label patterns** | Natural descriptive phrasing: "Estimated source region", "Time of closest approach", "Spatial proximity score". |
| **Middle-dot metadata strings** | Structured data rendered in tabular grids or clean definition lists, never glued together with bullet glyphs. |
| **Arrow glyphs appended to every link** | Clean semantic links or standard icons (ExternalLink, ChevronRight only where an expand/collapse drawer actually triggers). |
| **One accent word italicized in headlines** | Pure typographic weight and scale hierarchy in Schibsted Grotesk; no random italicized buzzwords. |
| **Fade-and-slide-up on every section** | Motion restricted to purposeful UI state changes (panel dock/undock, route transitions, number tweening). No gratuitous scroll entrance animations. |
| **Hover lift on every card** | No translation (`translate-y`) or shadow pop on hover. Interactive elements indicate focus via subtle border contrast (`border-chartline` to `border-sonar/50`) and background tone. |
| **Neon glows & purple-blue AI gradients** | No glowing borders or neon boxes. The iridescent sheen gradient is locked exclusively to oil slick geometry. |
| **Glassmorphism everywhere** | Heavy blur prohibited. Only small floating map coordinate HUD overlays use high-transparency dark glass (`rgba(11,26,43,0.85)`). Main surfaces are solid `trench`. |
| **Decorative radar sweeps / Cyberpunk HUDs** | No spinning radar antennas, fake targeting crosshairs, or sci-fi borders. Map controls use realistic maritime chart symbols. |
| **Monospace everywhere** | JetBrains Mono is restricted exclusively to numerical readouts, timestamps, coordinates, MMSI, and IDs. Labels and body copy are Schibsted Grotesk and Newsreader. |
| **Fake telemetry** | Provenance is verified and displayed for every metric. Uncalculated or missing values display honest empty states ("Awaiting acquisition", "Not yet calculated"). |
