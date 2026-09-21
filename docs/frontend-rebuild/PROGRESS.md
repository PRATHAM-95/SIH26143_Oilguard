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
- **Branch**: `frontend-rebuild` (Commits `756dd59` (CSS fix), `53b6d5b` (M2b implementation), plus pending close-out commit)
- **Goal**: Rebuild the Command Center into an authentic map-first operational theater, eliminating old panels and mock data pipelines.

### What Was Done
1. **Command Center Rebuild**:
   - Replaced legacy `/` view with a 1440x900 map-first layout.
   - Built a dynamic `OperationalBar` with case reference, status indicators, and Cmd+K `CommandPalette` for route jumps (`/simulation`, `/investigation`, `/backtracking`, `/attribution`) and map layer toggles.
   - Built the 8-stage `FlightpathRail` extracting strictly from `investigationStore`. Re-aligned stage subtitles to exact stage IDs (`forward_drift`, `ais_analysis`).
   - Integrated `LayerDrawer` mapping directly to `MAP_LAYER_CATALOG`.
   - Built the `ContextualConsole` combining terminal output and timeline analysis.
2. **Honesty & Provenance Enforcement**:
   - Eliminated automatic fabricated demo mock pipelines. Removed `runLiveChallenge('DEMO')` from `CommandCenterPage.tsx` cold-open logic.
   - The map loads into a strictly honest "No data" state when idle.
   - Updated provenance labels in `OperationalBar` (Data: "No data", "Simulated", "Controlled"). No badges/pills; explicit text dots.
   - Enforced design system constraints: no all-caps, no pill shapes, no generic hex colors, no `!important` tags, no glassmorphism.
3. **Playwright Map & Attribution Assertions**:
   - Hardened `scripts/shots.pw.ts` to actively assert map attribution visibility. The test now executes `expect(covered).toBe(false)` using center-point coordinate evaluation, causing a hard CI failure if attribution is obscured.
   - Passed three consecutive `npm run shots` runs over all 24 configurations (4 viewports x 6 routes) with 100% success rate.
   - Screenshot artifacts saved in `docs/frontend-rebuild/screenshots/M2b/`.
4. **Full-Stack Execution & End-to-End Reliability**:
   - Executed `./start-stack.ps1 -Wait` seamlessly bridging scientific, backend, and frontend boundaries.
   - Ran actual simulation and investigation lifecycle via `scripts/e2e_investigation.py`. Verified all stages (`detection` through `conclusion`) completed accurately within expected time bounds.
   - Investigated `backend.log` and `sci.log` for anomalous 422, 500, or Exception triggers during E2E. Zero critical application faults observed (only benign config properties matched "500").

### Known Deviations
- `shellStore` was removed. The architecture leverages existing `layoutStore` and CSS variables, keeping the domain state exclusively to existing stores (`useInvestigationStore`, `useSimulationStore`).
- The `framer-motion` dependency is not used; `motion/react` is strictly used per process constraints.

### Milestone Status
- **M2b is COMPLETE**. Ready to transition to Milestone M3 (Investigation & Backtracking Interfaces).

