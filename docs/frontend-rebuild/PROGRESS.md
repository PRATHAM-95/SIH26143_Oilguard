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

---

## Design Direction: Premium Visual System Refinement (COMPLETED)

- **Completed On**: 2026-09-22
- **Branch**: `frontend-rebuild`
- **Objective**: Evolve OilGuard into a visually distinctive, premium, commercially credible maritime forensic intelligence product. Eliminate AI slop (neon cyan, glowing borders, card spam, bubbly rounded geometry) and establish the definitive "Maritime Forensic Intelligence" design foundation.

### What Was Done
1. **Brand Pair & Color Hierarchy**:
   - Primary Brand Accent Pair: **Signal Blue (`#0057FF`)** + **Porcelain (`#F8F7F4`)**.
   - Base Neutrals: **Abyss (`#070B10`)**, **Trench (`#0B1118`)**, **Deck (`#111923`)**, and **Chartline (`#273340`)**.
   - Text Palette: Primary typography and metrics in **Porcelain (`#F8F7F4`)**, secondary body in **Mist (`#B2BBC5`)**, and captions/metadata in **Dim (`#727D89`)**.
   - Semantic Operational States: Strictly preserved for real domain telemetry: **OK (`#00D98B`)**, **Warn (`#FFB020`)**, **Danger (`#FF4D5A`)**.
   - Visual distribution: ~80% dark maritime neutrals, ~10–15% porcelain, ~5–10% signal/semantic accents.
2. **Typography System**:
   - **Primary UI**: `Schibsted Grotesk Variable` (digital-first UI family; used for navigation, interface labels, headings, buttons, controls, tables).
   - **Editorial / Dossier**: `Newsreader Variable` (used selectively for forensic narratives, report conclusions, incident dossier hero titles).
   - **Technical Telemetry**: `JetBrains Mono Variable` (strictly reserved for coordinates, timestamps, MMSI/IMO, measurements, numerical telemetry, and IDs).
3. **Instrumentation Control Language**:
   - Buttons refined in `src/ui/design-system/Button.tsx`: Precision instrumentation controls with `rounded-[3px]`, crisp hairlines, and Signal Blue primary styling (`bg-signal-blue text-porcelain hover:bg-[#0048D9] border border-signal-blue`).
   - Removed glowing box-shadows and pulse animations (`box-shadow: 0 0 8px...`) across spine navigation, beacons, status dots, and contextual cards.
4. **Vessel Visual Hierarchy**:
   - Normal vessels rendered in calm mist silhouette `[178, 187, 197, 210]`.
   - Selected vessel highlighted in Porcelain `[248, 247, 244, 255]` with crisp Signal Blue selection ring `[0, 87, 255, 230]`.
   - Selected vessel trajectory highlighted with Signal Blue emphasis `[0, 87, 255, 230]` while unselected trails remain chartline slate `[39, 51, 64]`.
   - Direction vectors scale strictly with genuine SOG (knots) when available. Zero invented telemetry.
5. **Quality Gates & Multi-Viewport Verification**:
   - `npx tsc --noEmit`: 0 errors (exit code 0).
   - `npm run lint`: 0 errors (exit code 0).
   - `npm run test`: 4 passed (exit code 0).
   - `npm run build`: 1437 modules transformed, built cleanly in 18.9s (exit code 0).
   - `npx playwright test scripts/shots.pw.ts`: 24/24 passed across 1920x1080, 1440x900, 1280x800, 768x1024 with zero horizontal overflow and zero console errors.
   - Graphify refreshed: 576 nodes, 1605 edges, 16 communities, 0 import cycles, 0 orphaned components.
   - Protected contracts verified: 0 modifications to `backend/`, `scientific-service/`, `src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`.

---

## Milestone M5: Publication-Grade Maritime Forensic Dossier & Print Export (COMPLETED)

- **Completed On**: 2026-09-22
- **Branch**: `frontend-rebuild`
- **Goal**: Rebuild the `/report` route into a publication-grade maritime forensic dossier. Maintain document-oriented editorial rhythm distinct from the operational workstation, wire all 13 planned forensic sections, render honest data and scientific provenance, implement SVG analytical figures for spatial evidence, provide a single lazy WebGL geospatial theater, craft a genuine `@media print` paper composition, and safely retire the legacy `pages/Report.tsx`.

### What Was Done
1. **Report Architecture & Layout (`src/ui/report/`, `src/ui/pages/ReportPage.tsx`)**:
   - Replaced card-grid layout with a document-oriented, scrollable publication architecture centered around a max-w-4xl column.
   - Screen mode maintains the dark maritime intelligence theme (Abyss `#070B10`, Trench `#0B1118`, Deck `#111923`, Chartline `#273340`, Porcelain `#F8F7F4`, Mist `#B2BBC5`, Dim `#727D89`, Signal Blue `#0057FF`).
   - Implemented `SectionNav` sticky sidebar with scroll-spy, active section tracking, print button trigger (`window.print()`), and smooth scrolling.
   - Preserved `AppShell` while providing proper scroll containers for the editorial document.

2. **All 13 Structured Forensic Sections Implemented**:
   - **01 — Incident Dossier** (`DossierHero.tsx`): Classified publication header, incident metadata plate, coordinates, timestamps, confidence grade, and export controls.
   - **02 — Executive Finding** (`AttributionSections.tsx`): Prominent editorial statement of attribution or honest no-verdict state, probability badge, contributing factors breakdown.
   - **03 — Detection** (`EvidenceSections.tsx`): SAR sensor metadata, bounding box coordinates, radar backscatter characteristics, detection confidence.
   - **04 — Characterization** (`EvidenceSections.tsx`): Oil classification, estimated slick area, mass balance distribution plate (evaporated vs natural dispersion vs remaining slick).
   - **05 — Environment** (`EvidenceSections.tsx`): Wind and surface current vectors, sea state, water temperature, data provenance (`CONTROLLED` / `COPERNICUS` / `HYCOM`).
   - **06 — Forward Drift** (`AnalysisSections.tsx`): Forward drift trajectory summary, simulation parameters, particle dispersion count, SVG `DriftTrajectoryPlate`.
   - **07 — Backtracking** (`AnalysisSections.tsx`): Probability origin coordinates, uncertainty radius, advection duration, SVG `BacktrackingAnalyticalPlate` with probability contours and drift streamlines, and SVG `SourceTimeWindowPlate`.
   - **08 — AIS / Vessel Traffic** (`AttributionSections.tsx`): Candidate vessels within spatiotemporal corridor, closest approach, SOG/COG, flag state, and SVG `AISCorridorAnalyticalPlate` radar chart.
   - **09 — Attribution** (`AttributionSections.tsx`): Multi-factor scoring matrix, candidate ranking, SVG `FactorBreakdownChart` with weight distribution, and honest unconfirmed warnings.
   - **10 — Conclusion** (`ConclusionSections.tsx`): Narrative forensic summary in Newsreader serif, legal disclaimer, confidence rationale, and operational caveats.
   - **11 — Evidence & Provenance** (`ConclusionSections.tsx`): Cryptographic evidence hashes, model versioning, sensor telemetry timestamps, processing pipeline audit trail.
   - **12 — Limitations / Uncertainty** (`ConclusionSections.tsx`): Explicit atmospheric and hydrodynamic model boundaries, AIS gap analysis, sensor resolution limits.
   - **13 — Technical Appendix** (`ConclusionSections.tsx`): Full simulation configuration, run parameters, coordinates graticule, and system metadata.

3. **Data Architecture & Scientific Honesty**:
   - Presentation layer strictly consumes existing Zustand stores (`useInvestigationStore`, `useSimulationStore`, `useSarStore`, `useBacktrackingStore`, `useAttributionStore`, `useEnvironmentStore`) and backend report summary (`investigationApi.report(id)`).
   - Zero scientific recalculations or simulated numbers in presentation code.
   - Implemented honest fallback states (`ReportEmpty`): "No active investigation loaded", "Awaiting sensor acquisition", "Not yet calculated" when data is absent.
   - Dynamic simulation hydration from `sessionStorage` or active investigation store.

4. **Analytical Figures & Map Architecture**:
   - Avoided multiple heavy WebGL instances: integrated ONE lazy interactive `MaritimeMapTheater` geospatial theater on screen (`.screen-only`).
   - Implemented genuine data-derived SVG analytical plates for spatial evidence:
     - `DriftTrajectoryPlate`: SVG vector projection showing release site, particle dispersion cloud, and net transport vector.
     - `BacktrackingAnalyticalPlate`: Coordinate graticule, candidate release origin with error ellipse, uncertainty radius, and reverse streamlines.
     - `SourceTimeWindowPlate`: Temporal Gantt plate depicting earliest, preferred, and latest discharge window.
     - `AISCorridorAnalyticalPlate`: Spatiotemporal radar plate plotting candidates relative to the spill release anchor.
     - `FactorBreakdownChart`: Proportional stacked bar with factor weights (Trajectory, Proximity, Speed, Vessel Type).

5. **Print & Export System (`@media print`)**:
   - Comprehensive `@media print` CSS rules in `src/index.css`.
   - Overrode parent single-page layout overflow constraints (`html`, `body`, `#root`, `.app-shell`, `main`) to enable multi-page document pagination.
   - Clean paper surface (`#FFFFFF` background, `#111111` dark typography, `#333333` body prose, `#666666` secondary metadata).
   - Hidden screen chrome: operational spine, top bar, section navigation, interactive buttons, and WebGL theater.
   - Analytical SVG figures and tables preserved with paper-optimized contrast.
   - Controlled page breaks (`break-after: page`, `break-inside: avoid`) preventing orphan headings, split figures, and clipped tables.
   - Verified real PDF export via Playwright: `docs/frontend-rebuild/screenshots/M5/export/oilguard_forensic_dossier.pdf` (156 kB, multi-page).

6. **Retirement of Legacy Report**:
   - Audited imports across entire codebase confirming zero external references to `src/pages/Report.tsx`.
   - `src/App.tsx` routes `/report` directly to `src/ui/pages/ReportPage.tsx`.
   - Safely retired `src/pages/Report.tsx`.

7. **Quality Gates & Verification Results**:
   - `npx tsc --noEmit`: 0 errors (exit code 0).
   - `npm run lint`: 0 errors, 0 warnings (exit code 0).
   - `npm run test -- --run`: 4/4 tests passed (exit code 0).
   - `npm run build`: 1444 modules transformed, production bundle built cleanly in 8.35s (exit code 0).
   - `npx playwright test scripts/shots.pw.ts -g "/report"`: 4/4 passed across 1920x1080, 1440x900, 1280x800, 768x1024 with zero horizontal overflow and zero console errors.
   - `npx playwright test scripts/m5-report-qa.pw.ts`: 5/5 passed (Screen viewports, All 13 sections, Section navigation jump, Print media simulation, Empty states).
   - `python scripts/e2e_investigation.py`: exit code 0 (Investigation `inv-478a2acb-42b` completed all 8 stages).
   - Protected contracts verified: 0 modifications to `backend/`, `scientific-service/`, `src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`.

### Milestone Status
- **M5 is COMPLETE**. The publication-grade maritime forensic dossier and print/export experience are fully implemented, verified across viewports and print media, and tested against live data. Ready for Milestone M6.

---

## Milestone M6: Cinematic 3D Welcome Experience (COMPLETED)

- **Completed On**: 2026-09-23
- **Branch**: `frontend-rebuild`
- **Goal**: Build `/welcome` as a premium cinematic introduction to OilGuard under the "Instrument at Sea" visual direction. Implement procedural 3D ocean, commercial tanker, oil sheen anomaly, and forensic reconstruction graphics driven by native browser scrolling and GSAP ScrollTrigger. Provide an intentional 2D architectural fallback, full `prefers-reduced-motion` support, responsive adaptation across 4 viewport resolutions, and primary CTA navigation to `/` (Command Center) without modifying operational workstation shells or protected contracts.

### What Was Done
1. **Routing & Architecture (`src/App.tsx`, `src/ui/pages/WelcomePage.tsx`)**:
   - `/welcome` is implemented as a standalone route OUTSIDE the existing `Layout` wrapper (no operational spine, no operational bar, no workstation shell).
   - Fully code-split and lazy-loaded via `React.lazy()` with `React.Suspense` and a dedicated `WelcomeLoadingShell` component.
   - Preserved `APP_ROUTE_PATHS` and `src/routes.ts` completely intact.
   - Primary CTA navigates to `/` (Command Center).
   - Fixed-stage viewport architecture (`fixed inset-0 w-screen h-screen`) coupled with an unconstrained native scroll track (`360vh`), ensuring 100% stable browser scrolling without clipping or sticky ancestor collision issues.
   - Non-intrusive CSS enabler in `src/index.css` via `:has(.welcome-page-root)` enabling native window scrolling exclusively when `/welcome` is mounted, restoring standard dashboard overflow rules when navigating into operational workstation pages.

2. **3D Scene Implementation (`src/ui/welcome/WelcomeScene.tsx`)**:
   - Single lightweight React Three Fiber (`@react-three/fiber@^9.7.0`) Canvas with Three.js (`three@0.186.0`) and `@react-three/drei`.
   - Clamped DPR (`dpr={[1, 1.5]}`) with ACESFilmic tone mapping and `#070B10` (Abyss) atmospheric distance fog.
   - Directional moonlight illumination (`#DBE7F5`), kicker rim light, and maritime ambient fill.
   - Decoupled pointer events (`style={{ pointerEvents: 'none' }}` on Canvas) ensuring interactive HTML narrative overlays and CTA buttons remain unobstructed.

3. **Procedural Ocean Plane (`src/ui/welcome/OceanPlane.tsx`, `shaders/oceanShader.ts`)**:
   - Subdivided 360x360 plane geometry with custom GLSL Gerstner wave displacement vertex shader.
   - 3 low-frequency harmonic wave components with analytical tangent/binormal calculation for surface normals.
   - Fragment shader computing Fresnel reflectance, Schlick approximation, subtle celestial glint, bathymetric nautical chartline graticules, and depth fog blending seamlessly into `#070B10`.
   - Continuous wave propagation in `useFrame` (damped when reduced motion is requested).

4. **Procedural Tanker Model (`src/ui/welcome/TankerModel.tsx`)**:
   - 100% procedural commercial VLCC crude tanker constructed from Three.js primitives and custom buffer geometry (zero external glTF files, zero network assets, 100% license-clean).
   - Recognizable silhouette: tapered bow with stem post and bulbous keel, waterline boot-topping band (`#241517`), cargo manifold array with piping rack, raised forecastle with anchor windlasses, 4-tier stepped superstructure, bridge wings with port (red `#FF4D5A`) and starboard (green `#00D98B`) navigational sidelights, rotating radar scanner mast, and stern exhaust stack.
   - Gentle, high-inertia pitch, roll, and heave bobbing synced to wave frequency in `useFrame` (disabled if reduced motion).

5. **Restrained Oil Sheen (`src/ui/welcome/OilSheen.tsx`, `shaders/sheenShader.ts`)**:
   - Custom thin-film interference shader generating an organic trailing slick plume in the tanker wake.
   - Restrained physical petroleum colors (deep charcoal `#060A0E`, bronze-slate `#182432`, muted indigo-slate `#243545`; zero neon rainbow effect).
   - Prominently accompanied in UI by mandatory honesty badge: `ILLUSTRATIVE · NOT LIVE DATA`.

6. **Forensic Reconstruction Graphics (`src/ui/welcome/ReconstructionGraphics.tsx`)**:
   - Lightweight Three.js `Line` and `LineSegments` buffer primitives rendered through R3F `<primitive object={...} />` to avoid React SVG namespace collisions.
   - Concentric origin target rings with pulsating scanner wedge, curved reverse Lagrangian drift trajectory vector, historical AIS vessel transit track with waypoints, correlation vector line, and nautical graticule grid.
   - Fully animated via scroll progress without calculating false attribution or fabricating operational telemetry.

7. **Scroll Choreography & Narrative Overlay (`src/ui/welcome/useWelcomeScroll.ts`, `WelcomeNarrative.tsx`)**:
   - Native browser scrolling mapped via GSAP ScrollTrigger (`gsap@3.15.0`) + direct window scroll listener across 5 narrative chapters:
     - `0.00–0.18` → **Scene 01: Ocean** ("OILGUARD // MARITIME FORENSIC INTELLIGENCE")
     - `0.18–0.38` → **Scene 02: Vessel** ("Commercial Traffic Correlation")
     - `0.38–0.58` → **Scene 03: Spill** ("Surface Slick Delineation")
     - `0.58–0.82` → **Scene 04: Reconstruction** ("OBSERVE → TRACE → CORRELATE → ATTRIBUTE")
     - `0.82–1.00` → **Scene 05: Enter Command Center** ("Detect. Reconstruct. Correlate. Attribute." + `[ ENTER COMMAND CENTER ]` CTA)
   - Clickable top chapter tabs allowing immediate jumping to any narrative section.
   - Direct header CTA and footer skip link allowing instant bypass to `/`.

8. **Accessibility & Designed 2D Fallback (`src/ui/welcome/WelcomeFallback.tsx`)**:
   - Full `prefers-reduced-motion` compliance: disables camera tweening and continuous bobbing, locking to an intentional static tactical 3D perspective with immediate interactive access.
   - Resilient WebGL detection: if WebGL context creation fails, renders `WelcomeFallback` with an architectural SVG blueprint tanker schematic, radar graticule, editorial headline, pipeline summary, and direct CTA to `/`. Zero black screens.

9. **Quality Gates & Verification Results**:
   - `npx tsc -b`: 0 errors (exit code 0).
   - `npm run lint`: 0 errors, 0 warnings (exit code 0).
   - `npm run test -- --run`: 4/4 unit tests passed (exit code 0).
   - `npm run build`: 1480 modules transformed, `WelcomePage` cleanly code-split into isolated chunk (`1,062 kB` / `299 kB` gzip), built in 11.46s (exit code 0).
   - `npx playwright test scripts/welcome.pw.ts`: 6/6 tests passed (1920x1080, 1440x900, 1280x800, 768x1024, reduced motion, and WebGL disabled fallback). Zero horizontal overflow, zero uncaught console errors.
   - `npx playwright test scripts/shots.pw.ts`: 24/24 passed across all 6 existing operational routes (`/`, `/simulation`, `/investigation`, `/backtracking`, `/attribution`, `/report`).
   - Protected contracts verified: 0 modifications to `backend/`, `scientific-service/`, `src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`.

### M6 Honesty Blocker Resolution
- **Removed Fabricated Telemetry**: Completely eliminated hardcoded coordinate / version / speed readouts (`LAT: 24° 18' N`, `LON: 054° 22' E`, `DATUM: WGS84`, `OILGUARD SYSTEM v2.4`, `AIS TRACK // 14.2 KTS`) across `WelcomeNarrative.tsx`, `WelcomeLoadingShell.tsx`, and `WelcomeFallback.tsx`. Replaced with non-operational illustrative product chrome: `OILGUARD // MARITIME FORENSIC INTELLIGENCE` and `ILLUSTRATIVE · NOT LIVE DATA`.
- **Mandatory Tanker Label Correction**: Updated tanker disclaimer label in `WelcomeNarrative.tsx` to exact required wording: `"Representative model, not vessel-specific geometry"`.
- **Non-Blocking Audit Notes**:
  - Unused dependencies (`@react-three/drei`, `@gsap/react`) retained cleanly without runtime penalty.
  - Reduced motion mode intentionally freezes the 3D scene camera and animations to a static tactical perspective rather than switching to 2D fallback, ensuring accessible parity with immediate CTA access.
  - Lenis omitted in favor of native scrolling + GSAP ScrollTrigger for deterministic scroll position tracking.
  - Narrative structured around 5 major cinematic story beats.

### Milestone Status
- **M6 is VERIFIED AND CLOSED**. Honesty blocker eliminated, verified with full test and build suites, and confirmed clean across all protected contracts.

---

## Milestone M7: Exploded Evidence Experience

### Summary
Built the **Exploded Evidence Stack** representing a single maritime incident as nine physical/analytical evidence plates that transition across three phases: **STACKED → EXPLODED → CONVERGED**.

**Core Metaphor:**
`ONE INCIDENT → MULTIPLE EVIDENCE LAYERS → RECONSTRUCTED EXPLANATION`

### Architecture & Deliverables

1. **Nine Forensic Evidence Layers (`src/ui/three/evidence/layerDefinitions.ts`)**:
   - Ordered bottom to top (indices 0 to 8):
     1. **`01 / SATELLITE / SAR SCENE`**: Sentinel-1 radar backscatter footprint & scan boundary.
     2. **`02 / OIL SLICK MASK`**: Surface hydrocarbon delineation with dark petroleum reflectance.
     3. **`03 / WIND FIELD`**: Atmospheric forcing vectors (`UNAVAILABLE // NOT YET CALCULATED`).
     4. **`04 / OCEAN CURRENTS`**: Hydrodynamic circulation (`UNAVAILABLE // NOT YET CALCULATED`).
     5. **`05 / FORWARD DRIFT`**: Lagrangian particle dispersion cloud extent.
     6. **`06 / BACKTRACKING ENSEMBLE`**: Reverse trajectory fan connecting slick to release origin.
     7. **`07 / AIS VESSEL TRACKS`**: Vessel traffic interrogation locus (`UNAVAILABLE // NOT YET CALCULATED`).
     8. **`08 / PROBABLE SOURCE REGION`**: Reverse-drift probability contour rings.
     9. **`09 / ATTRIBUTION MARKER`**: Ranked vessel target marker and resolution axis.

2. **Data Honesty & Provenance Handling (`src/ui/hooks/useEvidenceStackData.ts`)**:
   - Strictly consumes existing read-only Zustand store selectors (`useSarStore`, `useSimulationStore`, `useBacktrackingStore`, `useAttributionStore`, `useInvestigationStore`).
   - Zero fabricated telemetry, velocity vectors, or fake AIS tracks.
   - Unavailable layers honestly stamped: `UNAVAILABLE // NOT YET CALCULATED` and `ILLUSTRATIVE · NOT LIVE DATA` where educational models are rendered.

3. **Geospatial Projection (`src/ui/three/evidence/project.ts`)**:
   - Thin presentation mapper transforming geographic coordinates `[lon, lat]` into local 3D plate plane `[x, z]`.
   - Uses equirectangular / `circleRing` convention aligned with `AttributionMap.tsx` and incident bounds.
   - All 9 layers share the identical local coordinate frame.

4. **Dual Mount Architecture**:
   - **`/welcome` (Scene 04)**: Upgraded existing Scene 04 within `WelcomeScene.tsx`. Reuses the single R3F Canvas without mounting a second Canvas. Scroll progress through $0.58 \to 0.82$ drives the transition from STACKED ($0.58$) $\to$ EXPLODED ($0.68$) $\to$ CONVERGED ($0.78$), connecting seamlessly into Scene 05.
   - **`/investigation` (Map-First Opt-In)**: Default remains strictly **MAP-FIRST**. The 3D stack never auto-loads. Users explicitly open the stack via `[ 3D EVIDENCE STACK ↗ ]` in `InvestigationConsole.tsx` or the floating map action. Lazy-mounts `EvidenceStackViewport.tsx`. `[ ← RETURN TO MAP ]` restores `<MaritimeMapTheater />` while preserving all incident, store, and pipeline states.

5. **Phase System (`src/ui/three/evidence/phases.ts`)**:
   - **STACKED ($s = 0$)**: Plates superimpose tightly into a single composite instrument with minimal offset ($0.08$ units) preventing Z-fighting.
   - **EXPLODED ($s = 1$)**: Plates separate vertically along $Y$ ($\approx 1.8$ units per layer, total height $\approx 16$ units), revealing individual analytical surfaces, corner registration ticks, and sparse Drei `<Html>` metadata badges.
   - **CONVERGED ($s = 0.35$)**: Plates compress toward analytical focus while a vertical resolution axis line links the top Attribution Marker through the Source Region down to the SAR detection footprint.

6. **Accessible 2D Fallback (`src/ui/three/evidence/ExplodedEvidence2DFallback.tsx`)**:
   - High-contrast, publication-grade architectural SVG/CSS isometric diagram rendered when WebGL fails or `prefers-reduced-motion` is active.
   - All 9 layers, phase switches (`stacked`, `exploded`, `converged`), leader lines, and honest provenance tags remain fully readable with zero GPU strain or animation loops.

7. **Verification & Performance Gates**:
   - `npx tsc --noEmit`: 0 errors (exit code 0).
   - `npm run lint`: 0 errors, 0 warnings (exit code 0).
   - `npm run test -- --run`: 4/4 unit tests passed (exit code 0).
   - `npm run build`: 2026 modules transformed, `EvidenceStackViewport` isolated into separate lazy chunk (`13.04 kB` / `4.31 kB` gzip), built in 21.43s (exit code 0).
   - `npx playwright test scripts/welcome.pw.ts`: 6/6 passed (1.1m).
   - `npx playwright test scripts/evidence-stack.pw.ts`: 7/7 passed (1.2m) across all viewports (1920x1080, 1440x900, 1280x800, 768x1024), reduced motion, and WebGL disabled fallback.
   - `npx playwright test scripts/shots.pw.ts`: 24/24 passed (1.2m) across all 6 core routes.
   - Protected contracts verified: 0 modifications to `backend/`, `scientific-service/`, `src/store/`, `src/lib/`, `src/types/`, `src/hooks/`, `src/routes.ts`.

### Milestone Status
- **M7 is COMPLETE AND VERIFIED**. Exploded Evidence Experience successfully built, tested, and documented.


