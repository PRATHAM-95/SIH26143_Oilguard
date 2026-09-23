# OilGuard Frontend Rebuild: Master Brief for the Antigravity Agent

Save this file in the repo as `docs/frontend-rebuild/MASTER_BRIEF.md`. Re-read it at the start of every session and every milestone.

---

## 0. How you must work

1. Read this whole brief before touching any code.
2. Work in **milestones (M0 to M9)**, defined in section 13. Do **one milestone at a time**. At the end of each, stop, write the report, and wait for the user to say `Proceed to M<n>`. Do not start the next milestone on your own.
3. Keep a running log at `docs/frontend-rebuild/PROGRESS.md`. After every milestone, record what is done, what is decided, and what is next. At the start of every new session, read `MASTER_BRIEF.md` and `PROGRESS.md` first. Assume your memory of earlier turns can be lost.
4. Work on a git branch named `frontend-rebuild`. Commit at the end of every milestone with a clear message.
5. Prefer editing files on disk over pasting large files into chat. Keep chat replies short and factual.
6. The environment is Windows with PowerShell. Use PowerShell-compatible commands and `npm`.
7. Never claim something works unless you ran it and saw it work in the real browser.

---

## 1. Mission

Rebuild the **entire frontend presentation layer** of OilGuard into a premium, industry-standard maritime intelligence product that looks and feels like a real commercial product a government agency or maritime company would pay for. It must not look like a hackathon project, an admin template, or generic AI output.

The user wants: a completely new UI and UX, new fonts and colour system, 3D and scroll-driven storytelling, premium animation, exploded-evidence visuals, ship visuals, and a modern tech stack. Deleting and rebuilding the existing UI is allowed and expected.

**Same engine, new experience.** The backend, APIs, data flow and scientific logic stay. Everything the user sees and touches is rebuilt.

---

## 2. Product context (compressed)

OilGuard is a maritime forensic platform built for Smart India Hackathon problem statement **SIH26143**: use satellite imagery to detect oil spills at sea and use AIS vessel data to identify the vessel responsible.

The core idea is **evidence convergence**. Satellite/SAR detection, environment, forward drift, backtracking, AIS vessel filtering and scoring converge into an explainable attribution and a forensic dossier.

The investigation has exactly **8 sequential stages**: Detection, Characterization, Environment, Forward Drift, Backtracking, AIS Analysis, Attribution, Conclusion.

Repo: `C:\oilguard\SIH26143_Oilguard`, main dir `oil-spill-system/`.

- `backend/`: Java, Spring Boot, Maven, MongoDB. Runs on port 8082.
- `scientific-service/`: Python, FastAPI, OpenDrift. Runs on port 8000.
- `frontend/`: React, TypeScript, Vite, Zustand, MapLibre, Deck.gl, Recharts, WebSocket hooks. Runs on port 3000.
- MongoDB on 27017. Startup scripts: `start-stack.ps1`, `start-stack-visible.ps1`, `start-backend-stack.ps1`, `start-frontend.ps1`.

Existing routes: `/`, `/simulation`, `/investigation`, `/backtracking`, `/attribution`, `/report`.

Existing Zustand stores include `useSimulationStore`, `useSarStore`, `useBacktrackingStore`, `useAttributionStore`, `useInvestigationStore`, `useMapStore`, `useChallengeStore`, `useConnectionStore` (there may be more).

Attribution uses five scoring factors: spatial, temporal, trajectory, anomaly, environmental.

---

## 3. Hard rules

### 3.1 Protected (do not modify behavior)

- Backend, scientific service, API contracts, MongoDB persistence.
- Zustand store logic and shapes. Consume them; do not duplicate their state in components. If you need derived data, write thin read-only selector hooks in `src/ui/hooks/`.
- WebSocket hooks, topics, event handling, live-state behavior.
- Existing route paths and their behavior. You may **add** new routes (see `/welcome`).
- Investigation stage IDs and order.
- Map data contracts and **existing Deck.gl layer IDs** and their availability/toggle logic. You may restyle how layers look. New layers you add must use IDs prefixed `ui-`.
- Attribution, backtracking, drift and simulation logic.

If a task seems to require changing any of the above, stop and ask the user.

### 3.2 Honesty (core product trust principle)

- Never fabricate vessel data, coordinates, confidence values, scores, telemetry, progress percentages, evidence or environmental values.
- Label provenance clearly everywhere data appears: **Live**, **Controlled** (demo scenario), **Simulated**, **No data**, **Unavailable**, **Awaiting acquisition**, **Not yet calculated**. Controlled data must never look like a real operational observation.
- If there is no active simulation, show an honest empty state that says what to do next.
- Marketing and landing pages: do **not** invent customers, logos, testimonials, statistics, certifications, compliance claims or awards. Any illustrative visual must carry a small "Illustrative, not live data" label.
- Dev-only fixtures are allowed to design populated states, but only behind `import.meta.env.DEV` plus an explicit `?fixtures=1` flag, with a permanent visible "FIXTURE DATA (DEV ONLY)" stamp, and they must be excluded from production builds.
- 3D ship models shown for a specific vessel are **representative models by ship type**, and must be labelled "Representative model, not vessel-specific geometry".

---

## 4. Tools and skills: use them, but verify first

### 4.1 Discover what is really installed

Before using any skill, list what exists. Check `.agent/`, `.agents/`, and any global skills folder for `skills/`, `rules/`, `workflows/`. Write the list into `docs/frontend-rebuild/SKILLS_AVAILABLE.md`.

The user expects these to be installed. Use each one that is present. If one is missing, say so plainly in your report and apply its principle manually. Never pretend to have used a skill you cannot find.

- `frontend-design`: art direction, typography, palette, layout. Owns the design plan.
- `ui-ux-pro-max`: UX architecture, design system, accessibility reasoning.
- `critique`: challenge your own screens at the end of each milestone.
- `distill`: remove visual complexity.
- `hierarchy`: information priority.
- `arrange`: composition and spatial organization.
- `animate`: motion and microinteractions.
- `depth`: layered surfaces and spatial hierarchy.
- `data-viz`: charts, scores, evidence presentation.
- `imagery`: image and media treatment.
- `polish`: final finishing pass.
- `web-design-guidelines`: accessibility and interface QA.
- `threejs-fundamentals`, `threejs-animation`, `threejs-interaction`, `threejs-shaders`: all 3D work.
- `graphify`: repository understanding only. Not a design tool.

### 4.2 Skill use by milestone

| Milestone | Skills to use |
|---|---|
| M0 | graphify |
| M1 | frontend-design, ui-ux-pro-max, hierarchy, depth |
| M2 | frontend-design, arrange, hierarchy, distill, animate, critique |
| M3 | arrange, hierarchy, data-viz, animate, critique |
| M4 | data-viz, imagery, threejs-fundamentals, animate, critique |
| M5 | frontend-design, hierarchy, data-viz, polish |
| M6 | frontend-design, threejs-fundamentals, threejs-shaders, threejs-animation, animate, imagery |
| M7 | threejs-interaction, threejs-animation, threejs-shaders, data-viz, depth |
| M8 | animate, polish, critique |
| M9 | web-design-guidelines, polish, critique |

State at the start of each milestone which skills you are applying and what you took from them.

### 4.3 Graphify

In M0, read `graphify` rules and workflow files (typically `.agents/rules/graphify.md` and `.agents/workflows/graphify.md`) and run the Graphify workflow on the repo. Use it to map: frontend components, stores, hooks, API clients, WebSocket hooks, map layer definitions, and the boundaries to backend and scientific-service. Save the summary to `docs/frontend-rebuild/ARCHITECTURE_MAP.md`.

### 4.4 Browser

Use the browser tool for real visual QA (section 12). A passing build is not enough.

---

## 5. Tech stack

**Keep:** React, TypeScript, Vite, React Router, Zustand, MapLibre GL, Deck.gl, existing REST clients and WebSocket hooks. Recharts may stay for simple charts.

**Add (only what a milestone needs; do not install everything up front):**

- **Styling and components:** Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (Radix primitives), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- **Interaction:** `cmdk` (command palette, Ctrl/Cmd+K), `vaul` (drawers and bottom sheets), `react-resizable-panels`, `sonner` (toasts).
- **Motion:** `motion` (import from `motion/react`) for UI and layout animation, `gsap` with ScrollTrigger and `@gsap/react` for scroll stories, `lenis` for smooth scrolling on scroll-story pages only.
- **3D:** `three`, `@react-three/fiber`, `@react-three/drei`, and `@react-three/postprocessing` (light bloom only, if at all). Match the R3F major version to the project's React major (R3F v8 with React 18, v9 with React 19). Check `package.json` first. Custom GLSL shaders for ocean and oil sheen. Consider `vite-plugin-glsl`.
- **Data tables and charts:** `@tanstack/react-table`, `@tanstack/react-virtual`, `d3-scale`, `d3-shape`, `d3-interpolate` (custom SVG charts).
- **Fonts:** self-hosted via `@fontsource-variable/*` (no runtime font CDN).
- **Quality:** `vitest`, `@testing-library/react`, `@playwright/test`, `@axe-core/playwright`, ESLint.

Tailwind v4 must coexist with MapLibre and Deck.gl CSS. Test the map after introducing Tailwind. All 3D and GSAP code must be **lazy-loaded** (`React.lazy`, dynamic import) so the console's initial bundle stays lean.

New presentation code lives under `frontend/src/ui/`:
`ui/design-system`, `ui/shell`, `ui/console`, `ui/pages`, `ui/three`, `ui/motion`, `ui/marketing`, `ui/hooks`.
When a page is rebuilt, delete the old presentation files it replaces. The build must stay green at the end of every milestone.

---

## 6. Design direction (decided; refine details, do not change the concept without stating why)

### 6.1 Concept: "Instrument at sea"

The product should feel like a precise forensic instrument built on a nautical chart, not a SaaS dashboard.

- **Structural device:** a fine chart-style graticule frame around the map. Its tick labels show the **real latitude and longitude of the current viewport**. It is information, not decoration.
- **One memorable thing:** the oil-sheen visual. A thin-film iridescent gradient is the signature colour moment, used **only** where oil appears (slick, hero scene, exploded-evidence slick layer). Everything else is calm and disciplined.
- **Depth through restraint:** hairlines and tonal layering, not heavy shadows or glowing borders. Backdrop blur only on small floating map overlays.

### 6.2 Colour tokens (define in Tailwind `@theme`, verify WCAG AA contrast)

```css
@theme {
  --color-abyss:     #050B14;  /* base background */
  --color-trench:    #0B1A2B;  /* panels */
  --color-deck:      #122336;  /* raised surface */
  --color-chartline: #1E3550;  /* hairlines, graticule */
  --color-foam:      #E8F0F7;  /* primary text */
  --color-mist:      #9DB2C8;  /* secondary text */
  --color-dim:       #5F7690;  /* tertiary text (large or non-essential only) */
  --color-sonar:     #4FD1E8;  /* single restrained accent */
  --color-ok:        #3DD68C;
  --color-warn:      #F2B84B;
  --color-danger:    #F0616D;
  --gradient-sheen: linear-gradient(115deg, #7B61FF 0%, #2DD4BF 38%, #F2C14E 68%, #EF6461 100%);
}
```

Backgrounds use a deep-sea radial gradient (abyss to a slightly lighter navy) with a very subtle grain overlay. No neon glows, no random gradient washes, no purple-blue AI gradients outside the oil sheen.

### 6.3 Typography (self-hosted)

- **UI and headings:** Schibsted Grotesk (variable). Hierarchy comes from size, weight, spacing, alignment.
- **Dossier and long-form reading:** Newsreader (variable), with slightly more line-height than the sans, lines under 80 characters.
- **Technical values only:** JetBrains Mono for coordinates, IDs, timestamps, MMSI/IMO, numeric readouts, with `font-variant-numeric: tabular-nums`. Never use mono for ordinary labels.
- If you believe another choice is better, document why in `DESIGN_PLAN.md`; do not silently swap.

### 6.4 Layout and component principles

- **Map first.** On `/` and the analysis pages the map is the primary surface. At most two docked panels. Panels are resizable and collapsible.
- Navigation: a slim **command spine** (icon rail that expands on hover or pin), a thin operational bar (case reference, simulation clock, connection and data-provenance state, Ctrl/Cmd+K), a **flightpath** for the 8 stages, a **layer drawer**, and a **contextual console** that changes with the active stage or selected map feature.
- Show what matters now, then allow depth. Do not expose every data source at equal weight.
- Use graded corner radii (small for data controls, medium for panels, large only for overlays), not one radius everywhere.
- Numbered markers appear **only** for the 8 stages, which are a real sequence.

### 6.5 Avoid (generic tells)

Card-inside-card nesting; every element as a rounded card; pills and status chips everywhere; tracked-out ALL-CAPS eyebrow labels above every heading; "WORD: fragment" label patterns; middle-dot metadata strings; arrow glyphs appended to every link; one accent word italicised in every headline; fade-and-slide-up on every section; hover lift on every card; neon; glassmorphism everywhere; decorative radar sweeps; gaming or cyberpunk HUD styling; giant purposeless 3D globes; monospace everywhere; fake telemetry.

Copywriting: plain language, sentence case, active voice, specific button labels ("Run forward drift", "Open dossier"). Empty and error states explain what happened and what to do next.

---

## 7. Information architecture and pages

Keep every existing route. Add `/welcome`.

| Route | Purpose | Key UI |
|---|---|---|
| `/welcome` (new) | Cinematic product story and entry point | Pinned 3D scroll narrative (section 8), ends with "Open the console" linking to `/` |
| `/` Command Center | Main operating surface | Map theater, graticule frame, command spine, operational bar, flightpath, layer drawer, contextual console, selection inspector, Ctrl/Cmd+K |
| `/simulation` | Scenario control room | Simulation lifecycle controls, vessel fleet, spill release, time scrubber with play/pause, forward-drift view, honest empty state when no simulation is active |
| `/investigation` | Stage-by-stage evidence workspace | The 8 stages, evidence per stage, stage detail, "Evidence stack" mode (section 8.4) |
| `/backtracking` | Inverse drift analysis | Ensemble trajectories, convergence, source region and uncertainty, time-window control |
| `/attribution` | Candidate ranking | Virtualized ranked table, five-factor score breakdown, vessel inspector with track timeline and closest approach, representative 3D ship viewer |
| `/report` | Forensic dossier | Document-like, scroll-driven, provenance footnotes, limitations section, print-ready CSS |

Console pages must work without any 3D. Cinematic scrolling belongs to `/welcome` and `/report` (and the optional evidence stack), never to normal operational workflows.

---

## 8. 3D and scroll storytelling

### 8.1 General rules

- 3D is used where it explains something, is isolated in its own canvas, lazy-loaded, and has a **2D fallback** (static SVG or CSS 3D) for: no WebGL, reduced motion, low-power devices, and print.
- No heavy WebGL over the operational map on `/`. The map stays authoritative.
- Scroll stories use Lenis plus GSAP ScrollTrigger driving a camera or timeline via scroll progress. Disable smooth-scroll hijacking under `prefers-reduced-motion`.

### 8.2 `/welcome` scroll narrative

1. **Hero:** a real-time 3D ocean (custom Gerstner-wave shader with fresnel and soft foam), a slowly rocking tanker, a slick that carries the oil-sheen shader. Headline is plain and specific, for example: "From a satellite detection to an attributable vessel." One orchestrated entrance, then calm.
2. **The real question:** camera lowers into the water while copy explains that detecting oil is only the first step.
3. **The eight stages:** the pinned scene advances through Detection to Conclusion, with the camera and scene state changing per stage.
4. **Evidence convergence:** the exploded-evidence stack (8.4).
5. **Attribution:** vessel tracks converge and a ranked list resolves.
6. **Trust and provenance:** how Live, Controlled and Simulated data are labelled.
7. **Dossier preview** and a clear call to action.

All figures shown here are illustrative and labelled as such.

### 8.3 Ship visuals

- **Hero and marketing:** a procedurally built tanker from primitives or lathe/extrude geometry, or a CC0 glTF model with its licence recorded in `public/models/LICENSES.md`. Add gentle wave-driven bobbing and a lightweight wake.
- **Map markers:** ship-type silhouettes (tanker, cargo, container, fishing, passenger, tug, unknown) in an icon atlas, rotated by heading or course, scaled by zoom, with emphasis for the top-ranked candidates. Keep the existing vessel layer IDs and data accessors. Only change how they look.
- **Vessel inspector:** a small representative 3D ship viewer by vessel type, with the required label from section 3.2.

### 8.4 Exploded evidence stack ("explosive images")

The user means an **exploded-view of layered evidence**, not an explosion effect. Nine layers, in this order from bottom to top:

1. Satellite/SAR scene
2. Oil slick mask (oil-sheen shader)
3. Wind field
4. Ocean currents
5. Forward drift
6. Backtracking ensemble
7. AIS vessel tracks
8. Probable source region
9. Attribution marker

Three states: **stacked**, **exploded** (layers separate along Z with labelled leader lines and a per-layer provenance tag), and **converged** (layers recombine and the attribution marker resolves). It is driven by scroll on `/welcome` and by a slider or toggle in `/investigation`.

In `/investigation`, each layer must use real store data where it exists and show "No data" or "Not yet calculated" where it does not. On `/welcome` it uses an illustrative scene labelled as such. Build it in R3F with textured planes and `drei` `Html`/`Text` labels; provide the 2D fallback (an annotated exploded SVG or CSS 3D).

### 8.5 Dossier scroll

`/report` reads like a formal document: incident, context, detection, characterization, environment, forward drift, backtracking, source analysis, AIS, attribution, conclusion, limitations. Scroll progress drives a sticky section index and quiet evidence reveals (trajectory lines drawing, scores counting up). It must not read like a marketing page, and it must print cleanly to PDF via print CSS.

---

## 9. Motion system

- Tokens: micro 100-150ms, UI 180-280ms, major layout 300-500ms, cinematic 500-1200ms. Define shared easings. Premium does not mean slow.
- CSS for hover and focus. `motion` for layout transitions, shared-element transitions (for example the active-nav indicator and flightpath stage state), and `AnimatePresence` panel enter/exit. GSAP only for scroll timelines. SVG or Canvas for trajectory drawing.
- Stage state transitions (pending, active, complete) and score changes animate. Numbers tween instead of snapping.
- Use the View Transitions API for route changes where supported, with a `motion` fallback.
- Non-user-triggered motion is rare: at most one orchestrated moment per page. Motion that answers a user action is welcome.
- Respect `prefers-reduced-motion` everywhere.

---

## 10. Responsive, accessibility, performance

- **Responsive:** console is desktop-first (1280 and up), with drawers and bottom sheets at tablet and small widths. `/welcome` and `/report` are fully responsive down to phone width.
- **Accessibility (WCAG 2.2 AA):** full keyboard operation, visible focus rings, skip links, proper landmarks, ARIA on custom controls, contrast checks, information never conveyed by colour alone, accessible names on map controls, and a text alternative for the 3D scenes.
- **Performance targets:** 60 fps on a mid-range laptop. Cap device pixel ratio (about 1.5 to 2). Pause render loops when the canvas is off-screen or the tab is hidden. Code-split three and gsap. No huge particle systems, no stacked blurs. Report bundle sizes per milestone.

---

## 11. Data and state rules

- Presentation components consume existing stores and hooks. No new duplicate state, no fake API, no duplicated business logic.
- Loading uses skeletons that match final layout. Empty states are honest and actionable. Errors are specific.
- Preserve connection behavior and live updates. Do not touch WebSocket topics.

---

## 12. Validation and browser QA (every milestone)

Run: `npm run build`, `npm run lint` (if configured), and TypeScript checking.

Use the real browser at `http://localhost:3000` (start via the existing PowerShell scripts, for example `start-frontend.ps1`). Review at **1920x1080, 1440x900, 1280x800 and 768 wide**. Save screenshots to `docs/frontend-rebuild/screenshots/M<n>/`.

Check: page mounts, navigation, map interaction, layer toggles, stage interaction, console with no React or hook errors, hierarchy, spacing, overlap, readability, map obstruction, empty states, animation behavior, reduced-motion behavior, keyboard focus.

If the backend is not running, verify the honest empty and unavailable states, and note that populated states could not be checked.

End every milestone with a critique pass: what would you remove ("take one accessory off")? What still looks generic? Fix or list it.

---

## 13. Milestones

Stop after each and wait for approval.

- **M0. Audit and plan (no changes to `src/`).** Create branch. Inventory skills. Run Graphify. Write `ARCHITECTURE_MAP.md`, `PROTECTED_CONTRACTS.md` (routes, store public fields, WebSocket hooks, layer IDs, stage IDs, API clients, types), `DELETE_LIST.md` (old presentation files and what replaces them), and `PLAN.md`.
- **M1. Foundations.** Install stack for M1-M2 only, Tailwind v4 tokens, self-hosted fonts, design-system primitives, motion tokens, base layout shell. Write `DESIGN_PLAN.md` (tokens, type roles, ASCII wireframes for each page) and review it against the section 6.5 avoid-list before coding.
- **M2. Command Center.** Map theater with graticule frame, command spine, operational bar, flightpath, layer drawer, contextual console, selection inspector, Ctrl/Cmd+K.
- **M3. Simulation and Investigation pages** (without the 3D evidence stack).
- **M4. Backtracking and Attribution,** including ship map markers, score breakdown, virtualized candidate table, and vessel inspector with the representative 3D viewer.
- **M5. Report / dossier** with print-ready CSS, change dossier to report.
- **M6. `/welcome` cinematic landing:** 3D ocean, tanker, oil-sheen shader, pinned scroll story.
- **M7. Exploded evidence stack** in `/welcome` and `/investigation`, with 2D fallback.
- **M8. Motion polish:** stage transitions, number tweening, route transitions, hover and focus refinement.
- **M9. Responsive, accessibility, performance, final QA,** README and design-system documentation.

### Milestone report format

1. Skills applied and what you took from each
2. Exact files added, changed, deleted
3. Functional changes
4. Visual changes
5. Architectural changes
6. Build, lint, TypeScript results, and bundle sizes
7. Browser results with screenshot paths at all four sizes
8. Self-critique and remaining problems
9. What you need from the user (approval, decisions)

---

## 14. Definition of done

- Looks like a professionally authored commercial maritime intelligence product, not a template.
- The map is the centre of the console. The user always knows where they are in the investigation, what evidence exists, and what happens next.
- Every existing route works. All protected contracts are intact. Build, lint and type checks pass.
- 3D and scroll storytelling work, are performant, and degrade to 2D.
- No fabricated data anywhere. Provenance is always visible.
- Keyboard, contrast and reduced-motion support verified.

---

## 15. Your first action

Do **M0 only**. Do not modify anything under `frontend/src/`. When M0 is complete, post the milestone report and wait for `Proceed to M1`.
