# Frontend Presentation Delete & Replacement Inventory

Recorded during Milestone M0 Audit.
Outlines the scheduled retirement of legacy presentation files and their modern replacements under `src/ui/`.

---

## 1. Replacement Architectural Schema

All new presentation code lives strictly under `frontend/src/ui/`:

```
frontend/src/ui/
├── design-system/      # Primitive tokens, typography, buttons, panels, tooltips, dialogs, toasts
├── shell/              # AppShell, CommandSpine, OperationalBar, GraticuleFrame, KeyboardNav
├── console/            # Operational console, Flightpath, LayerDrawer, ContextualConsole, Inspector
│   ├── cards/          # Contextual stage summary cards
│   ├── map/            # Unified MapLibre + Deck.gl layers (prefixed ui- for new layers)
│   └── investigation/  # 8-stage evidence workspace, scrubber, timeline
├── pages/              # Clean page views (CommandCenter, Simulation, Investigation, etc.)
├── three/              # Lazy-loaded R3F 3D components (Ocean, Ship, ExplodedEvidence, Fallbacks)
├── motion/             # Framer motion variants, layout transitions, GSAP scroll timelines
├── marketing/          # Welcome landing page sections and narrative components
└── hooks/              # Read-only selector hooks (derived store views, no state duplication)
```

---

## 2. Legacy Presentation Deletion Schedule

When a page or component group is rebuilt in its designated milestone, the corresponding legacy files will be deleted. The project build must stay green at every step.

| Legacy File Path | Size | Retired In | Replaced By in `src/ui/` | Rationale & Scope |
|---|---|:---:|---|---|
| `src/index.css` (legacy 125KB) | 125 KB | **M1** | `src/ui/design-system/index.css` + Tailwind v4 theme | Elimination of bloated unmaintained CSS; replaced with clean Tailwind v4 `@theme`, color tokens, self-hosted fonts, and layer coexistence rules. |
| `src/styles/vsco.ts` | 5.2 KB | **M1** | `src/ui/design-system/tokens.ts` | Replacing hardcoded ad-hoc JS palette with design-system color tokens (`abyss`, `trench`, `deck`, `foam`, `mist`, `sonar`, etc.). |
| `src/components/ui/Button.tsx` | 2.1 KB | **M1** | `src/ui/design-system/Button.tsx` | Shadcn/Radix-based accessible button primitive with CVA variants. |
| `src/components/ui/Panel.tsx` | 3.4 KB | **M1** | `src/ui/design-system/Panel.tsx` | Consistent surface container with tonal depth and graticule borders. |
| `src/components/ui/primitives.tsx` | 4.8 KB | **M1** | `src/ui/design-system/primitives.tsx` | Replaced by standardized Radix UI primitives (Dialog, Tooltip, Sheet, Separator). |
| `src/components/ui/Icon.tsx` | 5.0 KB | **M1** | `lucide-react` + curated nautical SVG icons | Replacement with lightweight Lucide icons and dedicated maritime SVG glyphs. |
| `src/components/ui/DataSourceCard.tsx` | 1.8 KB | **M1** | `src/ui/design-system/DataSourceCard.tsx` | Clean telemetry card with honest data provenance labels. |
| `src/components/ui/MapLayersPanel.tsx` | 3.1 KB | **M2** | `src/ui/console/LayerDrawer.tsx` | Replaced by collapsible drawer with group ordering, swatches, and empty-state explanations. |
| `src/components/Status.tsx` | 2.2 KB | **M1** | `src/ui/design-system/StatusChip.tsx` | Unified provenance and execution status badges. |
| `src/components/Layout.tsx` | 6.6 KB | **M2** | `src/ui/shell/AppShell.tsx` + `CommandSpine.tsx` | Replaced by the "Instrument at Sea" shell, command spine, operational bar, and Z-time clock. |
| `src/pages/CommandCenter.tsx` | 11.2 KB | **M2** | `src/ui/pages/CommandCenterPage.tsx` | Complete rebuild of the command center into a map-first theater with graticule coordinates. |
| `src/components/commandcenter/WorkstationShell.tsx` | 3.6 KB | **M2** | `src/ui/shell/WorkstationShell.tsx` | Consolidated workstation shell with collapsible panel layout. |
| `src/components/commandcenter/MaritimeMap.tsx` | 0.8 KB | **M2** | `src/ui/console/map/MaritimeMapTheater.tsx` | Full-screen map stage with integrated graticule frame and deck overlay. |
| `src/components/commandcenter/OperationalHUD.tsx` | 4.1 KB | **M2** | `src/ui/shell/OperationalBar.tsx` | Operational telemetry bar with connection state, case ID, and command palette (Ctrl+K). |
| `src/components/commandcenter/FlightpathRail.tsx` | 5.2 KB | **M2** | `src/ui/console/FlightpathRail.tsx` | 8-stage interactive flightpath rail with sequential state indicators and microinteractions. |
| `src/components/commandcenter/ContextualConsole.tsx` | 4.7 KB | **M2** | `src/ui/console/ContextualConsole.tsx` | Reactive right panel displaying stage-sensitive forensic intelligence. |
| `src/components/commandcenter/LayerControlDrawer.tsx` | 2.9 KB | **M2** | `src/ui/console/LayerDrawer.tsx` | Slide-out layer drawer with 13 logical layers and real-time status. |
| `src/components/commandcenter/LayerInspector.tsx` | 3.8 KB | **M2** | `src/ui/console/LayerInspector.tsx` | Deep layer metadata inspector with data provenance disclosures. |
| `src/components/commandcenter/ChallengeRunner.ts` | 6.1 KB | **M2** | `src/ui/console/ChallengeRunner.ts` | Automated end-to-end evaluation runner with clean telemetry hooks. |
| `src/components/commandcenter/contextual/*` (7 files) | 18 KB | **M2-M4** | `src/ui/console/cards/*` | Standardized contextual forensic cards with honest provenance and error bounds. |
| `src/components/workspace/MissionWorkspace.tsx` | 4.5 KB | **M2** | `src/ui/shell/WorkspaceLayout.tsx` | Replaced by modern responsive resizable layout panels (`react-resizable-panels`). |
| `src/components/workspace/ContextualPanel.tsx` | 3.8 KB | **M2** | `src/ui/console/ContextualConsole.tsx` | Redundant panel wrapper retired in favor of direct console integration. |
| `src/components/workspace/selection.tsx` | 4.2 KB | **M2** | `src/ui/console/map/SelectionLayers.ts` | Selection ring and pip layers restyled with sonar accent. |
| `src/components/intel/IntelPanel.tsx` | 3.2 KB | **M2** | `src/ui/console/ContextualConsole.tsx` | Retired redundant side panel. |
| `src/pages/Simulation.tsx` | 8.9 KB | **M3** | `src/ui/pages/SimulationPage.tsx` | Scenario control room with time scrubber, honest empty states, and vessel telemetry. |
| `src/pages/Investigation.tsx` | 9.4 KB | **M3** | `src/ui/pages/InvestigationPage.tsx` | Dedicated 8-stage workspace with retry controls and forensic evidence card deck. |
| `src/components/investigation/Stepper.tsx` | 4.1 KB | **M3** | `src/ui/console/investigation/StageStepper.tsx` | Stage execution stepper with motion transitions. |
| `src/components/investigation/Pipeline.tsx` | 5.6 KB | **M3** | `src/ui/console/investigation/PipelineView.tsx` | Pipeline diagram with state indicators. |
| `src/components/investigation/SarObservation.tsx` | 7.9 KB | **M3** | `src/ui/console/investigation/SarCard.tsx` + map layers | Sentinel-1 observation panel and slick polygon styling. |
| `src/components/investigation/InvestigationTimeline.tsx`| 3.7 KB | **M3** | `src/ui/console/investigation/Timeline.tsx` | Chronological evidence acquisition sequence. |
| `src/pages/Backtracking.tsx` | 9.8 KB | **M4** | `src/ui/pages/BacktrackingPage.tsx` | Inverse Lagrangian drift analysis with uncertainty metrics and time window controls. |
| `src/components/backtracking/BacktrackingMap.tsx` | 4.9 KB | **M4** | `src/ui/console/map/BacktrackingDeckLayers.ts` | Trajectory ensembles, confidence contours (50/75/90%), and source region rendering. |
| `src/pages/Attribution.tsx` | 12.4 KB | **M4** | `src/ui/pages/AttributionPage.tsx` | Virtualized candidate ranking table, 5-factor scoring, and representative 3D vessel inspector. |
| `src/components/attribution/AttributionMap.tsx` | 5.1 KB | **M4** | `src/ui/console/map/AttributionDeckLayers.ts` | Candidate closest approach markers, rank labels, and vector lines. |
| `src/pages/Report.tsx` | 14.8 KB | **M5** | `src/ui/pages/ReportPage.tsx` | Formal forensic dossier with Newsreader typography, evidence reveals, and print CSS. |
| `src/components/map/MapView.tsx` | 5.8 KB | **M2** | `src/ui/console/map/MapView.tsx` | MapLibre GL wrapper with graticule border integration and Deck.gl synchronization. |
| `src/components/map/SimulationLayers.tsx` | 5.9 KB | **M2** | `src/ui/console/map/SimulationDeckLayers.ts` | Restyled vessels, heading ticks, trails, and forward drift particle cloud. |
| `src/components/map/InvestigationMap.tsx` | 9.1 KB | **M2/M3** | `src/ui/console/map/InvestigationDeckLayers.ts` | Integrated investigation map layers. |
| `src/components/map/overlays.tsx` | 2.7 KB | **M2** | `src/ui/console/map/DeckOverlayHelpers.ts` | Deck.gl TextLayer and LineLayer helper utilities. |

---

## 3. Preserved Infrastructure (NEVER Delete)

The following core modules are permanent and strictly protected:
- **`src/store/`**: All Zustand store definitions (`simulationStore`, `investigationStore`, `featureStores`, `mapStore`, `sarStore`, `connectionStore`, `environmentStore`, `incidentStore`).
- **`src/lib/api/`**: All REST API clients and TypeScript DTOs.
- **`src/lib/ws/`**: WebSocket client (`SocketClient`), event mappings, topic definitions.
- **`src/lib/http.ts`**: Base fetch configuration and `ApiError` handling.
- **`src/hooks/`**: `useHealthProbe.ts`, `useSimulationConnection.ts`, `useInvestigationConnection.ts`.
- **`src/types/domain.ts`**: Invariant domain models, status enums, and data contracts.
- **`src/main.tsx`**: React application root mounting.
- **`src/vite-env.d.ts`**: Vite environment type definitions.
