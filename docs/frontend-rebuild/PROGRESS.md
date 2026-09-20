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
- Install targeted styling packages for M1-M2 (`@tailwindcss/vite`, Radix primitives, Lucide icons, Sonner, Fontsource).
- Create `docs/frontend-rebuild/DESIGN_PLAN.md` with tokens, font hierarchy, and ASCII layout wireframes.
- Build design system foundation under `src/ui/design-system/`.
- Replace bloated `src/index.css` with clean Tailwind v4 stylesheet.
- Build foundational `AppShell.tsx` and verify green build and map coexistence.
