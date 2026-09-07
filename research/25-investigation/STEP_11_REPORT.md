# STEP 11 — Persistent, Resumable Investigation Workflow (Build Mode)

## Status: COMPLETE

Persistent, resumable investigation workflow implemented as a Mongo-backed
" saga-lite " orchestration over the Step 09/10 science. Eight stages run
in-process and emit live WebSocket frames; the frontend investigation
workspace and the rebuilt 12-section Report page consume the frozen REST +
WS contract.

## What was built

### Backend orchestrator (`backend/.../investigation/`)
- State machine: Investigation `CREATED → RUNNING → COMPLETED | FAILED | CANCELLED`;
  Stage `PENDING → RUNNING → COMPLETED | FAILED | SKIPPED | UNAVAILABLE`.
- Eight stages (`StageIds.ORDER`): detection, characterization, environment,
  forward_drift, backtracking, ais, attribution, conclusion.
  Critical (failure ⇒ FAILED): detection, backtracking, ais, attribution.
  Non-critical (failure ⇒ SKIPPED; environment ⇒ UNAVAILABLE): characterization,
  environment, forward_drift.
- `InvestigationService`: start (idempotent — reuses ACTIVE, COMPLETED ⇒ new),
  retry (resets failed/skipped stages → CREATED + reschedule), cancel, reveal
  (COMPLETED-only, 409 otherwise), 12-section report.
- `InvestigationExecutor`: durable orchestration via `runNow(String)` sync hook;
  executor concurrency 2, retries 3 (1s/3s backoff), claimUntil 600s;
  `recoverStaleInvestigations()` sweep on ApplicationReadyEvent.
- `Provenance`: normalize → REAL | CONTROLLED | FIXTURE | UNAVAILABLE; correct
  aggregate ordering (any UNAVAILABLE ⇒ PARTIAL; all REAL ⇒ ALL_REAL; any
  REAL/FIXTURE ⇒ MIXED; all CONTROLLED ⇒ ALL_CONTROLLED; empty ⇒ PARTIAL).
- Conclusion thresholds (frozen): top ≥ 0.45 AND margin ≥ 0.05
  (from `app/ais/scoring.py`).
- Evidence chain: 7 stage entries + 1 conclusion synthesis = 8; the executor
  skips `appendEvidence` for the CONCLUSION stage to avoid a double entry.
- Ground-truth isolation: only `reveal()` reads `GroundTruthRepository`;
  get/report expose only `reveal.revealed`.

### REST (frozen)
- `POST /api/investigation/{incidentId}/start` (idempotent)
- `GET /api/investigation/{id}`, `GET /{id}/steps`
- `GET /api/investigation?simulationId=&incidentId=&status=`
- `POST /{id}/retry {stageId?}`, `POST /{id}/cancel`, `POST /{id}/reveal`
- `GET /{id}/report` — 12 sections: 1_summary … 12_limitations

### WebSocket (frozen, camelCase)
- Topic `/ws/investigation/{investigationId}`; events: investigation_started,
  step_complete, origin_estimated, vessels_ranked, investigation_complete,
  investigation_failed, investigation_cancelled. Live-update only; frontend
  re-hydrates via REST on reconnect.

### Frontend
- `events.ts`: full camelCase investigation event map added to WS_EVENT_TYPES.
- `investigationApi.ts`: start/get/steps/list/retry/cancel/reveal/report + DTOs.
- `investigationStore.ts`: hydrate-from-DTO, start(incidentId)/load/list/
  retry/cancel/revealGroundTruth/applyWsEvent; 8-stage STAGE_ORDER + labels.
- `simulationStore.ts`: captures `incidentId` from release-spill response.
- `hooks/useInvestigationConnection.ts`: subscribes `/ws/investigation/{id}`,
  applyWsEvent, refetch on reconnect.
- `Pipeline.tsx`: 8 stages including skipped/unavailable states.
- `pages/Investigation.tsx`: investigation workspace (start/retry/cancel/reveal,
  stage detail, provenance+params, conclusion, evidence, SAR observation).
- `pages/Report.tsx`: rebuilt to list → latest investigation → report(id) →
  render all 12 sections + ground-truth metrics.

## Measured results (live E2E, local host)

Full clean run — sim 6a9d26bc…1bf, spill incident …, investigation
`inv-a2274da8-ac4`:

| Stage | Status | Provenance | Reference |
|---|---|---|---|
| detection | COMPLETED | FIXTURE | sar-b67ff5f3-97f |
| characterization | COMPLETED | FIXTURE | sar-b67ff5f3-97f |
| environment | COMPLETED | CONTROLLED | (probe) |
| forward_drift | COMPLETED | CONTROLLED | drift-e2b8e07b-1bb |
| backtracking | COMPLETED | CONTROLLED | bt-ddce0c2f-4b6 |
| ais | COMPLETED | CONTROLLED | att-90846861-950 |
| attribution | COMPLETED | CONTROLLED | att-90846861-950 |
| conclusion | COMPLETED | — | — |

- Investigation status RUNNING → COMPLETED, progress 0→1.0.
- Evidence chain: 8 entries (7 stages + conclusion synthesis).
- Provenance aggregation: MIXED (SAR is FIXTURE, rest CONTROLLED).
- Conclusion: INCONCLUSIVE — top 0.2336 < 0.45, margin 0.2336 ≥ 0.05;
  candidate null; honest language ("highest-ranked candidate, never culprit").
- Reveal: positionError_km 0.02, timeError_min 180, attributionCorrect false
  (no top candidate, so correctness "cannot be evaluated" — as noted in
  `notes`); revealed true.
- Sim lifecycle: `/api/simulation/{id}` status observed `investigation` during
  the run and `completed` after; `investigation` pointer null (additive change
  deliberately skipped).
- WS frames captured verbatim over `/ws/investigation/{id}`: the full
  step_complete sequence with correct camelCase fields, plus origin_estimated
  (`uncertaintyKm` camelCase on this topic) and vessels_ranked + the final
  investigation_complete carrying conclusionStatus / conclusion JSON.

Cross-run reuse verified (retry run `inv-0c714877-e71`): backtracking and
attribution stages referenced the same `bt-e9a14743-f5e` / `att-e0c066da-6c1`
runs as the prior investigation, because the executor reuses the newest
compatible persisted run before calling a service. Retry of a FAILED
investigation (Python was briefly down) recovered to COMPLETED automatically.

### Fault path (observed + handled)
A retry while the scientific service was unreachable failed the critical
`detection` stage after 3 attempts (1s → 3s backoff) and correctly failed the
investigation (`investigation_failed` frame captured). After the service
returned, retry() recovered it to COMPLETED. The non-critical `forward_drift`
stage, when the Python drift call returned 422 (unknown oil type), was
correctly SKIPPED with a `step ... skipped` frame and provenance PARTIAL; it
did not fail the investigation.

## Fixes introduced during verification
- `scientific-service/app/drift/engine.py`: common spill-report codes now map
  onto valid ADIOS entries — `HFO`/`IFO-380 → GENERIC BUNKER C`,
  `DIESEL → GENERIC DIESEL`, `CRUDE OIL → GENERIC MEDIUM CRUDE`. Without this,
  a spill recorded as `HFO` (as created by the fixture spill API) caused the
  drift stage to 422 and be SKIPPED. Mapping tests live in
  `tests/test_oil_types.py` (5 tests, all green).
- Frontend type fixes during implementation: renamed the store action from
  `reveal` to `revealGroundTruth` to avoid a collision with the `reveal`
  state field; corrected WS stage-status comparisons to lowercase values
  (`'failed'`, `'completed'`).

## Provenance & honesty notes
- Provenance aggregation is per-component and computed over the actual stage
  sources (SAR FIXTURE, drift/backtracking/AIS CONTROLLED). The system never
  claims the whole investigation is real from a single component.
- Language throughout the UI, WS frames, conclusion and report is
  "highest-ranked candidate / potential slick / SAR anomaly" — never
  "culprit" / "definitive" / probability guarantees.
- CONTROLLED and FIXTURE sources are labeled verbatim, both in the UI
  (Provenance & Parameters panel) and in the 12-section report.
- Ground truth is sealed until `POST /reveal` on a COMPLETED investigation
  (409 otherwise); get()/report() expose only the `revealed` boolean.

## Deviations
- Frontend Report page reads incidentId from the simulation spill state (the
  IncidentController is a stub with no GET incidents), matching the frozen
  REST surface.
- `SimulationService.getSimulation` does not return an investigation pointer
  (additive change deliberately skipped — the frontend lists investigations by
  simulationId instead).
- Report path ambiguity resolved to `research/25-investigation` per the
  Step 11 brief (the approved plan name `26-investigation` had already been
  superseded by `25-ais-attribution` for the prior step).

## Gates
- Backend: `mvn -q -DskipTests compile` clean; full regression suite green
  (89/89 tests, 0 failures) — see `backend/src/test/java/com/oilspill/app/`.
- Scientific: full `pytest` suite green (121 passed, 1 skipped across 16 test
  files), incl. the oil-type mapping tests in `tests/test_oil_types.py`.
- Frontend: `tsc -b` clean; `vite build` succeeds (chunk-size warnings only,
  pre-existing for the map/maplibre vendor bundles).

## Git status
- Single prior commit: `1c2ba97` (Steps 09/10/11 backend + previous steps
  infrastructure are uncommitted; see `git status --short` for the full set of
  modified + untracked files, including the whole `investigation/` package,
  step test suites, the new investigation store/api/components, and the
  scientific-service oil-type mapping).
- Nothing committed during this step; commit only on request.

## Step 11.1 Hardening & Verification

### Race-condition review (backend)
The Step 11 executor wrote whole-document snapshots between stages and
finalized without a persisted guard. A concurrent cancel/create could clobber
evidence, re-append the conclusion link, leave a RUNNING zombie, or double-start
an investigation. All writes now go through atomic, status-guarded partial
updates on the `investigation` collection:

- `persistStarted`: conditional `status=CREATED -> RUNNING`; 0 modifiedCount
  -> re-read and abort (cancelled-between-start-and-boot no longer runs).
- `persistCompleted`: conditional `status<>CANCELLED -> COMPLETED` that sets
  conclusion + completedAt and ``es the synthesis evidence link in ONE
  operation; the in-memory mutation happens only after the write succeeds, so a
  refused finalize leaves evidence frozen (never 8 on a CANCELLED doc).
- `conditionalStageStartSave` / `conditionalStageCompletedSave`: per-stage
  progress/errors/references + warnings persisted conditionally on
  `status IN (CREATED, RUNNING)`; post-stage `cancelWon` checks stop the loop
  and only then persist the terminal CANCELLED + broadcast.
- `failInvestigation` / `broadcastCancelled` / `appendEvidence`: all
  guarded by the same active-state query; a run that lost a race re-reads the
  persisted doc instead of trusting a stale in-memory copy.
- `InvestigationService.start`: per-incident `synchronized` lock
  (`START_LOCKS`) around an extracted `doStart`, so two simultaneous
  `POST /start` calls create exactly one investigation (lock released in
  `finally`).
- `cancel` is atomic and conditional: only CREATED/RUNNING -> CANCELLED; if
  the write applies 0 docs the caller re-reads and reports the persisted state
  instead of guessing.
- `runInvestigation` entry guard: COMPLETED/FAILED -> silent no-op, CANCELLED
  -> broadcast once; `runNow` is now idempotent by construction (a second call
  never re-appends the conclusion evidence).

### Regression coverage (post-hardening)
- Backend `mvn test`: 89/89 green (10 suites). `InvestigationExecutorTest`
  now includes mid-run cancel, cancel-before-boot, atomic-finalize-refused,
  final-attempt recovery, runNow idempotency, and data-insufficiency paths;
  `InvestigationServiceTest` adds concurrent-start (exactly one), and
  start-after-COMPLETED. `report()` test asserts all 12 sections.
- Frontend: `tsc -b` clean; `vite build` OK.
- Scientific: `pytest` 121 passed, 1 skipped (16 files).

### Live E2E results (hardened jar on the running stack)
| Scenario | What was verified | Result |
| --- | --- | --- |
| E2E_1 RELEASE | full run COMPLETED in 69 s; 8 evidence links; 12-section report; single `investigation_complete` frame; monotonic progress | PASS |
| E2E_2 FORCE | cancel mid-run (t=40 s) -> CANCELLED; rerun created a fresh investigation which completed | PASS |
| E2E_3 RECONNECT | WS killed mid-run; reconnect observed monotonic 0.625..1.0 with no replay and one terminal event | PASS |
| E2E_4 PARAM | rerun with overridden radius/ensemble/particles COMPLETED with deterministic 8 links | PASS |
| E2E_5 RERUN-COMPLETED | start after COMPLETED -> new id; old investigation evidence stayed 8/8 (no re-append) | PASS |
| UI-FULL | browser: create sim -> select vessel -> spill -> start investigation -> RUNNING (cancel visible) -> COMPLETED; report page renders 13 section headings | PASS |
| UI-CANCEL | browser: start investigation then Cancel button -> status CANCELLED | PASS |

Live stack: Mongo 27017, scientific service 8000, backend 8082 (hardened jar),
vite 3000. WebSocket assertions via `infrastructure/scripts/ws-capture.py`
(raw RFC6455 socket, zero deps); browser automation via
`infrastructure/scripts/e2e-cdp.ps1` (raw Chrome DevTools Protocol over a
PowerShell `ClientWebSocket` � Node v20 has no global WebSocket).

### Honesty notes
Live conclusions were NO_CANDIDATES because the offline environment provider
cannot produce wind/current forcing and the single demo vessel yields no AIS
track inside the search radius; the system reports this truthfully (Conclusion
reason, provenance MIXED/PARTIAL, report 12 section 9/10). The verdict is
sealed until `POST /reveal` and revealed correctly on COMPLETED runs
(position error 0.02 km observed).

## Final delivery (A - G)
A. Hardened investigation engine (`InvestigationExecutor`) + coordinating
   service (`InvestigationService`) with atomic conditional persistence and a
   per-incident start lock; frontend replay guard, hook dedupe, CSS additions.
B. Regression suites green end-to-end: backend 89/89, scientific 121 passed,
   frontend `tsc -b` + `vite build`.
C. Live single-container-stack run reproduced every hardening scenario
   (cancel race, reconnect, idempotent rerun, UI cancel/reveal/report).
D. Evidence-chain invariants proven live: counts never regress on cancel,
   completed investigations never re-append synthesis links, terminals are
   single-emission.
E. WebSocket + browser drivers shipped dependency-free
   (`ws-capture.py`, `e2e-cdp.ps1`, `e2e-run.ps1`).
F. Nothing committed; repo stays at `1c2ba97` (see `git status --short`).
G. No design changes to the frozen Step 11 REST surface; STEP 12 not started.
