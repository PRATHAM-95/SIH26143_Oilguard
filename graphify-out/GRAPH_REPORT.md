# Graph Report - SIH26143_Oilguard  (2026-09-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3297 nodes · 8829 edges · 121 communities (71 shown, 50 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 1476 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eeb5738e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BacktrackingResult
- design_system.py
- core.py
- validation.py
- useMapStore
- AisTrack
- DesignSystemGenerator
- validate_data.py
- useSimulationStore
- InvestigationService.java
- drift/engine.py
- pipeline.py
- org.springframework.web.socket.WebSocketSession
- environment/providers.py
- domain.ts
- api/index.ts
- SimulationEvent
- main.py
- test_ais_scoring.py
- estimate_source
- Attribution.tsx
- Vessel
- useInvestigationStore
- test_design_system_mode.py
- SimulationController
- AisMessage
- InvestigationService
- SpillEvent
- SarScene
- InvestigationEvent
- ContextualPanel.tsx
- frontend/package.json
- org.springframework.web.reactive.function.client.WebClient
- Simulation
- Conclusion
- Investigation
- useSimulationConnection.ts
- SarObservation
- BacktrackingService
- InvestigationStage
- org.junit.jupiter.api.Test
- search_stack
- AttributionRun
- .runDetection
- fill_deck.py
- InvestigationExecutor
- ForwardDriftResult
- Icon.tsx
- list
- StartInvestigationRequest
- AttributionRequest
- InvestigationExecutorTest
- catalog.py
- test_ais_api.py
- .releaseSpill
- InvestigationParams
- ClassicalDarkSpotDetector
- SimulationControllerTest.java
- Evidence
- Region
- run_backtrack_ensemble
- BM25
- GroundTruth
- Investigation.tsx
- test_sar.py
- ForwardDriftRequest
- compilerOptions
- SimulationService
- Report.tsx
- test_backtrack_controlled_recovery.py
- AttributionService
- run_scenario
- .advance
- detect_domain
- CatalogRefreshTest
- resolve_oil_type
- DotenvLoader.java
- InvestigationStatus
- .normalize
- scripts
- ForwardDriftEngine
- ws-capture.py
- fixture.py
- test_environment_providers.py
- MoveVesselRequest
- .retry
- StageStatus
- find_contours
- SarDetectRequest
- SpillRequest
- ndarray
- TestThresholdGate
- test_skill_script_paths.py
- e2e-cdp.ps1
- CatalogSummaryLineEndingsTest
- split_values
- TestTextLayoutDataContracts
- TestStackFlagWithDesignSystem
- TestMetricMath
- SarConfig
- TestFixtureValidation
- e2e-run.ps1
- .requireSimulation
- src/vite-env.d.ts
- tsconfig.app.json
- backtracking/__init__.py
- drift/__init__.py
- environment/__init__.py
- uncertainty/__init__.py
- com.oilspill:app

## God Nodes (most connected - your core abstractions)
1. `Investigation` - 93 edges
2. `InvestigationExecutor` - 76 edges
3. `BacktrackingResult` - 66 edges
4. `AttributionRun` - 65 edges
5. `SimulationEvent` - 62 edges
6. `InvestigationService` - 58 edges
7. `SarObservation` - 56 edges
8. `useInvestigationStore` - 56 edges
9. `InvestigationStage` - 55 edges
10. `useSimulationStore` - 54 edges

## Surprising Connections (you probably didn't know these)
- `record_scene_processing()` --uses--> `SarScene`  [INFERRED]
  oil-spill-system/scientific-service/app/sar/preprocess.py → oil-spill-system/scientific-service/app/sar/contract.py
- `process_observation()` --uses--> `ObservationResult`  [INFERRED]
  oil-spill-system/scientific-service/app/sar/pipeline.py → oil-spill-system/scientific-service/app/sar/contract.py
- `ClassicalDarkSpotDetector` --uses--> `SlickCandidate`  [INFERRED]
  oil-spill-system/scientific-service/app/sar/detectors/classical.py → oil-spill-system/scientific-service/app/sar/contract.py
- `SarDetector` --uses--> `SarScene`  [INFERRED]
  oil-spill-system/scientific-service/app/sar/detectors/__init__.py → oil-spill-system/scientific-service/app/sar/contract.py
- `OnnxSegmentationDetector` --uses--> `SarScene`  [INFERRED]
  oil-spill-system/scientific-service/app/sar/detectors/onnx.py → oil-spill-system/scientific-service/app/sar/contract.py

## Import Cycles
- None detected.

## Communities (121 total, 50 thin omitted)

### Community 0 - "BacktrackingResult"
Cohesion: 0.05
Nodes (4): Anchor, BacktrackingRequest, Forcing, BacktrackingResult

### Community 1 - "design_system.py"
Cohesion: 0.05
Nodes (62): ansi_ljust(), _detect_page_type(), format_ascii_box(), format_markdown(), format_master_md(), format_page_override_md(), generate_design_system(), _generate_intelligent_overrides() (+54 more)

### Community 2 - "core.py"
Cohesion: 0.04
Nodes (53): _contains_phrase(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _file_signature(), _get_bm25(), _legacy_successor_guidance(), _load_csv() (+45 more)

### Community 3 - "validation.py"
Cohesion: 0.07
Nodes (67): app_ais_config, app_ais_generator, math, AisValidationError, Raised for semantically invalid attribution inputs., build_lane_geometry(), build_track(), course_between() (+59 more)

### Community 4 - "useMapStore"
Cohesion: 0.08
Nodes (50): circleRing(), RANK_COLORS, rankColor(), useAttributionLayers(), LayerInspector(), AutoEnableLayers(), PositionedCandidate, stageRankedVessels() (+42 more)

### Community 5 - "AisTrack"
Cohesion: 0.08
Nodes (51): app_ais_contract, app_ais_providers, AisConfig, get_ais_config(), AIS provider configuration. Mirrors ``app.environment.config``: reads external-…, Configuration that determines which real AIS providers can run., Read the effective AIS configuration once per process., Human/API-facing report of which AIS data sources can run. ``state`` uses the… (+43 more)

### Community 6 - "DesignSystemGenerator"
Cohesion: 0.05
Nodes (23): DesignSystemGenerator, Generates design system recommendations from aggregated searches., Load reasoning rules from CSV., Execute searches across multiple domains., Find matching reasoning rule for a category., Apply reasoning rules to search results., Select best matching result based on priority keywords., Extract results list from search result dict. (+15 more)

### Community 7 - "validate_data.py"
Cohesion: 0.07
Nodes (49): Semantic quality contracts for the core UI/UX datasets., read_rows(), TestAccessibilityGuidance, TestChartsTypographyAndIcons, TestCurrentReactGuidance, TestSemanticColors, _catalog_date(), _check_app_interface_contract() (+41 more)

### Community 8 - "useSimulationStore"
Cohesion: 0.07
Nodes (53): App(), ChallengeLog, ChallengePhase, ChallengeStoreState, phaseLabel(), resetCaseState(), runLiveChallenge(), sleep() (+45 more)

### Community 9 - "InvestigationService.java"
Cohesion: 0.09
Nodes (39): argthat, arrays, atomicreference, comparator, countdownlatch, criteria, document, executors (+31 more)

### Community 10 - "drift/engine.py"
Cohesion: 0.05
Nodes (52): c_oilguard_sih26143_oilguard_oil_spill_system_scientific_service_app_models_forward_drift_py, dataclasses, Extent, functools, logging, Backtracking engine — ensemble backward Lagrangian particle simulation. Uses…, _build_extent(), _convex_hull_2d() (+44 more)

### Community 11 - "pipeline.py"
Cohesion: 0.07
Nodes (44): dotenv, numpy, get_sar_config(), SAR configuration. Reads any real-data credentials (Copernicus Data Space) and…, Read the effective SAR configuration once per process., Human/API-facing report of which SAR sources/detectors can run., report_sar_availability(), ObservationResult (+36 more)

### Community 12 - "org.springframework.web.socket.WebSocketSession"
Cohesion: 0.07
Nodes (31): channeloption, connectionprovider, exchangestrategies, httpclient, PythonClientConfig, Override, WebCorsConfig, InvestigationEventBroadcaster (+23 more)

### Community 13 - "environment/providers.py"
Cohesion: 0.08
Nodes (47): cachetools, Combines CMEMS currents and/or ERA5 wind into one normalized field. Raises…, _RealForcingProvider, get_environment_config(), Read the effective environment configuration once per process., EnvironmentField, EnvironmentProvider, EnvironmentProviderError (+39 more)

### Community 14 - "domain.ts"
Cohesion: 0.05
Nodes (49): DataSourceCardProps, STATUS_DOT, investigationApi, InvestigationDto, InvestigationReport, RevealResponse, StartInvestigationRequest, ConnectionState (+41 more)

### Community 15 - "api/index.ts"
Cohesion: 0.08
Nodes (43): AisProviderReport, attributionApi, AttributionFactorEvidence, AttributionFactorKey, AttributionRankingDto, AttributionRequest, AttributionRunDto, RankedVesselDto (+35 more)

### Community 17 - "main.py"
Cohesion: 0.06
Nodes (50): AisCandidateOut, AisMessageOut, AisQueryRequest, AisQueryResponse, AisTrackOut, AttributionValidateRequest, AttributionValidateResponse, c_oilguard_sih26143_oilguard_oil_spill_system_scientific_service_app_models_ais_py (+42 more)

### Community 18 - "test_ais_scoring.py"
Cohesion: 0.10
Nodes (48): app_ais_scoring, AisCandidate, AnomalySignal, A rule-based anomaly observation derived from a track (frost §10.4)., A vessel that survived querying + filtering, ready for scoring.…, _clamp01(), factor_anomaly(), factor_environmental() (+40 more)

### Community 19 - "estimate_source"
Cohesion: 0.08
Nodes (48): BacktrackResponse, _point_in_ring(), Ray-casting point-in-polygon test., compute_source_time_range(), _compute_spread_km(), _convex_hull_region(), _convex_hull_ring(), _degenerate_estimate() (+40 more)

### Community 20 - "Attribution.tsx"
Cohesion: 0.07
Nodes (45): useBacktrackingLayers(), MissionWorkspace(), WorkspaceLayout, Attribution(), ConclusionBanner(), DEFAULT_WEIGHTS, EVIDENCE_FACTORS, FACTOR_LABELS (+37 more)

### Community 22 - "useInvestigationStore"
Cohesion: 0.09
Nodes (37): AttributionCard(), FACTOR_LABEL, tca(), BacktrackingCard(), hhmm(), ConclusionCard(), IncidentCard(), ContextualConsole() (+29 more)

### Community 23 - "test_design_system_mode.py"
Cohesion: 0.07
Nodes (25): _contrast_ratio(), _derive_dark_palette(), _filter_anti_patterns_for_mode(), _palette_is_dark(), _query_wants_dark(), WCAG relative luminance of a #RRGGBB string, or None if unparseable., True when a colors.csv row's Background is a dark surface., WCAG contrast ratio for two hex colors, or None if either is invalid. (+17 more)

### Community 24 - "SimulationController"
Cohesion: 0.08
Nodes (22): BacktrackingService.SimulationNotFound, ForwardDriftService.NoSpillYet, ForwardDriftService.SimulationNotFound, httpstatus, InvestigationService.ConflictException, InvestigationService.InvestigationNotFound, InvestigationService.ValidationException, HealthController (+14 more)

### Community 25 - "AisMessage"
Cohesion: 0.11
Nodes (44): AisFilterRequest, AisFilterResponse, app_ais_filters, AisMessage, A single decoded AIS position report., build_candidate(), classify_reliability(), closest_approach() (+36 more)

### Community 26 - "InvestigationService"
Cohesion: 0.08
Nodes (5): ConflictException, InvestigationNotFound, InvestigationService, ValidationException, RevealMetrics

### Community 27 - "SpillEvent"
Cohesion: 0.07
Nodes (5): NoSpillYet, SpillEvent, GeoPoint, BacktrackingServiceTest, RequestBodySpec

### Community 28 - "SarScene"
Cohesion: 0.09
Nodes (28): app_sar_catalog, app_sar_scenes, ProvenanceState, Append a step to the reproducible processing log., Explicit source state for a SAR observation (never kept ambiguous)., A single processed SAR scene ready for detection. ``amplitude_db`` is a 2-D…, SarScene, build_fixture_scene() (+20 more)

### Community 30 - "ContextualPanel.tsx"
Cohesion: 0.08
Nodes (30): SelectionInspectorCard(), IntelClearButton(), IntelSection(), IntelShell(), OverviewIntel(), stageOrigin(), stageUncertaintyKm(), CloseIcon() (+22 more)

### Community 31 - "frontend/package.json"
Cohesion: 0.05
Nodes (39): dependencies, @deck.gl/core, @deck.gl/layers, @deck.gl/mapbox, maplibre-gl, react, react-dom, react-map-gl (+31 more)

### Community 32 - "org.springframework.web.reactive.function.client.WebClient"
Cohesion: 0.11
Nodes (23): bigdecimal, callable, concurrenthashmap, concurrentmap, Counter, datetimeformatter, duration, hashmap (+15 more)

### Community 33 - "Simulation"
Cohesion: 0.12
Nodes (23): any, anystring, argumentcaptor, argumentmatchers, assertions, assertnotnull, assertthrows, com.fasterxml.jackson.databind.ObjectMapper (+15 more)

### Community 36 - "useSimulationConnection.ts"
Cohesion: 0.10
Nodes (26): useInvestigationConnection(), ATTRIBUTION_EVENT_TYPES, BACKTRACK_EVENT_TYPES, SAR_EVENT_TYPES, SIM_EVENT_TYPES, SocketClient, WS_BASE, WsConnectionStatus (+18 more)

### Community 38 - "BacktrackingService"
Cohesion: 0.10
Nodes (8): com.fasterxml.jackson.databind.JsonNode, BacktrackingService, SimulationNotFound, ForwardDriftService, SimulationNotFound, SarService, SarServiceTest, org.springframework.http.ResponseEntity

### Community 41 - "org.junit.jupiter.api.Test"
Cohesion: 0.12
Nodes (5): SimulationValidationException, RequestBodySpec, SimulationControllerTest, org.junit.jupiter.api.Test, org.springframework.transaction.annotation.Transactional

### Community 42 - "search_stack"
Cohesion: 0.09
Nodes (9): _exact_stack_identifier(), Resolve a standalone API identifier even when its BM25 IDF is low., Search stack-specific guidelines, search_stack(), TestDiagnosticsContracts, _rows(), TestNativeDesktopStackFreshness, _rows() (+1 more)

### Community 45 - "fill_deck.py"
Cohesion: 0.13
Nodes (25): add_card(), add_text(), arrow(), IN(), Rebuild slide 3 as pictorial 3-swimlane layout. Keeps template chrome (GROUP…, rgb(), style_tf(), add_card() (+17 more)

### Community 46 - "InvestigationExecutor"
Cohesion: 0.17
Nodes (7): jakarta.annotation.PostConstruct, InvestigationExecutor, StageOutcome, CANCELLED, FAILED, PROGRESSED, org.slf4j.Logger

### Community 48 - "Icon.tsx"
Cohesion: 0.10
Nodes (16): Layout(), NAV, SecondaryPageHeader(), SpineHealthMonitor(), WORKSPACE_MAP, BacktraceIcon(), ClockIcon(), CommandIcon() (+8 more)

### Community 49 - "list"
Cohesion: 0.19
Nodes (10): arraylist, id, indexdirection, indexed, instant, list, map, messagedigest (+2 more)

### Community 51 - "AttributionRequest"
Cohesion: 0.09
Nodes (3): AttributionRequest, Forcing, AttrRequestHelper

### Community 52 - "InvestigationExecutorTest"
Cohesion: 0.23
Nodes (4): jakarta.annotation.PreDestroy, InvestigationExecutorTest, SuppressWarnings, org.junit.jupiter.api.AfterEach

### Community 53 - "catalog.py"
Cohesion: 0.11
Nodes (22): Live real Sentinel-1 GRD discovery over the default study AOI. Runs an…, sar_catalog(), CatalogProduct, CatalogSearchResult, _contains_polarization(), default_time_range(), _normalize_feature(), datetime (+14 more)

### Community 54 - "test_ais_api.py"
Cohesion: 0.09
Nodes (6): fastapi_testclient, _query_tracks(), Wire-contract tests for the STEP 10 AIS + attribution endpoints., test_ais_filter_wire_path(), test_score_vessels_wire_path(), FastAPI wire-contract tests for the frozen §15.2 forward-drift endpoint.

### Community 57 - "ClassicalDarkSpotDetector"
Cohesion: 0.12
Nodes (16): GeoTransform, Simple north-up affine mapping pixel -> lon/lat. Uses an equirectangular local…, Convert pixel (row, col) coordinates to (lon, lat) tuples., Approximate metres per pixel at a reference latitude., ClassicalDarkSpotDetector, _mask_to_ring(), _principal_axes(), ndarray (+8 more)

### Community 58 - "SimulationControllerTest.java"
Cohesion: 0.09
Nodes (14): anydouble, anyint, autowired, jsonpath, max, mediatype, min, mockbean (+6 more)

### Community 61 - "run_backtrack_ensemble"
Cohesion: 0.15
Nodes (22): BacktrackConfig, BacktrackMember, BacktrackResult, _generate_seed_positions(), CurrentForcing, datetime, ndarray, WindForcing (+14 more)

### Community 62 - "BM25"
Cohesion: 0.13
Nodes (8): BM25, BM25 ranking algorithm for text search, Lowercase, normalize synonyms, split, remove punctuation, filter stopwords, Build BM25 index from documents, Score all documents against query, All indexed terms, for suggestion/typo-recovery purposes., TestBm25CoreBehavior, TestTokenizer

### Community 64 - "Investigation.tsx"
Cohesion: 0.13
Nodes (13): PROVENANCE_LABEL, provenanceBadge(), SarObservationPanel(), oil_spill_system_frontend_src_components_investigation_sarobservation_usesarstore, EmptyState(), KeyValue(), Panel(), PanelVariant (+5 more)

### Community 65 - "test_sar.py"
Cohesion: 0.14
Nodes (17): app_sar_contract, app_sar_detectors_classical, app_sar_fixture, app_sar_pipeline, CandidateClass, ProcessingStatus, Enum, str (+9 more)

### Community 67 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+12 more)

### Community 69 - "Report.tsx"
Cohesion: 0.12
Nodes (15): dotClass, resolveStatusTone(), SemanticStatus, StatusChip(), StatusTone, DossierHeader(), EMPHASIS_SECTIONS, GroundTruth() (+7 more)

### Community 70 - "test_backtrack_controlled_recovery.py"
Cohesion: 0.18
Nodes (18): app_backtracking_engine, app_backtracking_source, app_models_forward_drift, _format_table(), _point_in_ring(), Step 09 controlled forward→backward source-recovery experiment. Unlike the…, Ray-casting point-in-polygon test (GeoJSON [lon, lat] ring)., Analytic (first-order) displacement magnitude at the TRUE source. (+10 more)

### Community 71 - "AttributionService"
Cohesion: 0.14
Nodes (6): AttributionService.AttributionNotFound, AttributionService.SimulationNotFound, AttributionController, AttributionNotFound, AttributionService, SimulationNotFound

### Community 73 - "run_scenario"
Cohesion: 0.19
Nodes (15): app_ais_validation, Any, Run the (sub)set of controlled scenarios and aggregate measured metrics., run_all_scenarios(), run_scenario(), _synthetic_backtracking_fan(), Controlled recovery validation for the attribution stage (STEP 10). Ground…, test_aggregate_metrics_meet_targets() (+7 more)

### Community 74 - ".advance"
Cohesion: 0.16
Nodes (4): assertequals, asserttrue, Navigate, NavigateTest

### Community 75 - "detect_domain"
Cohesion: 0.23
Nodes (3): detect_domain(), Auto-detect the most relevant domain from query. Matches are weighted by…, TestDomainDetection

### Community 77 - "resolve_oil_type"
Cohesion: 0.21
Nodes (14): app_drift_engine, list_valid_oil_types(), Return the valid ADIOS oil types known to the installed OpenOil. Cached:…, Map the requested oil type to a valid ADIOS entry or raise ValueError., resolve_oil_type(), forward_drift_preview(), Validation of oil-type resolution against the installed NOAA ADIOS DB., SYSTEM_SPEC's 'GENERIC CRUDE' is not an ADIOS entry; must map cleanly. (+6 more)

### Community 78 - "DotenvLoader.java"
Cohesion: 0.17
Nodes (9): files, java.nio.file.Path, linkedhashmap, DotenvLoader, OilSpillApplication, org.springframework.boot.autoconfigure.SpringBootApplication, paths, springapplication (+1 more)

### Community 79 - "InvestigationStatus"
Cohesion: 0.16
Nodes (9): InvestigationStatus, CANCELLED, COMPLETED, CREATED, FAILED, RUNNING, isActive(), org.springframework.boot.context.event.ApplicationReadyEvent (+1 more)

### Community 81 - "scripts"
Cohesion: 0.14
Nodes (13): devDependencies, concurrently, name, private, scripts, dev, dev:backend, dev:frontend (+5 more)

### Community 82 - "ForwardDriftEngine"
Cohesion: 0.29
Nodes (11): DriftEngineConfig, ForwardDriftEngine, Runtime parameters for a forward-drift simulation. All values are explicit…, Runs OpenOil forward-drift simulations from a normalized request., _centroid(), Controlled-environment forward-drift behaviour and reproducibility. These tests…, test_deterministic_across_repeated_runs(), test_eastward_current_drifts_centroid_east() (+3 more)

### Community 83 - "ws-capture.py"
Cohesion: 0.18
Nodes (11): base64, _fire(), main(), _delayed_fire(), Minimal raw RFC6455 client for capturing plain-JSON WebSocket frames. Used by…, Fired a short moment after the socket handshake completes., socket, struct (+3 more)

### Community 84 - "fixture.py"
Cohesion: 0.30
Nodes (11): _allocate_scene(), _compute_fixture_field(), _disc_mask(), _ellipse_mask(), _gaussian_field(), make_land_mask(), ndarray, Deterministic SAR-like fixture generation. Produces a repeatable, clearly-… (+3 more)

### Community 85 - "test_environment_providers.py"
Cohesion: 0.27
Nodes (10): app_environment, app_environment_contract, fixture, avail(), _FakeConfig, Tests for real-data environment providers (Layer B). These tests DO NOT touch…, _synthetic_currents(), _synthetic_wind() (+2 more)

### Community 88 - "StageStatus"
Cohesion: 0.24
Nodes (9): isSkippedOrUnavailable(), isTerminal(), StageStatus, COMPLETED, FAILED, PENDING, RUNNING, SKIPPED (+1 more)

### Community 89 - "find_contours"
Cohesion: 0.20
Nodes (10): _close(), _edge_points(), find_contours(), _interp(), ndarray, Linear interpolation factor between two vertex values at ``level``., Return border intersection points for a 2x2 cell as [x, y] pairs. values is 4…, Return 0/2 border points (the segment crossing this cell). (+2 more)

### Community 92 - "ndarray"
Cohesion: 0.22
Nodes (9): build_land_mask(), dB_from_power(), lee_speckle_filter(), mask_land_with_index(), ndarray, Convert power (sigma0) to decibels: 10*log10(power)., Lee filter for SAR speckle suppression (classical, deterministic). Acts only…, Build a boolean land mask. A simple, honest heuristic for a fixture: land and… (+1 more)

### Community 94 - "test_skill_script_paths.py"
Cohesion: 0.38
Nodes (5): Every script invocation in the shipped skill markdown resolves from the skill…, Return (target, None) for a skill-relative path, or (None, reason)., resolve(), shipped_invocations(), SkillScriptPathsTest

### Community 95 - "e2e-cdp.ps1"
Cohesion: 0.62
Nodes (6): Click-ByText(), Eval-JS(), Log(), Read-Frame(), Send-Cdp(), Wait-Text()

### Community 96 - "CatalogSummaryLineEndingsTest"
Cohesion: 0.40
Nodes (3): CatalogSummaryLineEndingsTest, _load_generator(), Simulate a Windows checkout: the recorded hashes must still validate.

### Community 97 - "split_values"
Cohesion: 0.47
Nodes (3): split_values(), style_identities(), TestStyleIdentityContract

## Knowledge Gaps
- **184 isolated node(s):** `ImportMeta`, `ImportMetaEnv`, `DataSourceCardProps`, `ConnectionState`, `EnvironmentStoreState` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 975 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `InvestigationExecutor` connect `InvestigationExecutor` to `org.springframework.web.reactive.function.client.WebClient`, `BacktrackingResult`, `Conclusion`, `Investigation`, `BacktrackingService`, `AttributionService`, `InvestigationStage`, `InvestigationService.java`, `.runAisSearch`, `.runForwardDrift`, `org.springframework.web.socket.WebSocketSession`, `.runDetection`, `InvestigationStatus`, `InvestigationExecutorTest`, `InvestigationService`, `Evidence`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `BacktrackingResult` connect `BacktrackingResult` to `org.springframework.web.reactive.function.client.WebClient`, `InvestigationService.java`, `Simulation`, `list`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `InvestigationService` connect `InvestigationService` to `org.springframework.web.reactive.function.client.WebClient`, `Conclusion`, `Investigation`, `InvestigationStage`, `InvestigationService.java`, `org.junit.jupiter.api.Test`, `InvestigationExecutor`, `InvestigationStatus`, `.retry`, `SimulationController`, `InvestigationParams`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AttributionRun` (e.g. with `.getRunReturnsShapedEntityOrThrows()` and `.listRunsShapesEntitiesLikePostResponse()`) actually correct?**
  _`AttributionRun` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ImportMeta`, `ImportMetaEnv`, `DataSourceCardProps` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BacktrackingResult` be split into smaller, more focused modules?**
  _Cohesion score 0.05196717862402693 - nodes in this community are weakly interconnected._
- **Should `design_system.py` be split into smaller, more focused modules?**
  _Cohesion score 0.04588607594936709 - nodes in this community are weakly interconnected._