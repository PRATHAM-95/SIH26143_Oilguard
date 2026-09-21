# OilGuard Frontend Rebuild: Running Progress Log

This log is updated at the conclusion of every milestone.
Always review `MASTER_BRIEF.md` and this file at the start of every session.

---

## Milestone M0: Audit, Knowledge Graph & Planning (COMPLETED)

- **Completed On**: 2026-09-21
- **Branch**: `frontend-rebuild`
- **Goal**: Perform comprehensive audit of skills, system boundaries, and codebase architecture without touching `frontend/src`. Establish invariant contracts, deletion list, and the phased execution plan.

### What Was Done
1. **Created & Checked Out Branch**:
   - Switched to working branch `frontend-rebuild`.
2. **Canonical Brief Location Established**:
   - Placed `docs/frontend-rebuild/MASTER_BRIEF.md` in its required directory.
3. **Skills Inventory (`docs/frontend-rebuild/SKILLS_AVAILABLE.md`)**:
   - Verified that all 17 required skills are present in `.agents/skills/`: `frontend-design`, `ui-ux-pro-max`, `critique`, `distill`, `hierarchy`, `arrange`, `animate`, `depth`, `data-viz`, `imagery`, `polish`, `web-design-guidelines`, `threejs-fundamentals`, `threejs-animation`, `threejs-interaction`, `threejs-shaders`, and `graphify`.
4. **Knowledge Graph Extraction (`graphify`)**:
   - Ran AST extraction and clustering across the entire repository.
   - Mapped 3,297 nodes, 8,829 edges, and 121 communities.
   - Identified god nodes: `Investigation`, `InvestigationExecutor`, `BacktrackingResult`, `AttributionRun`, `SimulationEvent`, `InvestigationService`, `SarObservation`, `useInvestigationStore`, `InvestigationStage`, `useSimulationStore`.
5. **Architecture Mapping (`docs/frontend-rebuild/ARCHITECTURE_MAP.md`)**:
   - Documented service topology across Frontend (:3000), Backend Spring Boot (:8082), Scientific Service Python (:8000), and MongoDB (:27017).
   - Documented all 10 Zustand stores, 3 WebSocket/health hooks, 10 REST API clients, and Deck.gl layer builders.
6. **Protected Contracts Invariant Documentation (`docs/frontend-rebuild/PROTECTED_CONTRACTS.md`)**:
   - Documented 6 protected routes (`/`, `/simulation`, `/investigation`, `/backtracking`, `/attribution`, `/report`).
   - Documented 8 sequential stages (`detection` -> `characterization` -> `environment` -> `forward_drift` -> `backtracking` -> `ais` -> `attribution` -> `conclusion`).
   - Documented 13 logical `MapLayerId` catalogue keys and deck.gl layer IDs.
   - Documented all store fields and API endpoint contracts.
7. **Retirement & Replacement Inventory (`docs/frontend-rebuild/DELETE_LIST.md`)**:
   - Mapped all legacy presentation components, CSS, and styles to their future homes under `src/ui/`.
   - Confirmed invariant preservation of `store/`, `lib/`, `hooks/`, and `types/`.
8. **Master Plan (`docs/frontend-rebuild/PLAN.md`)**:
   - Drafted detailed phased roadmap for milestones M1 through M9 with skill assignments, deliverables, and verification criteria.
9. **Baseline Validation**:
   - Verified that `frontend/src` was NOT modified during M0.
   - Verified baseline build: `tsc -b && vite build` passed cleanly in 6.09s.

### Key Decisions Made
- **React 19 Compatibility**: `package.json` uses React 19.1.0; R3F dependencies for 3D work must be targeted to v9 (`@react-three/fiber@^9.0.0`).
- **Tailwind CSS v4 Strategy**: Tailwind v4 with `@tailwindcss/vite` will be introduced in M1 with strict layer isolation to prevent interference with MapLibre and Deck.gl canvases.
- **Strict Provenance Labeling**: In adherence to the honesty principle, all components will incorporate standardized status badges (`Live`, `Controlled`, `Simulated`, `Unavailable`, `Awaiting acquisition`).

### Next Steps: Milestone M1 (Foundations)
- COMPLETED on 2026-09-21.

---

## Milestone M1: Design System & Foundations (COMPLETED)

- **Completed On**: 2026-09-21
- **Branch**: `frontend-rebuild`
- **Goal**: Establish core design system tokens, self-hosted fonts, design primitives, motion tokens, and base layout shell while maintaining full backward compatibility with legacy pages via CSS layers.

### What Was Done
1. **Design Plan (`docs/frontend-rebuild/DESIGN_PLAN.md`)**:
   - Detailed specification for the "Instrument at Sea" nautical chart visual metaphor.
   - Defined color tokens (`abyss`, `trench`, `deck`, `chartline`, `foam`, `mist`, `dim`, `sonar`, `ok`, `warn`, `danger`, `gradient-sheen`).
   - Defined typographic roles for Schibsted Grotesk (UI/Headings), Newsreader (Dossier narrative), and JetBrains Mono (technical readouts).
   - Created ASCII wireframes for all 7 routes (`/`, `/simulation`, `/investigation`, `/backtracking`, `/attribution`, `/report`, `/welcome`).
   - Audited the architecture against all 15 anti-patterns from MASTER_BRIEF §6.5.
2. **ESLint Flat Configuration Setup (Amendment 4)**:
   - Configured `eslint.config.js` using ESLint flat config with `@eslint/js`, `typescript-eslint`, and `eslint-plugin-react-hooks`.
   - Fixed conditional `useMemo` in `ContextualPanel.tsx`.
   - Confirmed `npm run lint` passes cleanly with **0 errors and 0 warnings**.
3. **Tailwind CSS v4 & Legacy CSS Coexistence (Amendment 2)**:
   - Configured `@tailwindcss/vite` plugin in `vite.config.ts`.
   - Encapsulated legacy styles inside `@layer legacy` in `src/index.css`.
   - Guaranteed canvas sizing and pointer event propagation for MapLibre GL and Deck.gl.
4. **Self-Hosted Variable Fonts**:
   - Installed and imported `@fontsource-variable/schibsted-grotesk`, `@fontsource-variable/newsreader`, `@fontsource-variable/jetbrains-mono` in `src/main.tsx`. Zero CDN dependencies.
5. **Design System Primitives (`src/ui/design-system/`)**:
   - `tokens.ts`: Color constants, provenance definitions, typography tokens.
   - `ProvenanceLabel.tsx` (Amendment 1): Small text with an inline status dot (`● Live`, `○ Simulated`), strictly eliminating rounded chip/pill capsules.
   - `StatusBadge.tsx`: Clean monospace operational state badge with pulse indicators.
   - `Button.tsx`: Accessible CVA button component (`primary`, `secondary`, `outline`, `ghost`, `danger`).
   - `Panel.tsx`: Restrained hairline surface container with subtle tonal depth.
   - `Tooltip.tsx`: Radix-based keyboard accessible tooltip.
6. **Motion Tokens (`src/ui/motion/tokens.ts`)**:
   - Defined micro (120ms), UI (220ms), layout (380ms), and cinematic (850ms) tokens, springs, and `prefersReducedMotion()` utility.
7. **Foundational Layout Shell (`src/ui/shell/AppShell.tsx`)**:
   - Spatial layout component for Command Spine, Operational Bar, and Workspace viewport.
8. **Port Investigation (Amendment 6)**:
   - Diagnosed that port 3000 was held by PID 31964 and port 3001 was held by PID 8164 (earlier background node/vite processes), causing Vite to auto-increment to port 3002.
   - Verified that active dev server and browser testing run on `http://localhost:3002/`.
9. **Visual & Browser QA**:
   - Verified MapLibre GL and Deck.gl rendering via browser automation. Zero WebGL crashes, 0 JS errors.
   - Captured and archived screenshots at 1920x1080, 1440x900, 1280x800, and 768x1024 in `docs/frontend-rebuild/screenshots/M1/`.
10. **Build Verification**:
    - `npm run build` compiled successfully in 6.60s with all font woff2 assets bundled.

### Next Steps: Milestone M2 (Command Center)
- M2a (Foundations & Shell Mounting): COMPLETED on 2026-09-21.
- M2b (Geospatial Theater Rebuild): Ready to start on user signal.

---

## Milestone M2a: Shell Mounting & Contract Enforcement (COMPLETED)

- **Completed On**: 2026-09-21
- **Branch**: `frontend-rebuild` (Commit `6b50348`)
- **Goal**: Resolve M1 gaps, classify IDE Problems panel noise, enforce protected contracts with Vitest, mount `AppShell` with single operational navigation spine, restore scientific-service contract models, and automate full-stack start with `start-stack.ps1`.

### What Was Done
1. **IDE Problems Panel Classification**:
   - Analyzed all 39 errors and 1 warning before suppressing anything:
     - *CSS*: 1 warning (`Unknown at rule @theme (unknownAtRules)` in `src/index.css` line 3, validated via `vscode-css-languageservice`).
     - *Markdown*: 39 errors (broken relative links in `.agents/skills/*/SKILL.md` pointing to missing `../frontend-design/reference/...`).
     - *Python*: 0 errors, 0 warnings.
     - *TypeScript / ESLint*: 0 errors, 0 warnings (`npm run lint` and `tsc -b` pass cleanly).
   - Configured `C:\oilguard\.vscode\settings.json` and `SIH26143_Oilguard\.vscode\settings.json` with `"css.lint.unknownAtRules": "ignore"` and `"markdown.validate.fileLinks.enabled": "off"`. Only existing noise suppressed; zero TS/ESLint suppression.
2. **CSS Cascade & MapLibre Coexistence**:
   - Placed explicit layer order at line 1 of `src/index.css`: `@layer theme, base, components, legacy, utilities;`.
   - Maintained unlayered MapLibre/Deck.gl canvas guards (`.maplibregl-map`, `.maplibregl-canvas`, `#deckgl-overlay`, `.deck-canvas`) with highest cascade precedence over `@layer legacy` and Tailwind preflight.
3. **Route Extraction & Protected Contract Tests**:
   - Extracted `APP_ROUTE_PATHS` constant in `src/routes.ts`.
   - Updated `src/App.tsx` to dynamically build all `<Route path>` items from `APP_ROUTE_PATHS`.
   - Configured `vitest` + `jsdom` test environment in `vitest.config.ts` and added `npm test` script.
   - Implemented `src/__tests__/contracts.test.ts` asserting 6 routes, 8 sequential stages, and 13 map layer catalog keys against literal contract values from `PROTECTED_CONTRACTS.md`. Tests run and pass in ~911ms.
4. **StatusBadge Design System Fix**:
   - Removed monospace font (`font-mono`), uppercase transformation, and pill shape container (`rounded-full`, pill borders) from `StatusBadge.tsx`. Styled as understated inline dot + normal body text.
5. **AppShell Layout Mounting**:
   - Mounted `AppShell` in `src/components/Layout.tsx` with a single unified operational navigation spine (`<NavLink>` rail with tooltips, brand beacon, UTC Zulu clock, service health cluster) and single operational header bar. Completely eliminated legacy outer header and navigation.
6. **Scientific Service Models & Git Ignore Fix**:
   - Restored missing Pydantic contract models in `oil-spill-system/scientific-service/app/models/` (`forward_drift.py`, `sar.py`, `backtrack.py`, `ais.py`).
   - Fixed `.gitignore` in workspace root and `oil-spill-system/` to exempt `scientific-service/app/models/` from generic `models/` rule.
7. **Stack Automation & Verification**:
   - Updated `start-stack.ps1` with clean dynamic PATH lookups for Python, Java, and NPM, fixed `$sciConn` variable collision in PowerShell 5.1, and added `-Wait` switch for daemon process management.
   - Confirmed `backend/target` is gitignored.
   - Cleaned up lingering Vite processes.
   - Started stack via `powershell -ExecutionPolicy Bypass -File .\start-stack.ps1 -Wait`:
     - MongoDB: UP on 27017 (Atlas connection)
     - Scientific Service: UP on 8000 (`http://localhost:8000/health` -> HTTP 200)
     - Backend: UP on 8082 (`http://localhost:8082/api/health` -> HTTP 200)
     - Frontend: UP on 3000 (`http://localhost:3000/api/health` -> HTTP 200)
   - Verified live WebSocket (`/ws/simulation/...`): connection established, simulation event triggers live state transitions, and `● LIVE` badge illuminated.
8. **Multi-Route 1440x900 Visual QA**:
   - Captured 1440x900 screenshots of all six routes post-mounting:
     1. `/` (Command Center): `route_command_center_1440x900_1789935031320.png`
     2. `/simulation`: `route_simulation_1440x900_1789935045553.png`
     3. `/investigation`: `route_investigation_1440x900_1789935124693.png`
     4. `/backtracking`: `route_backtracking_1440x900_1789935143088.png`
     5. `/attribution`: `route_attribution_1440x900_1789935161439.png`
     6. `/report`: `route_report_1440x900_1789935183975.png`
   - Verified MapLibre controls, zoom buttons, and attribution render cleanly without layer clipping or preflight regression.

## Milestone M2b: Geospatial Theater Rebuild (COMPLETED)

- **Completed On**: 2026-09-22
- **Branch**: `frontend-rebuild` (Commits `756dd59` (CSS fix), `53b6d5b` (M2b implementation), `bbf0a5f` (M2b final remediation, superseded), and the M2b close-out commit `fix(m2b): close verification and evidence gaps` referenced below)
- **Goal**: Rebuild the Command Center into an authentic map-first operational theater, eliminating old panels and mock data pipelines.

### What Was Done
1. **Command Center Rebuild**:
   - Replaced legacy `/` view with a 1440x900 map-first layout.
   - Built a dynamic `OperationalBar` with case reference, status indicators, and Cmd+K `CommandPalette` for route jumps (`/simulation`, `/investigation`, `/backtracking`, `/attribution`) and map layer toggles.
   - Built the 8-stage `FlightpathRail` extracting strictly from `investigationStore`. Re-aligned stage subtitles to the canonical sequential stage IDs (`detection` -> `characterization` -> `environment` -> `forward_drift` -> `backtracking` -> `ais` -> `attribution` -> `conclusion`). The AIS stage subtitle key is the canonical `ais` (not `ais_analysis`), locked by `src/__tests__/flightpath.test.ts`.
   - Integrated `LayerDrawer` mapping directly to `MAP_LAYER_CATALOG`.
   - Built the `ContextualConsole` combining terminal output and timeline analysis.
2. **Honesty & Provenance Enforcement**:
   - Eliminated automatic fabricated demo mock pipelines. Removed `runLiveChallenge('DEMO')` from `CommandCenterPage.tsx` cold-open logic.
   - The map loads into a strictly honest "No data" state when idle.
   - Updated provenance labels in `OperationalBar` (Data: "No data", "Simulated", "Controlled"). No badges/pills; explicit text dots.
   - Enforced design system constraints: no all-caps, no pill shapes, no generic hex colors, no `!important` tags, no glassmorphism.
3. **Playwright Map & Attribution Assertions**:
    - Hardened `scripts/shots.pw.ts` to actively assert map attribution visibility. The test now executes `expect(covered).toBe(false)` using center-point coordinate evaluation, causing a hard CI failure if attribution is obscured.
    - Added an attribution-settle wait (`waitForFunction`, 20s timeout, 250ms polling) so the coverage check measures the landed UI, not a mid-load frame. The iron assertions (`found=true`, `clipped=false`, `covered=false`, no overflow, zero unfiltered console errors) are unchanged.
    - Passed three consecutive `npm run shots` runs over all 24 configurations (4 viewports x 6 routes) with 100% success rate (24/24 each run, 72/72 total). Per-run marks and timestamps recorded in `docs/frontend-rebuild/screenshots/M2b/playwright-runs.txt` (RUN 1, RUN 2, RUN 3 — each PASS 24/24, exit code 0).
    - Screenshot artifacts saved in `docs/frontend-rebuild/screenshots/M2b/run{1,2,3}/` (24 png each, 72 total).
 4. **Full-Stack Execution & End-to-End Reliability**:
    - Executed `./start-stack.ps1 -Wait` seamlessly bridging scientific, backend, and frontend boundaries.
    - Ran actual simulation and investigation lifecycle via `scripts/e2e_investigation.py` against the live stack. Verified all stages (`detection` through `conclusion`) completed accurately within expected time bounds — transcript with captured stdout and final `COMPLETED` state in `docs/frontend-rebuild/screenshots/M2b/e2e-transcript.txt`.
    - Investigated `backend.log` and `sci.log` for anomalous 422, 500, or Exception triggers during E2E. Zero critical application faults observed (only benign config properties matched "500").
 5. **Honesty of Readouts**:
    - `DetectionCard`: no fabricated `0.0 km²` figure; the candidate-slick area is rendered only when a real `slickAreaKm2` value exists.
    - `IncidentCard`: observation falls back to `Awaiting classification` (no fake "Synthetic Aperture Radar Oil Slick"); detection confidence shows `No data` when the field is absent.
    - `ContextualConsole`: footer copy is status-dependent and never claims a live pipeline for `COMPLETED` / `FAILED` / `CANCELLED` states (standing-by, live only while RUNNING, final/reproducible, failed, cancelled as appropriate).
 6. **Independent Verification Evidence (committed in the M2b close-out commit)**:
    - `docs/frontend-rebuild/screenshots/M2b/verification.txt`: `npm run lint` (0 errors/0 warnings), `npx tsc --noEmit`, `npm run build` (1425 modules), `npm run test` (2 files, 4 tests) — all exit code 0, captured from terminal. Includes a re-verification pass against the final tree after the `shots.pw.ts` settle-hardening edit.
    - `docs/frontend-rebuild/screenshots/M2b/playwright-runs.txt` and `e2e-transcript.txt` as above.
    - Git hygiene: `oil-spill-system/frontend/tsconfig.tsbuildinfo` is no longer tracked (`git rm --cached`); `.gitignore` restores `output/` as a whole-directory rule, adds `*.tsbuildinfo`, and keeps `test-results/` ignored. `git ls-files` contains no `.tsbuildinfo` or `test-results` entries.
    - Protected contracts reverified against the M2b baseline: zero diff over `backend/`, `scientific-service/`, `frontend/src/store`, `src/lib`, `src/types`, `src/hooks`, and `src/routes.ts`.

### Known Deviations
- `shellStore` was removed. The architecture leverages existing `layoutStore` and CSS variables, keeping the domain state exclusively to existing stores (`useInvestigationStore`, `useSimulationStore`).
- The `framer-motion` dependency is not used; `motion/react` is strictly used per process constraints.

### Milestone Status
- **M2b is COMPLETE**.

---

## Milestone M3: Simulation & Investigation Rebuild (COMPLETED)

- **Completed On**: 2026-09-22
- **Branch**: `frontend-rebuild`
- **Goal**: Rebuild the scenario control room (`/simulation`) and the stage-by-stage evidence workspace (`/investigation`) within the `WorkstationShell` architecture with strict honesty, live WebSocket synchronization, and full-stack integration.

### What Was Done
1. **Simulation Workspace Rebuild (`/simulation`)**:
   - Built `SimulationPage.tsx` using `WorkstationShell` integrating `SimulationControlRail` (left), `MaritimeMapTheater` (center), and `SimulationConsole` (right).
   - Created `SimulationControlRail.tsx`: Purpose-built vertical control rail for Captain mode tracking scenario lifecycle (Scenario, Fleet, Vessel, Spill, Forward drift) without hijacking the 8-stage investigative FlightpathRail.
   - Built `SimulationConsole.tsx`: Scenario lifecycle controls (Create simulation, Start simulation, Release oil spill, Run forward drift), Fleet selector with live vessel telemetry readouts (MMSI, Type, Speed, Heading, Position), Spill event metadata, and Forward drift mass balance report (Remaining, Evaporated, Dispersed kg).
   - Built `TimeScrubber.tsx`: Monospace simulation clock display with interactive step advance controls (+1h, +6h, +12h).
   - Replaced legacy mock/fabricated fallbacks (e.g. `'Generic crude'`) with honest `'Unspecified'` and real store telemetry.
2. **Investigation Workspace Rebuild (`/investigation`)**:
   - Built `InvestigationPage.tsx` using `WorkstationShell` integrating `FlightpathRail` (left), `MaritimeMapTheater` (center), and `InvestigationConsole` (right).
   - Cold-open bootstrap loads and hydrates all feature stores (`useInvestigationStore`, `useSarStore`, `useBacktrackingStore`, `useAttributionStore`) and establishes live WebSocket connections (`useSimulationConnection`, `useInvestigationConnection`).
   - Built `InvestigationConsole.tsx`: Pipeline progress gauge properly scaled (`percent = Math.max(0, Math.min(1, progress)) * 100`) so 1.0 displays as 100% with full bar width; execution controls (Start investigation, Retry pipeline, Cancel), contextual stage inspector, inline Ground-Truth Evaluation card, and runtime parameters/provenance breakdown.
   - Built `StageCards.tsx`: 8-stage evidence card deck (Detection, Characterization, Environment, Forward drift, Backtracking, AIS analysis, Attribution, Conclusion) with strict honesty guards ("Not yet calculated", "Awaiting acquisition", "No data" — never empty blank panels or invented metrics).
   - Forward drift evidence provenance is dynamically derived from `environmentSource` matching `SimulationConsole.tsx` (controlled when source is CONTROLLED, simulated when SYNTHETIC/MODEL, never hardcoded).
   - Integrated ground-truth reveal inline in the Conclusion stage, utilizing existing backend `revealGroundTruth` API and `lastReveal` comparison metrics.
3. **Route Wiring & Legacy Retirement**:
   - Updated `src/App.tsx` routing to map `/simulation` -> `SimulationPage` and `/investigation` -> `InvestigationPage`.
   - Verified 0 cross-dependencies and retired legacy `src/pages/Simulation.tsx` and `src/pages/Investigation.tsx` via git rm.
4. **Honesty & Provenance Enforcement**:
   - Cold-open on both pages renders strictly honest empty/standing-by states.
   - Telemetry and candidate readouts render only when real store values exist; all fallbacks use explicit provenance labels (`simulated`, `controlled`, `live`, `empty`).
   - No mock data pipelines or automatic scenario generation.
5. **Real Browser QA**:
   - Validated `/simulation` in real browser: cold open -> Create simulation -> Captain mode fleet population -> Start simulation -> Select vessel -> Release spill with genuine Event ID and coordinates -> Advance clock +1h, +6h, +12h -> Run forward drift -> Mass balance readouts -> Map updates with zero console errors.
   - Validated `/investigation` in real browser: cold open -> Start investigation -> Stage transitions (pending -> running -> completed) -> FlightpathRail status updates -> Real evidence cards population -> Attribution candidates ranking -> Conclusion verdict -> Ground truth reveal displaying 0.02 km position error and 180 min time error with zero console errors.
   - Re-verified in real browser following close-out fixes: Progress gauge displays "100% complete" with full visual bar width upon completion; Forward drift environment displays "controlled" matching underlying CONTROLLED dataset with 0 console errors.
6. **Multi-Viewport Playwright Screenshot Suite**:
   - Executed `npm run shots` targeting `docs/frontend-rebuild/screenshots/M3/`.
   - 24/24 configurations passed cleanly across 4 standard viewports (1920x1080, 1440x900, 1280x800, 768x1024) across all 6 routes (`/`, `/simulation`, `/investigation`, `/backtracking`, `/attribution`, `/report`).
   - Hard assertions verified: no horizontal overflow, 0 console errors, map attribution found, unclipped, and uncovered.
7. **Full-Stack Execution & End-to-End Reliability**:
   - Stack running across MongoDB (27017), Python scientific service (8000), Spring Boot backend (8082), Vite frontend (3000).
   - Executed `python scripts/e2e_investigation.py` against the live stack.
   - All 8 stages (`detection`, `characterization`, `environment`, `forward_drift`, `backtracking`, `ais`, `attribution`, `conclusion`) completed with status `COMPLETED`.
   - Genuine transcript captured in `docs/frontend-rebuild/screenshots/M3/e2e-transcript.txt`.
8. **Protected Contracts Verification**:
   - Verified git diff against baseline `6b86cdb`: 0 modifications to `backend/`, `scientific-service/`, `frontend/src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`, stage IDs/order, or API contracts.
9. **Build & Quality Gates**:
   - `docs/frontend-rebuild/screenshots/M3/verification.txt`: captured real execution outputs from terminal for all 4 gates (exit code 0 for every command):
     - `npx tsc --noEmit`: 0 errors (exit code 0).
     - `npm run lint`: 0 errors, 0 warnings (exit code 0).
     - `npm run test`: 2 test files, 4 tests passed (exit code 0).
     - `npm run build`: 1434 modules transformed, built cleanly in 7.56s (exit code 0).
   - Git hygiene: no `.tsbuildinfo` or `test-results/` tracked.

### Known Limitations
- Dedicated full-page Backtracking ensemble inspector and Attribution 3D vessel ranking workspaces will be rebuilt in Milestone M4 per `PLAN.md`.

### Milestone Status
- **M3 is COMPLETE**. Closed at commit `e766f72`.

---

## Milestone M4: Backtracking & Attribution Interfaces (Rebuilt)

### Objective
Rebuild `/backtracking` and `/attribution` from legacy implementations into the new `src/ui/` presentation architecture (`src/ui/pages/BacktrackingPage.tsx`, `src/ui/pages/AttributionPage.tsx`), improve native Deck.gl vessel map visualization with ship silhouettes, genuine SOG direction vectors, and restrained selection rings, verify in real browser, capture Playwright and E2E evidence, and retire legacy pages.

### Work Completed

1. **Backtracking Workspace (`src/ui/pages/BacktrackingPage.tsx`)**:
   - Built around the existing `useBacktrackingStore` without altering solver logic or state contracts.
   - **`BacktrackingControlRail.tsx`**:
     - Status indicator (`idle`, `running`, `completed`, `failed`).
     - Real solver controls: "Run backtracking" with advection pulse, "Clear estimate".
     - Observed slick anchor coordinates and reference timestamp.
     - Reverse timeline scrubber steps (`T-0`, `-2h`, `-4h`, `-6h`).
     - Ensemble parameter summary (members, particles/member, forcing dataset).
     - Responsive mini-rail for collapsed states.
   - **`BacktrackingConsole.tsx`**:
     - Estimated origin coordinates formatted in monospace (`lat.toFixed(4)}°, ${lon.toFixed(4)}°`).
     - Uncertainty spread (`±X.X km`, 2σ confidence interval).
     - Multi-dimensional confidence: source concentration, environmental quality, trajectory agreement %, ensemble stability.
     - Source time window (earliest, preferred, latest UTC).
     - Ensemble convergence and quality metrics (invalid particles, land hits, domain exits).
     - Forensic evidence basis explaining mathematical confidence contours.
     - Provenance card with explicit forcing dataset disclosures.
     - Honest uncalculated/awaiting states when unrun.

2. **Attribution Workspace (`src/ui/pages/AttributionPage.tsx`)**:
   - Built around the existing `useAttributionStore` without altering scoring or ranking logic.
   - **`AttributionControlRail.tsx`**:
     - Status indicator (`idle`, `running`, `completed`, `failed`).
     - Real controls: "Run AIS attribution", "Clear result".
     - Forensic pipeline progress indicators (AIS corridor query, spatial-temporal filter, five-factor scoring).
     - Vessel class filter buttons (`ALL`, `TANKER`, `CARGO`, `OTHER`).
     - Candidate sort selector (`Rank`, `Score`, `Distance`).
     - Spatial-temporal search parameters (corridor radius, anchor origin).
   - **`AttributionConsole.tsx`**:
     - Attribution conclusion banner ("Primary Candidate Identified" or "Attribution Inconclusive" with decisive margin and confidence warnings).
     - Ranked candidate vessels table: rank, vessel name, MMSI, score, closest distance, AIS reliability indicator.
     - Interactive candidate selection with bidirectional synchronization to map marker and inspector.
     - Attribution Inspector (selected vessel evidence):
       - Vessel identity (Name, MMSI, Vessel Class).
       - Closest approach telemetry (minimum distance km, time of approach, position coordinates).
       - Five-factor normalized evidence breakdown with visual progress bars and notes: spatial match, temporal match, trajectory consistency, behavior anomaly signals (speed jumps, AIS gaps), environmental drift agreement.
       - AIS signal quality assessment: reliability rating, message count, median cadence, reconstructed track %, coverage gaps, notes.
       - Scientific provenance disclosures.
     - Honest empty states when unrun or when filtering yields no candidates.

3. **Vessel Map Visualization Improvements**:
   - Enhanced existing native Deck.gl layer architecture without introducing parallel layers or HTML markers:
     - `src/components/map/vesselSilhouette.ts`: top-down SVG vessel silhouette (`SHIP_ICON_URL`) with hydrodynamic pointed bow, bridge superstructure, and transom stern.
     - Upgraded `src/components/map/SimulationLayers.tsx` to use `@deck.gl/layers` `IconLayer` for live AIS vessels: recognizable ship silhouette at normal zoom levels (`sizeUnits: 'pixels'`).
     - Direction vectors rendered with `LineLayer` aligned with true vessel heading, with length proportional to genuine SOG (knots) when available; never invented.
     - Upgraded candidate vessel markers in `src/components/attribution/AttributionMap.tsx` and `src/components/map/InvestigationMap.tsx` to ship silhouettes tinted by rank/domain colors.
     - Restrained selection ring in `src/components/workspace/selection.tsx` updated to support `ais_candidate`, `origin`, and `source_region` from feature stores.
     - Vessel styling driven by domain state tokens: Tankers (amber), Cargo/Container (sonar cyan), Fishing (emerald), Spill target vessel (coral red), Selected vessel (bright white).

4. **Unified Theater Integration & Legacy Retirement**:
   - `MaritimeMapTheater.tsx`: unified layer composition including `useBacktrackingLayers()` and `useAttributionLayers()`, controlled by map layer catalog visibility.
   - Routes wired in `src/App.tsx` pointing to new `src/ui/pages/BacktrackingPage` and `src/ui/pages/AttributionPage`.
   - Legacy `src/pages/Backtracking.tsx` and `src/pages/Attribution.tsx` safely retired with `git rm`.

5. **Real Browser Validation**:
   - Verified `/backtracking` and `/attribution` in real browser via browser agent:
     - Verified initial honest state ("Awaiting backtracking run", "Awaiting attribution run").
     - Executed simulation and triggered backtracking solver; verified advection state, origin coordinates, and uncertainty radius.
     - Executed attribution; verified candidate filtering (`TANKER`/`CARGO`), candidate selection, inspector breakdown, and map selection sync.

6. **Playwright Multi-Viewport Verification**:
   - Executed `npm run shots` across all 4 viewports (1920x1080, 1440x900, 1280x800, 768x1024) across all 6 routes.
   - 24/24 configurations passed cleanly with zero horizontal overflow, zero console errors, and readable map attributions.
   - Captured M4 evidence screenshots in `docs/frontend-rebuild/screenshots/M4/backtracking/` and `docs/frontend-rebuild/screenshots/M4/attribution/`.

7. **Full-Stack Execution & End-to-End Reliability**:
   - Ran `python scripts/e2e_investigation.py` against running live stack (MongoDB: 27017, Scientific: 8000, Backend: 8082, Frontend: 3000).
   - All 8 investigation stages completed (`detection`, `characterization`, `environment`, `forward_drift`, `backtracking`, `ais`, `attribution`, `conclusion`).
   - Real transcript captured in `docs/frontend-rebuild/screenshots/M4/e2e-transcript.txt`.

8. **Protected Contracts Verification**:
   - Verified zero modifications to `backend/`, `scientific-service/`, `frontend/src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`, or existing solver/scoring business logic.

9. **Build & Quality Gates**:
   - `docs/frontend-rebuild/screenshots/M4/verification.txt` records terminal execution:
     - `npx tsc --noEmit`: 0 errors (exit code 0).
     - `npm run lint`: 0 errors (exit code 0).
     - `npm run test`: 4 tests passed (exit code 0).
     - `npm run build`: built in 8.49s (exit code 0).
     - `npm run shots`: 24 passed in 1.1m (exit code 0).
     - `python scripts/e2e_investigation.py`: exit code 0.

### Milestone Status
- **M4 is COMPLETE**. Rebuilt `/backtracking` and `/attribution` interfaces are verified, honest, and operational. Ready for Milestone M5 (Report Rebuild & Export).


