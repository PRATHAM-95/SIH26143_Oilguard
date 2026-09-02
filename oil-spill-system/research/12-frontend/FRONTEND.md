# Frontend Architecture

## Recommended Stack
| Component | Technology | Why |
|-----------|-----------|-----|
| **Framework** | React 18 + TypeScript | Modern, type-safe |
| **Build** | Vite | Fast dev experience |
| **Map** | MapLibre GL JS (via react-map-gl) | Open source, WebGL |
| **Overlay** | deck.gl | High-performance vessel/trajectory layers |
| **Wind Viz** | maplibre-gl-wind | GPU particle animation |
| **Charts** | Recharts | Lightweight, React-native |
| **State** | Zustand | Simple, no boilerplate |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid UI development |
| **Animation** | Framer Motion | Smooth transitions |

## Screen Architecture (4 Main Views)

### View 1: COMMAND CENTER (Default)
```
+-------------------------------------------------------+
| HEADER: Logo | Simulation Clock | Mode Toggle          |
+----------+-------------------------------+-----------+
|          |                               |           |
| LEFT     |     MAIN MAP                  | RIGHT     |
| SIDEBAR  |     (MapLibre+deck)           | PANEL     |
|          |                               |           |
| Phase    |   Vessel markers              | Info      |
| Select   |   Oil slick overlay           | Cards     |
| Tools    |   Current vectors             | Charts    |
| Status   |   Wind particles              | Alerts    |
|          |   Trajectory lines            |           |
+----------+-------------------------------+-----------+
| BOTTOM: Timeline | Playback Controls | Legend          |
+-------------------------------------------------------+
```

### View 2: INVESTIGATION
- Map (50%), Left (investigation log), Right (evidence), Bottom (backtracking timeline)

### View 3: ATTRIBUTION
- Map (40%), Left (vessel ranking), Right (evidence), Bottom (score charts)

### View 4: REPORT
- Summary metrics, side-by-side comparison, timeline, download

## UI Phases
| Phase | Name | Main Controls |
|-------|------|---------------|
| A | Captain Mode | Vessel selector, speed/heading controls, spill button |
| B | Simulation | Time advance (+1h, +6h), environmental overlay |
| C | Investigation | "Start AI Investigation" button, progress indicators |
| D | Backtracking | Reverse trajectory animation, uncertainty region |
| E | Attribution | Vessel ranking table, evidence cards |
| F | Ground Truth | "Reveal Truth" button, error metrics |

## MapLibre GL JS (Recommended)
- **License:** BSD-3-Clause (open source)
- **React integration:** `react-map-gl/maplibre`
- **Performance:** WebGL GPU-accelerated
- **Vector tiles:** Yes
- **Custom layers:** Yes (deck.gl integration)
- **Used by:** RADAR, BridgeView AIS, Weatherman

## deck.gl Integration
- **IconLayer:** Vessel markers with heading rotation
- **TripsLayer:** Vessel trail animation
- **ScatterplotLayer:** Oil spill extent
- **HeatmapLayer:** Origin probability surface
- **TileLayer:** Satellite imagery tiling

## Wind/Current Particle Animation
- **maplibre-gl-wind:** GPU-accelerated particle system
- **webgl-wind:** Up to 1M particles at 60fps
- **Speed-based color gradients** (Windy.com style)

## Color Theme
- **Dark mode (maritime):** #0B1517 background, #1C6999 cyan accent
- **Alerts:** Red (critical), Orange (warning), Yellow (caution), Blue (info)
- **Vessels:** Color-coded by type/speed/status
