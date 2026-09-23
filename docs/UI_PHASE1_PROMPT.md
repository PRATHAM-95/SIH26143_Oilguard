# PHASE 1 — CONVERT CURRENT UI INTO THE TARGET OILGUARD COMMAND CENTER

> NOTE TO THE UI AI — READ THIS FIRST
> These notes were added by the engineering team so you do not break existing functionality.

1. The real app routes are EXACTLY six: `Command Center`, `Simulation`, `Investigation`, `Backtracking`, `Attribution`, `Report`. The sidebar and any top navigation MUST use these six labels only. Do NOT invent pages like "Incidents", "Vessels", "Analytics", or "Settings" — they do not exist.
2. The right-rail panels `CandidateRail`, `EvidenceChain`, `SarObservationPanel`, and `CaptainSimulationPanel` are real, wired to live backend data. Do NOT delete or rebuild their internals. You are only re-skinning and grouping them. Reuse their existing components and data hooks.
3. The app already has a theme system in `src/index.css` CSS custom properties: `--bg`, `--bg-elev`, `--panel`, `--panel-2`, `--panel-3`, `--inset`, `--line*`, `--ink-0..3`, `--accent` (#38bdf8), `--accent-strong`, `--ok`, `--warn`, `--danger`, `--mono`, `--sans`, `--header-h:44px`, `--rail-w:52px`, `--panel-w:344px`, `--radius:3px`, and discipline hues `--c-sar`, `--c-drift`, `--c-source`, `--c-vessel`, `--c-trail`, `--c-footprint`, `--c-sat`. Mirror values for deck.gl in `src/styles/vsco.ts` (`VSCO` object). Adjust these existing tokens toward the target palette below — do NOT introduce a second theme system. Increase `--radius` from 3px to 8–12px.
4. The map uses `react-map-gl` + `maplibre-gl` + `deck.gl`, basemap OpenFreeMap dark. It is already a realistic dark ocean map. Do not swap the basemap.
5. The following items are NEW BUILDS and do not exist yet — build them fresh: global header, labeled sidebar, tab component, "Analysis & Control" shell, "Run New Analysis" action, analysis-type 2x2 cards, KPI stat cards, alert banner, activity/event log timeline, area-of-interest card, oil-slick detail popup, map legend, compact intervention progress strip.
6. The investigation pipeline exists as `InvestigationTimeline` (bottom dock, 8 stages), `InvestigationStepper` (top strip) and `InvestigationPipeline` (sidebar). Do not delete these — the "intervention progress" section below means compacting their presentation, not rebuilding.
7. Do not fabricate scientific results. Show explicit empty/loading states when the backend has no data.

---

## Objective

Transform the existing Maritime Oil Spill Intelligence / OilGuard dashboard from the current dark prototype interface into a polished, production-grade maritime intelligence command center.

## Reference hierarchy

There are two references:
- CURRENT UI: the first screenshot — this is what has currently been generated.
- TARGET UI: the second screenshot — this is the visual and structural direction we want.
The target screenshot is the primary design reference.

Do not redesign the product concept. Do not change the application's functionality. Do not invent a completely different dashboard.

Instead, preserve the existing functionality and data while restructuring the interface so it visually and spatially resembles the target.

## 1. PRIMARY DESIGN TRANSFORMATION

The current interface has too much of the following:
- empty dark space
- floating technical boxes
- thin low-contrast borders
- disconnected panels
- excessive HUD-style elements
- overly compressed typography
- multiple competing status indicators
- large map with very little meaningful visualization
- bottom pipeline occupying valuable map space
- right-side panels that look like debugging/placeholder panels

The target should instead feel like:
A professional maritime surveillance and oil-spill investigation platform used by analysts in an operations center.

Think: Marine GIS + satellite intelligence + vessel tracking + investigation workstation
rather than: Sci-fi HUD / developer dashboard / simulation debug screen.

## 2. GLOBAL VISUAL LANGUAGE

Use the second screenshot as the visual language.

Overall style: dark maritime intelligence interface, professional, operational, information-dense but organized, high readability, modern enterprise dashboard, GIS/satellite-analysis aesthetic, subtle futuristic elements. Avoid excessive cyberpunk styling.

Background: very dark navy/blue-black foundation.

Target palette (adjust the existing `:root` tokens — do not create a duplicate theme):
- Application background: `#06101A`
- Panel background: `#091722`
- Secondary panel: `#0C1B28`
- Border: `#163447`
- Primary cyan: `#00BFFF` (keep an eye on `--accent: #38bdf8`; converge on whichever reads best)
- Bright cyan accent: `#00D9FF`
- Green operational: `#00D084`
- Warning amber: `#FFB020`
- Danger red: `#FF4655`
- Primary text: `#E7F2F8`
- Secondary text: `#8BA3B5`
- Muted text: `#526A7A`

Do not make the entire UI pure black. Do not use bright neon everywhere. Cyan is an accent, not the background.

## 3. APPLICATION SHELL

Replace the current loose layout with a clear application shell, four major regions (here illustrated with the sidebar, main map, and right analysis panel between a global header and status footer). The current shell already has `App.tsx` → `Layout.tsx` (header + icon rail + main) and `MissionWorkspace.tsx` (toolbar / map / dock / rail). Refactor these toward the target proportions.

## 4. GLOBAL HEADER

Create a strong top navigation/header (`Layout.tsx` already has a header — restyle it).

Left side:
- Display: `MARITIME OIL SPILL INTELLIGENCE`
- Small subtitle: `DETECT • TRACE • ATTRIBUTE • PROTECT`
- Include the OilGuard / maritime logo. Strong but compact.

Center / upper status area — compact status pills:
- MongoDB — Online
- Satellite Feed — Online
- AIS Feed — Online
- Drift Engine — Online
Each: small status dot + system name + state in a subtle rounded container. Green = operational. Keep existing `HeaderStatus` wiring and health probe values.

Right side:
- light/dark appearance control (optional; keep if cheap)
- current UTC time
- current local time
- analyst/user profile: avatar initials, user name, role, dropdown indicator

Example:
```
2026-09-22 16:52:18 UTC
2026-09-22 22:22:18 IST

NS
Nikhil Singh
Analyst
⌄
```

## 5. LEFT SIDEBAR

The current sidebar is a narrow icon-only rail (`--rail-w: 52px`, `src/components/Layout.tsx`). Replace it with a labeled navigation sidebar, width ~90–110px.

REAL NAVIGATION ITEMS (must match routes exactly):
- Command Center
- Simulation
- Investigation
- Backtracking
- Attribution
- Report

Each item: icon + label. Active item: cyan/blue accent, subtle background, left-side active indicator, bright icon, readable text. No huge icons. Not a spaceship control panel.

## 6. TOP APPLICATION NAVIGATION (module strip)

Below the global header, keep a horizontally arranged module strip using the existing investigation stage labels from `src/store/investigationStore.ts` (`STAGE_ORDER`): DETECTION → CHARACTERIZATION → ENVIRONMENT → FORWARD DRIFT → BACKTRACKING → AIS ANALYSIS → ATTRIBUTION → CONCLUSION.

This is a process-state indicator, NOT clickable routes. The selected/current module uses the cyan/blue treatment. It should visually replace the current fragmented pipeline feel at the top. Do not wire these to routes.

## 7. MAIN MAP — MOST IMPORTANT CHANGE

The map is the visual center. It already exists (`src/components/map/MapView.tsx`, `react-map-gl` + `maplibre-gl` + `deck.gl`, OpenFreeMap dark basemap). Keep the basemap. Keep the fit/view logic. The map should show the Indian Ocean region: Arabian Sea, Bay of Bengal, India, Sri Lanka, Pakistan, Oman, Yemen, Saudi Arabia, Bangladesh, Myanmar, Indonesia, Maldives, East Africa. Let the user pan/zoom; use a sensible initial fit to the Indian Ocean region.

## 8. MAP VISUALIZATION

Keep the existing deck.gl layers (vessels, trails, spill markers, SAR slicks, drift particles, backtracking fans, source contours, candidate vessels, selection ring). Restyle the markers to be operationally legible:

- Oil spills: high severity = red/orange glow; medium = yellow/orange glow. The largest detected slick gets a glowing boundary + irregular polygon + center marker (the OBSERVED SPILL marker already exists — restyle to match, not a Google pin).
- Vessels: keep `--c-vessel` cyan symbols. Differentiate via the catalog: AIS vessel, candidate vessel, investigated vessel, high-interest vessel. No oversized icons. Ocean should have enough vessel information to look operational.

## 9. ENVIRONMENTAL LAYERS

Layer toggles already exist (`src/components/ui/MapLayersPanel.tsx` + `src/store/mapStore.ts` `MAP_LAYER_CATALOG`, 13 layer ids). Keep the catalogue-driven approach. Present as compact toggle chips: Oil Spills, Vessels, EEZ Boundaries, Satellite Passes, Ocean Currents, Wind Vectors. Selected = cyan; inactive = dark/neutral. Keep the honesty footer and the no-data disabled rows.

## 10. MAP OVERLAY — AREA OF INTEREST

Place an integrated card in the upper-left of the map (in Command Center the existing `SourceHero` sits there — restyle rather than build a second card):

```
AREA OF INTEREST
Indian Ocean Region
25.0°S – 30.0°N
30.0°E – 110.0°E
Monitoring oil spills, vessel activity
and environmental data across the Indian Ocean
```

Dark translucent background, subtle border, 12–16px radius, small uppercase heading. Must feel integrated into the map, not an opaque floating window.

## 11. OIL-SLICK DETAIL POPUP

When an oil spill is selected, display a professional investigation popup (an upgraded `ContextualPanel` for spill objects):

```
SLICK-2026-0922-001                     ×

[ SAR IMAGE ]

12.4°N, 71.2°E
Arabian Sea

Detected: 2 hrs ago
Area: 2.4 km²
Confidence: 92%

                         HIGH
[ Open Full Case → ]
```

Should look like an actual intelligence record. Keep the provenance badge for the source.

## 12. RIGHT ANALYSIS PANEL

This is one of the most important Phase 1 changes.

Replace the current loose collection of right-rail panels (Candidate vessels, Evidence Chain, SAR observation, Captain simulation) with a unified `ANALYSIS & CONTROL` shell — but REUSE the existing components and their data wiring:
- `src/components/commandcenter/CandidateRail.tsx` (Candidate vessels)
- `EvidenceChain` / `InvestigationControls` in `src/components/investigation/Stepper.tsx` (Evidence chain)
- `SarObservationPanel` in `src/components/investigation/SarObservation.tsx` (SAR observation)
- `CaptainSimulationPanel` inline in `src/pages/CommandCenter.tsx` (Captain simulation)

Width ~400–460px (existing `--panel-w: 344px` — adjust toward the target). Persistent.

Do not rebuild these components. Group and re-skin them inside the new shell.

## 13. RIGHT PANEL TABS

Top of the panel: `Quick Analysis | Simulation | Vessel Search | Reports`
The active tab: cyan, subtle blue background, clear underline/accent. Build a small `Tabs` component (none exists yet).

Tab to panel mapping (keep existing data flows):
- Quick Analysis → Run New Analysis + analysis types + filters + recent activities
- Simulation → existing Captain/Simulation controls (`CaptainSimulationPanel`, simulation store)
- Vessel Search → existing candidate/vessel content (`CandidateRail` when used in search context)
- Reports → link/shortcut to the Report page content

## 14. QUICK ANALYSIS TAB

Prominent section: `RUN NEW ANALYSIS`
"Use satellite data and environmental models to detect, track and attribute oil spills."
Button: `[ ▶ START ANALYSIS → ]` — prominent cyan/blue primary action. This must trigger the existing `runLiveChallenge`/analysis flow in `src/components/commandcenter/ChallengeRunner.ts` (do not replace it).

## 15. ANALYSIS TYPE (2x2 grid)

```
┌────────────────────┬────────────────────┐
│ Detection           │ Backtracking       │
│ Find oil spills     │ Trace to source    │
├────────────────────┼────────────────────┤
│ Forward Drift       │ Vessel Attribution │
│ Predict movement    │ Identify vessels   │
└────────────────────┴────────────────────┘
```

Each card: icon, title, one-line explanation. Selected = cyan border + subtle cyan background. (Closest existing: `ui/DataSourceCard.tsx` — reuse its styling.)

## 16. FILTER CONTROLS

Below the analysis type:
- DATE RANGE `[ Last 7 days ▼ ]`
- REGION `[ Indian Ocean ▼ ]`
Compact professional form controls. If the backend does not currently support filtering, keep the controls but do not silently fake results — show an empty/loading state.

## 17. RECENT ACTIVITIES

Create an activity timeline (NEW — the existing `InvestigationTimeline` is a stage progress bar, not an event log; do not confuse the two):

```
RECENT ACTIVITIES                         View All →

● 14:32   SAR scene acquired
          Sentinel-1

● 14:41   Oil slick detected
          Area 2.4 km²

● 14:43   Backtrack started
          500 particles

● 14:45   3 vessels scored
          Top candidate: GMV ARIES
```

Status-colored dots. Feed it from the live WebSocket event stream already connected by `src/hooks/useSimulationConnection.ts` / `useInvestigationConnection.ts` — mirror the events they already route into the stores.

## 18. MAP CONTROL BUTTONS

Right edge of the map, compact vertical controls: search, zoom in, zoom out, locate, measure, layers. Small and consistent. (deck.gl/maplibre already have zoom controls — restyle them.)

## 19. MAP LEGEND

Bottom of the map: compact dark translucent container:
```
● Oil Spill (High)
● Oil Spill (Medium)
▲ Vessel (AIS)
┄ EEZ Boundary
┄ Shipping Lane
```
The existing `MapLayersPanel` already doubles as a legend (color swatches from `MAP_LAYER_CATALOG`) — reuse it; don't build a competing legend.

## 20. REMOVE THE CURRENT BOTTOM PIPELINE AS A DOMINANT ELEMENT

Keep the functionality. Convert the existing bottom dock (`InvestigationTimeline`, 8 stages) into a compact investigation-progress component shown only when an analysis is active:

```
DETECTION ✓  CHARACTERIZATION ✓  ENVIRONMENT ✓  FORWARD DRIFT ●  BACKTRACKING ○  AIS ○  ATTRIBUTION ○
```

Significantly smaller. Must not cover the map.

## 21. SYSTEM ALERT AREA

Compact alert state at top-right:
- Normal: `NO ACTIVE ALERTS — System nominal`
- Critical: `1 ACTIVE ALERT — Investigation requires attention`
Red only for actual alert states, never decoration.

## 22. TYPOGRAPHY

Modern technical UI font: Inter / IBM Plex Sans / Roboto. IBM Plex Mono only for small technical labels — not the whole interface (current UI overuses monospace).

Hierarchy:
- Main title 18–20px
- Navigation 13–14px
- Section heading 11–12px uppercase
- Main body 13–14px
- Metadata 11–12px
- Map labels 12–16px depending on importance
Use letter spacing sparingly.

## 23. BORDER SYSTEM

Subtle borders:
- Default: `1px solid rgba(60,130,160,0.20)`
- Active: `1px solid #00BFFF`
- Warning: `1px solid #FFB020`
- Danger: `1px solid #FF4655`
Do not outline every element in bright cyan.

## 24. CARD SYSTEM

Consistent card language: border-radius 8–12px, dark navy background, subtle blue-gray border. Avoid excessive rounded-pill UI. Pills only for status, filters, compact tags, system states.

## 25. SPACING SYSTEM

Consistent scale: 4 / 8 / 12 / 16 / 20 / 24 / 32px. Deliberate alignment, no randomly placed panels.

## 26. INFORMATION DENSITY

Information-dense but not cluttered. Every visible element has a purpose. Remove: random status boxes, decorative HUD lines, unnecessary technical labels, duplicated pipeline indicators, placeholder cards, empty evidence containers, oversized empty panels.

## 27. RESPONSIVE BEHAVIOR

- Desktop: sidebar ~96px, main flexible, analysis panel 400–460px. Map consumes remaining space.
- Smaller desktop: shrink analysis panel, collapse secondary labels, preserve map visibility, keep primary controls accessible. The right panel must not consume most of the screen.

## 28. DATA SHOULD LOOK REAL, BUT DO NOT INVENT BACKEND RESULTS

Use existing demo/controlled data where the app already supports it (all provenance-labelled). Do not fabricate scientific results, satellite observations, vessel attribution, or environmental measurements as real.

If the backend has no data, show an explicit empty/loading state:
```
NO ACTIVE ANALYSIS
Start a new analysis to load satellite and environmental data.
```
Keep the existing provenance badges (REAL / CONTROLLED / FIXTURE).

## 29. PRESERVE EXISTING FUNCTIONALITY

This is a UI transformation, not a backend rewrite. Do NOT break: API calls (`src/lib/api/*`), WebSocket connections (`src/lib/ws/*`), map interactions, oil-spill detection, SAR observation, vessel data, forward drift, backtracking, AIS analysis, attribution, reports, existing routes, existing state management (zustand stores), the challenge runner (`ChallengeRunner.ts`), or the investigation pipeline. Refactor the UI around the existing functionality.

## 30. DO NOT DO THESE THINGS

Do NOT: create a completely new visual identity; make it cyberpunk; make everything neon; make everything glassmorphism; use excessive glowing borders; turn every element into a pill; cover the map with panels; use giant typography; add random charts; add fake data; add unnecessary 3D effects or animations; replace the map with a generic illustration; remove existing analytical functionality; create placeholder boxes just to fill space.

## 31. TARGET VISUAL PRIORITY

1. MAP / MARITIME SITUATION
2. ANALYSIS & CONTROL
3. GLOBAL SYSTEM STATUS
4. INCIDENT / OIL-SPILL INFORMATION
5. VESSEL / ENVIRONMENTAL LAYERS
6. INVESTIGATION PROGRESS
7. SECONDARY METADATA

The current UI feels like: technical status → pipeline → empty panels → map.
The target should feel like: maritime situation → analyst controls → evidence → investigation.

## 32. PHASE 1 SUCCESS CRITERIA

Phase 1 is complete only when:
- Overall layout resembles the second reference
- Professional labeled sidebar exists (6 real routes)
- Strong global header exists
- System status pills are organized
- Main map dominates the center
- Map uses a realistic dark satellite/ocean appearance (keep OpenFreeMap)
- Oil spills are visually obvious
- Vessels are visible
- Environmental layers are represented
- Area-of-interest card exists
- Selected-oil-spill popup exists
- Right-side Analysis & Control panel exists (reusing the existing rail components)
- Analysis tabs exist
- Analysis type cards exist
- Date/region controls exist
- Recent activity timeline exists
- Map controls are compact
- Map legend exists
- Investigation pipeline is compact
- Existing functionality remains intact (tests pass, WS live updates work)
- No fake scientific results are introduced
- No excessive HUD styling remains
- No large empty placeholder panels remain

## 33. IMPLEMENTATION INSTRUCTION

First inspect the existing frontend architecture and identify current components before changing code:

- App shell: `src/components/Layout.tsx`, `src/components/workspace/MissionWorkspace.tsx`
- Sidebar: `Layout.tsx` (tool rail)
- Header: `Layout.tsx` header + `HeaderStatus`
- Map: `src/components/map/MapView.tsx`, `src/components/map/overlays.tsx`, per-page maps, `src/store/mapStore.ts`
- Right panels: `src/components/commandcenter/CandidateRail.tsx`, `investigation/Stepper.tsx` (EvidenceChain/InvestigationControls), `investigation/SarObservation.tsx`, `CommandCenter.tsx` (CaptainSimulationPanel, IncidentPanel)
- Pipeline: `src/components/investigation/{InvestigationTimeline,Pipeline,Stepper}.tsx`, `src/store/investigationStore.ts`
- Shared UI: `src/components/ui/{Panel,Button,primitives,Icon,MapLayersPanel,DataSourceCard}.tsx`, `src/components/intel/IntelPanel.tsx`
- Theme: `src/index.css` custom properties + `src/styles/vsco.ts`

Reuse existing components wherever possible. Preserve business logic and API integration.

Implementation order:
STEP 1 Application shell
STEP 2 Header + system status
STEP 3 Sidebar navigation (6 real routes)
STEP 4 Main map layout
STEP 5 Map layers / controls / legend
STEP 6 Analysis & Control panel
STEP 7 Oil-spill information popup
STEP 8 Investigation progress (compact)
STEP 9 Typography / spacing / borders
STEP 10 Responsive behavior
STEP 11 Final visual cleanup

After each major step, verify existing functionality still works (`npm run build`, run the app, confirm WS updates and API calls).

## 34. FINAL DESIGN TEST

Compare the result directly against the second reference image. If the first screenshot and the second screenshot were shown side-by-side, would the new implementation clearly belong to the same product/design system as the second screenshot? The answer should be yes.

Goal of Phase 1 is not pixel-perfect copying. Reproduce the same information architecture, visual hierarchy, spacing philosophy, map dominance, navigation structure, panel structure, and professional maritime intelligence aesthetic. Do not start Phase 2 until Phase 1 is visually stable.

KEY DIFFERENCE: your AI currently has the right information but the wrong composition. Convert from a "dark technical simulation interface" to a "professional maritime intelligence command center."

For this first phase, focus almost entirely on layout + hierarchy + map + right analysis panel. Do not jump into animations, advanced charts, glass effects, or micro-interactions yet — those belong in later phases.