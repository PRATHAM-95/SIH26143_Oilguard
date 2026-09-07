# STEP 10 — Historical AIS Reconstruction + Vessel Attribution

> Status: **COMPLETE** — implemented, validated, live E2E green
> WS investigation: `oil-spill-system` (scientific service, Spring backend, Vite frontend)
> Spec: `research\21-technical-spec\SYSTEM_SPEC.md` — §10 (AIS Pipeline), §11 (Vessel Attribution),
>   §13 (Data Model), §15 (API Contracts), §18.3 (Validation), §19 (Performance), §24 (References)
> Plan: approved — scoring in the scientific service; frozen five-factor weights; honest provenance.

---

## 1. Objective and scope
(step 10: wire historical AIS traffic into the oil-spill investigation)
- Query an AIS provider for vessels plausibly near the estimated source in the estimate window.
- Reconstruct/re-filter trajectories; score candidates on the frozen five-factor composite.
- Orchestrate and persist an `attribution_run`; drive the investigation UI with live WebSocket events.
- Validate attribution on controlled recovery scenarios; measure everything; describe limitations honestly.

## 2. Decisions locked with the user (during plan approval)
1. AIS filtering + scoring lives in the **Python scientific service** (`/api/ais/query`, `/api/ais/filter`, `/api/score-vessels`); Spring Boot orchestrates, persists, and emits WS events.
2. Composite score = frozen five factors, weights **0.25 / 0.20 / 0.25 / 0.15 / 0.15** (spatial, temporal, trajectory, anomaly/behaviour, environmental). Weights are NOT silently retuned.
3. AIS reliability / data quality = **separate evidence block** per candidate, never folded into the composite.
4. Provenance states stay explicit: `REAL` / `CONTROLLED` / `FIXTURE` / `UNAVAILABLE`; CONTROLLED traffic is never presented as real AIS.
5. Output is always ranked **candidates**; the product never claims a vessel "caused" the spill. Low top score or thin margin => "attribution inconclusive".
6. Ground truth lives ONLY inside the validation harness; the served API path never sees it.
7. Validation results are measured; nothing is fabricated.

## 3. Research summary (what actually exists in the real-data landscape)
| Source | Availability | Historic positions | Verdict |
| --- | --- | --- | --- |
| Global Fishing Watch API v3 | free non-commercial key (globalfishingwatch.org/our-apis/) | 4Wings hourly "global presence" grid, 2012 → ~96 h ago; Vessel identity API | Presence *grid*, not sub-hourly positions; good validation seam, insufficient alone for precise attribution |
| aisstream.io | free token | real-time WebSocket only, no archive | unusable for a historical attribution window |
| Marine Cadastre Hub | free | US coastal waters only | N/A for the Indian Ocean AOI |
| Copernicus Marine | free | no AIS product | N/A |
| EMODnet | free | bulk/historical but heavy portal | documented, not wired in this build |
| **Decision** | — | — | **Default = deterministic simulated AIS clearly labelled CONTROLLED; real providers are gated seams that report UNAVAILABLE rather than fabricating** |

Literature notes: Luo et al. 2024 (bidirectional drift + AIS track-point matching in dense traffic), Longépé et al. 2015, El Mohtar 2021 (Bayesian attribution, spec §24), AISClean 2024 (trajectory reconstruction under uncertainty), J.Mar.Sci.Eng. 9(6):609 (2021, kinematic interpolation + anomaly detection), TRACE project (Haversine proximity + transponder-gap heuristics). The rule-based anomaly feature mirrors the kinematic-interpolation anomaly work; trajectory reconstruction uses great-circle interpolation with speed-gated splice and >30-min gap flags (spec §10.3).

## 4. Python scientific service (`app/ais/`)
- `contract.py` — `AisMessage`, `AisTrack`, `AisCandidate`, `AnomalySignal`, `AisProvider`, `AisProviderError`, `AisSourceState`.
- `generator.py` — deterministic lane-based simulated fleet (Layer A; `controlled-ais-v1`), `PlantedAnomaly` injection (validation-only).
- `providers.py` — Layer A `ControlledAisProvider`; Layer B seams `GfwAisProvider`, `MarineCadastreProvider`, `AisStreamProvider` (honest UNAVAILABLE), `resolve_ais_provider`.
- `config.py` — `AisConfig` (GFW_API_KEY), reference epoch + default seed, `report_ais_availability()`.
- `filters.py` — window → spatial (≤ radius) → reconstruction (interpolate ≤30-min gaps, great-circle) → rule-based anomalies (§10.4) → `AisCandidate` (+ reliability block).
- `scoring.py` — five frozen factors; composite + per-factor evidence; `rank_vessels` produces ranked candidates + margin + `conclusion` (`candidate`/`inconclusive`).
- `validation.py` — **ground-truth enclave**: 6 controlled scenarios, synthetic backtracking fan, aggregate metrics.
- Endpoints (added to `app/main.py`, APP_VERSION 0.5.0): `GET /api/ais/availability`, `POST /api/ais/query`, `POST /api/ais/filter`, `POST /api/score-vessels`, `POST /api/attribution/validate`.
- Temperature: none.

## 5. Spring Boot orchestration (`attribution` package)
- `AttributionRequest.java` — `@NotBlank simulationId`, optional `backtrackRunId` pin, `aisSource`, `seed`, `radiusKm`, `maxGapMin`, `environmentSource`, optional `currents`/`wind`.
- `AttributionRun.java` — persisted `attribution_run` doc (provenance fields, anchor geometry, pipeline summaries, ranked list as plain maps/lists).
- `AttributionRepository.java`, `AttributionController.java` — `POST /api/attribution/run`, `GET /api/attribution/runs?simulationId=`, `GET /api/attribution/runs/{runId}`, `GET /api/attribution/providers`.
- `AttributionService.java` — pipeline: anchor geometry (pinned/latest backtrack run → spill/sim fallback; AIS window release−48h..+24h) → AIS query → filter/reconstruct → five-factor scoring; broadcasts 7 WS events; persists with authoritative source state.
- `AttributionServiceTest.java` — 9 tests incl. event-ordering + honest failure paths (57/57 backend tests green).
- `SimulationEvent.java` — 7 STEP-10 event types/carriers: `ais_search.started`, `ais_search.completed`, `ais_search.failed`, `vessels_filtered`, `attribution.started`, `vessel_scores_ready`, `attribution.completed`.
- `PythonClientConfig.java` — WebClient `maxInMemorySize` raised to 8 MB (live E2E caught the default 256 KB `DataBufferLimitException` on large AIS track payloads).
- Config: `python.ais.*` paths + timeout; jar rebuilt (`target\app-0.1.0.jar`); live service on :8082.
- Live fixes from E2E (both confirmed by replay): persistence storage of raw Jackson nodes breaks read-back → `ranked_vessels` stored via `serializeNode` (plain `List`); runs list/get replay the identical payload incl. `closest_position`.

## 6. Frontend
- `lib/api/attributionApi.ts` + barrel — `run`/`list`/`get`/`providers`, `RankedVesselDto` (+ `closest_position`), `AttributionRunDto`.
- `lib/ws/events.ts` — `AttributionEventPayloadMap` + `AttributionWsEvent` union + `WS_EVENT_TYPES` (7 event types), exported from `lib/ws/index.ts`.
- `types/domain.ts` — rich `AttributionState`, `AttributionVesselEntry`, `AttributionRanking`.
- `store/featureStores.ts` — attribution store: `run`, `loadRuns`, `loadProviders`, `clear`, `applyWsEvent`; `vesselFromDto` maps wire snake_case → camel (`closest_position` → marker position).
- `hooks/useSimulationConnection.ts` — routes the attribution events into the store.
- `store/mapStore.ts` + `components/attribution/AttributionMap.tsx` — `attribution` layer: search-radius ring, origin marker, closest-approach markers/connection lines (positions drawn only where they genuinely exist).
- `pages/Attribution.tsx` — Actions (anchored on the backtracking `runId`), provenance + pipeline-state panels, `ConclusionBanner`, ranked table with per-factor evidence + data-quality blocks, layer cleanup on unmount.
- `pages/Investigation.tsx` — EvidenceCard AIS row now reads the store (analysing / N vessels · candidate|inconclusive / awaiting) with a "Open AIS attribution" action.
- `tsc -b` + `vite build` clean.

## 7. Validation (controlled recovery)
Results file: `research\25-ais-attribution\step10_validation_results.json` (measured, regenerated after the date-stability fix).
Targets (§18.3): top-1 > 0.70, top-3 > 0.90.

Metrics: scenario_count 6 · top1_rate **1.0** · top3_rate **1.0** · mean_mrr **1.0** · mean_margin **0.1774** · mean_reduction_ratio **0.2528** · mean_coverage **1.0** · expectation_satisfied **true** · target_top1 **true** · target_top3 **true**

| Scenario | Difficulty | Planted rank | Top-1 | Top-3 | Margin | Conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| easy-tanker | easy | 1 | ✓ | ✓ | 0.3085 | candidate |
| mid-cargo-maneuver | medium | 1 | ✓ | ✓ | 0.2171 | candidate |
| hard-trawler-loiter-gap | hard | 1 | ✓ | ✓ | 0.2788 | candidate |
| distractor-rich-false-friend | hard | 1 | ✓ | ✓ | 0.2281 | candidate |
| no-vessel-inconclusive | medium | — | ✓ (inconclusive) | ✓ | 0.0145 | inconclusive (top 0.43 < 0.45; margin < 0.05) |
| clean-traffic-control | control | — | ✓ (inconclusive) | ✓ | 0.0177 | inconclusive (top 0.37, margin < 0.05) |

Ground truth is enclosed in `validation.py` and never enters the served API path. The `no-vessel` and `clean-control` scenarios correctly refuse a false top-1 — that is the honest-control behaviour, so their top1/top3 rows read "satisfied" rather than "hit".

## 8. Live E2E (this session, full stack: python :8000 + Spring :8082 + MongoDB)
- Created simulation `6a9cda2775f74a20a7fc22e2` (region 16.5/12.5/74.5/70.5), started → clock 2026-09-06T03:12:39Z; ran backtrack `bt-b4df8da1-a19` (16.8 s, origin 72.5004,14.4999).
- Attributed the run (`radiusKm` 150, seed 26143, CONTROLLED) while wired to `/ws/simulation/{id}` via `infrastructure/scripts/ws-capture.py` (dependency-free RFC6455 client with an HTTP `--fire` trigger). Captured event order:
  `ais_search.started` → `ais_search.completed` (6 vessels, 563–1014 ms) → `vessels_filtered` (kept 2 / dropped 4 with reasons) → `attribution.started` → `vessel_scores_ready` → `attribution.completed`.
- Ranked: **MV BELAFARI-20** 0.3538 (closest 13.45 km, `closest_position` 72.4/14.5719), **FV EKTAEKTA-21** 0.2531 (76.39 km). `ranking` decisive margin 0.1007 but top score < 0.45 threshold → conclusion **inconclusive** (honest).
- `GET /api/attribution/runs` + `GET /runs/{id}` replay the exact persisted payload (incl. `closest_position`), `GET /api/attribution/providers` proxies availability (controlled=CONTROLLED, gfw/marine_cadastre/aisstream=UNAVAILABLE with reasons).
- Default-radius (50 km) run earlier produced an honest "no candidate vessels within search radius" inconclusive — the correct empty-AOI behaviour.
- The E2E surfaced and drove fixes for three real issues: (a) WebClient 256 KB buffer limit, (b) Jackson-node persistence read-back, (c) controlled world emptying out for "now"-anchored windows (below).

## 9. Performance (targets §19: attribution < 5 s total; WS event < 100 ms)
- Live attribution run (REST round trip incl. python query + filter + score): **1.26 s** — inside the < 5 s target.
- Stage timing observed live: AIS query 563–1014 ms (server under load), filter 15 ms, scoring sub-100 ms. All six WS events are broadcast synchronously as each stage finishes, so per-event delivery is bounded by the stage compute; the whole sequence completes within the run duration.
- No unit-test-only claims: these numbers are from the running stack.

## 10. Limitations & future real-provider pre-requisites
- Simulated AIS is traffic *density-reduced* vs live AIS (coarse lanes; overview) — fine for pipeline + controlled recovery, NOT a coverage claim.
- GFW integration pre-reqs: obtain free non-commercial key (identity API + 4Wings presence), verify tiles for the window/AOI, decode presence grid to positions with a sub-meter unit test, then flip a feature flag. The seam refuses to fabricate data meanwhile.
- AIS availability varies by region; Marine Cadastre (US) and aisstream.io (real-time) are documented but not applicable to the historical Indian Ocean demo.

## 11. Regression (Steps 02–09 must stay green)
- Python scientific service: `pytest tests -q` → **120 passed, 1 skipped** (117 pre-existing + new date-stability + closest-position tests).
- Spring backend: `mvn test` → **57 tests, 0 failures, 0 errors** (incl. `AttributionServiceTest`).
- Frontend: `tsc -b` and `vite build` clean; production bundle built.
- Validation artifact regenerated after the controlled-world fix; metrics inside targets (margin moved 0.1576 → 0.1774 from the lane-motion change, all top-1/top-3/expectation unchanged).

## 12. Controlled-world date-stability fix (found in live E2E)
The simulated fleet rides lanes with a fixed 2026-08-01 reference epoch. Motion was an unconstrained linear drift that clamped at lane termini, so any query window more than ~one month past the epoch saw **zero** traffic — a "now"-anchored simulation (incident clock = today) always produced an empty, honest-but-uninformative AOI. Fixed in `generator.py`: along-lane motion now folds into a round-trip (ping-pong) over the lane length, so the world stays inhabited and deterministic at ANY date, with no teleports and unchanged behaviour near the reference epoch. Added `test_world_populated_at_arbitrary_query_date`; the frozen scenario set and weights are untouched; artifact regenerated (see §7).