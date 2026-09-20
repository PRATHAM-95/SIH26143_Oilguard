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
- Rebuild `/` Command Center into an authentic map-first theater.
- Build live Graticule frame displaying dynamic viewport lat/long coordinates.
- Implement Command Spine with brand emblem, route shortcuts, UTC Zulu clock, and service health dots.
- Implement Operational Bar with case reference, status indicators, and Ctrl+K Command Palette (`cmdk`).
- Build interactive 8-stage Flightpath rail with stage state transitions.
- Build collapsible Layer Drawer and Contextual Console.

