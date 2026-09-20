# Available Skills Inventory

Generated during Milestone M0 Audit.
Environment: Windows 11 / PowerShell
Customization Root: `.agents/` (workspace) and global configuration.

---

## 1. Primary Required Skills (MASTER_BRIEF §4.1)

All 17 required skills specified in the Master Brief were verified directly on disk in `.agents/skills/`.

| Skill Name | Status | Location | Primary Role & Applied Principles |
|---|---|---|---|
| `graphify` | **AVAILABLE** | `.agents/skills/graphify/` | Codebase & architecture knowledge graph mapping; relationship extraction, AST analysis, community detection. |
| `frontend-design` | **AVAILABLE** | `.agents/skills/frontend-design/` | Art direction, design systems, visual hierarchy, typography, curated palette, and layout architecture. |
| `ui-ux-pro-max` | **AVAILABLE** | `.agents/skills/ui-ux-pro-max/` | UX architecture, accessibility standards, interaction design patterns, design system rules. |
| `critique` | **AVAILABLE** | `.agents/skills/critique/` | Milestone review passes, removing generic patterns ("take one accessory off"), challenging screen complexity. |
| `distill` | **AVAILABLE** | `.agents/skills/distill/` | Removing visual clutter, streamlining layouts, eliminating redundant borders/cards/chips. |
| `hierarchy` | **AVAILABLE** | `.agents/skills/hierarchy/` | Information priority, scale, focal points, cognitive load reduction. |
| `arrange` | **AVAILABLE** | `.agents/skills/arrange/` | Spatial composition, alignment grids, panel orchestration, map-first viewport balance. |
| `animate` | **AVAILABLE** | `.agents/skills/animate/` | Motion design, tweening, layout transitions, micro-interactions, respecting reduced motion. |
| `depth` | **AVAILABLE** | `.agents/skills/depth/` | Layered surfaces, tonal depth, restrained hairlines, spatial z-indexing. |
| `data-viz` | **AVAILABLE** | `.agents/skills/data-viz/` | Charts, scoring visualisations, timeline scrubbers, uncertainty contours, evidence metrics. |
| `imagery` | **AVAILABLE** | `.agents/skills/imagery/` | Satellite/SAR texture treatment, image styling, media containers. |
| `polish` | **AVAILABLE** | `.agents/skills/polish/` | Final finishing passes, micro-details, pixel alignment, border subtleties. |
| `web-design-guidelines`| **AVAILABLE** | `.agents/skills/web-design-guidelines/` | Accessibility (WCAG 2.2 AA), contrast validation, semantic HTML, keyboard operability. |
| `threejs-fundamentals`| **AVAILABLE** | `.agents/skills/threejs-fundamentals/` | Core 3D scene setup, geometry, lighting, materials, camera controls, R3F integration. |
| `threejs-animation` | **AVAILABLE** | `.agents/skills/threejs-animation/` | 3D procedural motion, wave displacement, ship rocking, camera choreography. |
| `threejs-interaction`| **AVAILABLE** | `.agents/skills/threejs-interaction/` | Raycasting, 3D layer selection, orbit/scroll manipulation. |
| `threejs-shaders` | **AVAILABLE** | `.agents/skills/threejs-shaders/` | Custom GLSL shaders (Gerstner waves, iridescent oil-sheen thin-film gradient). |

---

## 2. Supporting Rules & Workflows

| File | Type | Location | Purpose |
|---|---|---|---|
| `graphify.md` | Rule | `.agents/rules/graphify.md` | Codebase query guidelines via knowledge graph. |
| `graphify.md` | Workflow | `.agents/workflows/graphify.md` | Automated execution instructions for repository knowledge extraction. |

---

## 3. Global Skills & Plugins

The global agent environment also provides the following tools and capabilities:
- `antigravity-guide`: Reference for Antigravity engine and CLI workflows.
- `agy-customizations`: Reference for agent skills, rules, hooks, and plugins.
- `ponytail` suite (`ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`): Minimalist engineering & anti-bloat principles.
- Scientific plugins: NCBI, ChEMBL, PubChem, PDB, etc. (domain science queries).

---

## 4. Skill Application Roadmap by Milestone

| Milestone | Skills Applied | Focus |
|---|---|---|
| **M0** | `graphify` | Codebase extraction, component mapping, protected contract audit. |
| **M1** | `frontend-design`, `ui-ux-pro-max`, `hierarchy`, `depth` | Design plan, tokens, typography, base layout shell. |
| **M2** | `frontend-design`, `arrange`, `hierarchy`, `distill`, `animate`, `critique` | Command center, map theater, graticule, command spine, HUD. |
| **M3** | `arrange`, `hierarchy`, `data-viz`, `animate`, `critique` | Simulation control room & investigation workspace. |
| **M4** | `data-viz`, `imagery`, `threejs-fundamentals`, `animate`, `critique` | Backtracking & attribution ranking, vessel inspector 3D viewer. |
| **M5** | `frontend-design`, `hierarchy`, `data-viz`, `polish` | Scroll-driven forensic dossier, print CSS. |
| **M6** | `frontend-design`, `threejs-fundamentals`, `threejs-shaders`, `threejs-animation`, `animate`, `imagery` | Welcome page, 3D ocean, tanker, oil sheen shader. |
| **M7** | `threejs-interaction`, `threejs-animation`, `threejs-shaders`, `data-viz`, `depth` | 9-layer exploded evidence stack with 2D fallback. |
| **M8** | `animate`, `polish`, `critique` | Motion system, number tweening, route transitions. |
| **M9** | `web-design-guidelines`, `polish`, `critique` | Responsive audit, WCAG AA compliance, performance, bundle verification. |
