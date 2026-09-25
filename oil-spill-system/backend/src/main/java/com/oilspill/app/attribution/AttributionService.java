package com.oilspill.app.attribution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.backtrack.BacktrackingResult;
import com.oilspill.app.config.ScienceMetrics;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.websocket.SimulationEvent;
import com.oilspill.app.websocket.SimulationEventBroadcaster;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Historical AIS + vessel attribution orchestration (STEP 10).
 *
 * Pipeline: AIS query -> candidate filter/reconstruct -> frozen five-factor
 * vessel scoring, anchored on the simulation's backtracking result (source
 * origin + time range + trajectory fan) when present.
 *
 * Provenance is never fabricated: the provider/source-state reported by the
 * scientific service is stored and echoed verbatim, and only CONTROLLED
 * traffic exists in this build (other sources fail honestly upstream).
 */
@Service
public class AttributionService {

    private static final DateTimeFormatter ISO_Z =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SimulationRepository simulationRepository;
    private final SpillEventRepository spillEventRepository;
    private final BacktrackingRepository backtrackingRepository;
    private final AttributionRepository attributionRepository;
    private final WebClient pythonWebClient;
    private final SimulationEventBroadcaster broadcaster;

    /** Optional (null in unit tests): Micrometer timing for the python calls. */
    private ScienceMetrics scienceMetrics;

    @Autowired(required = false)
    public void setScienceMetrics(ScienceMetrics scienceMetrics) {
        this.scienceMetrics = scienceMetrics;
    }

    @Value("${python.ais.query-path:/api/ais/query}")
    private String aisQueryPath;

    @Value("${python.ais.filter-path:/api/ais/filter}")
    private String aisFilterPath;

    @Value("${python.ais.score-path:/api/score-vessels}")
    private String aisScorePath;

    @Value("${python.ais.availability-path:/api/ais/availability}")
    private String aisAvailabilityPath;

    @Value("${python.ais.timeout-seconds:180}")
    private int aisTimeoutSeconds;

    void setAisPathsForTest(String query, String filter, String score, String availability) {
        this.aisQueryPath = query;
        this.aisFilterPath = filter;
        this.aisScorePath = score;
        this.aisAvailabilityPath = availability;
    }

    void setAisTimeoutSecondsForTest(int seconds) {
        this.aisTimeoutSeconds = seconds;
    }

    public AttributionService(SimulationRepository simulationRepository,
                              SpillEventRepository spillEventRepository,
                              BacktrackingRepository backtrackingRepository,
                              AttributionRepository attributionRepository,
                              WebClient pythonWebClient,
                              SimulationEventBroadcaster broadcaster) {
        this.simulationRepository = simulationRepository;
        this.spillEventRepository = spillEventRepository;
        this.backtrackingRepository = backtrackingRepository;
        this.attributionRepository = attributionRepository;
        this.pythonWebClient = pythonWebClient;
        this.broadcaster = broadcaster;
    }

    @Transactional
    public Map<String, Object> runAttribution(String simulationId, AttributionRequest request) {
        Simulation sim = requireSimulation(simulationId);

        String aisSource = request.getAisSource() == null || request.getAisSource().isBlank()
                ? "CONTROLLED" : request.getAisSource();
        double radiusKm = request.getRadiusKm() == null ? 50.0 : request.getRadiusKm();
        double maxGapMin = request.getMaxGapMin() == null ? 30.0 : request.getMaxGapMin();
        String environmentSource = request.getEnvironmentSource() == null || request.getEnvironmentSource().isBlank()
                ? "CONTROLLED" : request.getEnvironmentSource();

        String attributionRunId = "att-" + UUID.randomUUID().toString().substring(0, 12);

        // Anchor geometry: from the (pinned or latest) backtracking run, else spill/sim.
        Anchor anchor = resolveAnchor(sim, request.getBacktrackRunId());
        String releaseIso = anchor.releaseTime == null ? null : ISO_Z.format(anchor.releaseTime);
        String earliestIso = ISO_Z.format(anchor.aisWindowStart);
        String latestIso = ISO_Z.format(anchor.aisWindowEnd);

        Instant startedAt = Instant.now();
        AttributionRun ent = new AttributionRun();
        ent.setAttributionRunId(attributionRunId);
        ent.setSimulationId(simulationId);
        ent.setBacktrackRunId(anchor.backtrackRunId);
        ent.setStatus("started");
        ent.setAisSource(aisSource);
        ent.setEnvironmentSource(environmentSource);
        ent.setModelVersion("ais-scoring-v1");
        ent.setOrigin(anchor.origin);
        ent.setTimeRange(anchor.timeRange);
        ent.setReleaseTime(anchor.releaseTime);
        ent.setRadiusKm(radiusKm);
        ent.setMaxGapMin(maxGapMin);
        ent.setSeed(request.getSeed());
        ent.setStartTime(startedAt);
        ent.setCreatedAt(startedAt);
        attributionRepository.save(ent);

        broadcaster.broadcast(simulationId,
                SimulationEvent.aisSearchStarted(simulationId, attributionRunId, aisSource));

        try {
            // Stage 1 — AIS query (historical reconstruction).
            Map<String, Object> queryBody = new HashMap<>();
            queryBody.put("origin", anchor.origin);
            queryBody.put("timeStart", earliestIso);
            queryBody.put("timeEnd", latestIso);
            queryBody.put("radiusKm", radiusKm);
            queryBody.put("source", aisSource);
            if (request.getSeed() != null) {
                queryBody.put("seed", request.getSeed().intValue());
            }

            ResponseEntity<JsonNode> queryResp = scienceMetrics == null
                    ? postJson(aisQueryPath, queryBody)
                    : scienceMetrics.time("ais-query", () -> postJson(aisQueryPath, queryBody));
            JsonNode query = requirePayload(queryResp, "AIS query");
            JsonNode tracks = query.path("tracks");
            Map<String, Object> querySummary = new HashMap<>();
            querySummary.put("sourceState", query.path("sourceState").asText());
            querySummary.put("provider", query.path("provider").asText());
            querySummary.put("dataset", query.path("dataset").asText());
            querySummary.put("vesselCount", query.path("vesselCount").asInt(0));
            querySummary.put("elapsedMs", query.path("elapsedMs").asInt(0));
            querySummary.put("warnings", serializeStringList(query.path("warnings")));
            ent.setAisQuery(querySummary);
            ent.setSourceState(query.path("sourceState").asText(aisSource));
            ent.setDataset(query.path("dataset").asText("controlled-ais-v1"));
            attributionRepository.save(ent);

            broadcaster.broadcast(simulationId, SimulationEvent.aisSearchCompleted(
                    simulationId, attributionRunId, aisSource,
                    query.path("vesselCount").asInt(0), querySummary));

            // Stage 2 — filter + reconstruct into attribution candidates.
            Map<String, Object> filterBody = new HashMap<>();
            filterBody.put("origin", anchor.origin);
            filterBody.put("timeRange", anchor.timeRange);
            filterBody.put("radiusKm", radiusKm);
            filterBody.put("maxGapMin", maxGapMin);
            filterBody.put("tracks", tracks);

            ResponseEntity<JsonNode> filterResp = scienceMetrics == null
                    ? postJson(aisFilterPath, filterBody)
                    : scienceMetrics.time("ais-filter", () -> postJson(aisFilterPath, filterBody));
            JsonNode filter = requirePayload(filterResp, "AIS filter");
            JsonNode candidates = filter.path("candidates");

            Map<String, Object> filterSummary = new HashMap<>();
            filterSummary.put("kept", filter.path("kept").asInt(0));
            filterSummary.put("dropped", filter.path("dropped").asInt(0));
            filterSummary.put("stats", serializeNode(filter.path("stats")));
            filterSummary.put("droppedVessels", serializeNode(filter.path("droppedVessels")));
            ent.setFilter(filterSummary);
            attributionRepository.save(ent);

            broadcaster.broadcast(simulationId, SimulationEvent.vesselsFiltered(
                    simulationId, filter.path("kept").asInt(0),
                    filter.path("dropped").asInt(0), filterSummary));

            // Stage 3 — frozen five-factor scoring.
            broadcaster.broadcast(simulationId,
                    SimulationEvent.attributionStarted(simulationId, attributionRunId));

            Map<String, Object> scoreBody = new HashMap<>();
            scoreBody.put("candidates", candidates);
            scoreBody.put("origin", anchor.origin);
            scoreBody.put("searchRadiusKm", radiusKm);
            if (anchor.releaseTime != null) {
                scoreBody.put("releaseTime", releaseIso);
            }
            if (anchor.backtrackEvidence != null) {
                scoreBody.put("backtracking", anchor.backtrackEvidence);
            }
            if (request.getCurrents() != null || request.getWind() != null) {
                Map<String, Object> env = new HashMap<>();
                env.put("uCurrent", request.getCurrents() == null ? 0.0 : request.getCurrents().getU());
                env.put("vCurrent", request.getCurrents() == null ? 0.0 : request.getCurrents().getV());
                env.put("uWind", request.getWind() == null ? 0.0 : request.getWind().getU());
                env.put("vWind", request.getWind() == null ? 0.0 : request.getWind().getV());
                scoreBody.put("environment", env);
            }

            ResponseEntity<JsonNode> scoreResp = scienceMetrics == null
                    ? postJson(aisScorePath, scoreBody)
                    : scienceMetrics.time("ais-score", () -> postJson(aisScorePath, scoreBody));
            JsonNode score = requirePayload(scoreResp, "vessel scoring");

            ent.setConclusion(score.path("conclusion").asText("inconclusive"));
            ent.setRanking(serializeNode(score.path("ranking")));
            // Store plain maps/lists, NOT raw Jackson nodes: Spring Data cannot
            // reconstruct ArrayNode/ObjectNode when loading persisted runs.
            ent.setRankedVessels(serializeNode(score.path("rankedVessels")));
            ent.setScoreWarnings(serializeStringList(score.path("warnings")));
            ent.setWeightsUsed(convertWeights(score.path("weightsUsed")));
            ent.setStatus("completed");
            attributionRepository.save(ent);

            broadcaster.broadcast(simulationId, SimulationEvent.vesselScoresReady(
                    simulationId, attributionRunId, score.path("rankedVessels"),
                    serializeNode(score.path("weightsUsed"))));

            Map<String, Object> result = responseFrom(ent, score);
            broadcaster.broadcast(simulationId, SimulationEvent.attributionCompleted(
                    simulationId, attributionRunId, ent.getConclusion(), result));

            return result;

        } catch (Exception e) {
            ent.setStatus("failed");
            ent.setErrors(new ArrayList<>(List.of("Attribution failed: " + e.getMessage())));
            attributionRepository.save(ent);

            broadcaster.broadcast(simulationId,
                    SimulationEvent.aisSearchFailed(simulationId, attributionRunId,
                            "attribution failed: " + e.getMessage()));

            Map<String, Object> err = new HashMap<>();
            err.put("error", "Attribution failed: " + e.getMessage());
            err.put("attributionRunId", attributionRunId);
            err.put("status", "failed");
            return err;
        }
    }

    /** List persisted attribution runs for a simulation (replay). */
    public List<Map<String, Object>> listRuns(String simulationId) {
        return attributionRepository.findBySimulationId(simulationId).stream()
                .map(this::entityToResponse)
                .toList();
    }

    /** Fetch a single persisted attribution run by id. */
    public Map<String, Object> getRun(String attributionRunId) {
        Optional<AttributionRun> run = attributionRepository.findById(attributionRunId);
        if (run.isEmpty()) {
            throw new AttributionNotFound(attributionRunId);
        }
        return entityToResponse(run.get());
    }

    /**
     * Honest provider availability report. Proxies the scientific service;
     * when it is unreachable the backend falls back to a fixed CONTROLLED-only
     * report that never claims REAL feeds exist.
     */
    public Map<String, Object> listProviders() {
        try {
            ResponseEntity<JsonNode> resp = scienceMetrics == null
                    ? pythonWebClient.get()
                            .uri(aisAvailabilityPath)
                            .retrieve()
                            .toEntity(JsonNode.class)
                            .block(Duration.ofSeconds(aisTimeoutSeconds))
                    : scienceMetrics.time("ais-availability", () -> pythonWebClient.get()
                            .uri(aisAvailabilityPath)
                            .retrieve()
                            .toEntity(JsonNode.class)
                            .block(Duration.ofSeconds(aisTimeoutSeconds)));
            if (resp != null && resp.getBody() != null) {
                return MAPPER.convertValue(resp.getBody(), Map.class);
            }
        } catch (Exception e) {
            // fall through to the honest fallback
        }
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("pythonReachable", false);
        Map<String, Object> ais = new HashMap<>();
        Map<String, Object> controlled = new HashMap<>();
        controlled.put("state", "CONTROLLED");
        controlled.put("note", "deterministic simulated fleet; never presented as real AIS");
        ais.put("controlled", controlled);
        for (String name : new String[]{"gfw", "marine_cadastre", "aisstream"}) {
            Map<String, Object> p = new HashMap<>();
            p.put("state", "UNAVAILABLE");
            p.put("note", "python scientific service unreachable");
            ais.put(name, p);
        }
        fallback.put("ais", ais);
        return fallback;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private ResponseEntity<JsonNode> postJson(String path, Map<String, Object> body) {
        return pythonWebClient.post()
                .uri(path)
                .bodyValue(body)
                .retrieve()
                .toEntity(JsonNode.class)
                .block(Duration.ofSeconds(aisTimeoutSeconds));
    }

    private JsonNode requirePayload(ResponseEntity<JsonNode> result, String stage) {
        JsonNode payload = result == null ? null : result.getBody();
        if (payload == null || !payload.has("status")) {
            throw new IllegalStateException(
                    "scientific service returned unexpected " + stage + " payload: " +
                            (payload == null ? "null" : payload));
        }
        return payload;
    }

    /** Resolve the run's anchor geometry (origin, time range, release time)
     *  from the pinned/latest backtracking result, falling back to the most
     *  recent spill event or the simulation centre. */
    private Anchor resolveAnchor(Simulation sim, String requestedBacktrackRunId) {
        Anchor a = new Anchor();

        a.backtrackRunId = requestedBacktrackRunId;
        BacktrackingResult bt = null;
        if (requestedBacktrackRunId != null && !requestedBacktrackRunId.isBlank()) {
            Optional<BacktrackingResult> found = backtrackingRepository.findById(requestedBacktrackRunId);
            if (found.isEmpty()) {
                throw new BacktrackAnchorNotFound(requestedBacktrackRunId);
            }
            bt = found.get();
        } else {
            List<BacktrackingResult> runs = backtrackingRepository.findBySimulationId(sim.getSimulationId());
            if (!runs.isEmpty()) {
                bt = runs.get(runs.size() - 1);
                a.backtrackRunId = bt.getBacktrackRunId();
            }
        }

        if (bt != null) {
            a.origin = safeExtractOrigin(bt.getOriginEstimate());
            a.origin = a.origin != null ? a.origin : simFallbackOrigin(sim);
            a.timeRange = bt.getOriginTimeRange();
            a.releaseTime = extractPreferred(bt.getOriginTimeRange());
            a.backtrackEvidence = buildBacktrackEvidence(bt, a.origin);
        } else {
            a.origin = simFallbackOrigin(sim);
            SpillEvent lastSpill = lastSpill(sim.getSimulationId());
            a.releaseTime = lastSpill != null ? lastSpill.getTime() : sim.getClock();
        }

        if (a.releaseTime == null) {
            a.releaseTime = sim.getClock();
        }
        if (a.releaseTime == null) {
            throw new AnchorNotResolved(sim.getSimulationId());
        }
        // AIS reconstruction window: 48h before .. 24h after the release.
        a.aisWindowStart = a.releaseTime.minusSeconds(48 * 3600);
        a.aisWindowEnd = a.releaseTime.plusSeconds(24 * 3600);
        // Without a backtracking run there is no persisted origin_time_range; derive
        // the filter window from the same reconstruction window used by the AIS query
        // so the scientific service's required timeRange is always present.
        if (a.timeRange == null) {
            Map<String, Object> window = new HashMap<>();
            window.put("earliest", ISO_Z.format(a.aisWindowStart));
            window.put("latest", ISO_Z.format(a.aisWindowEnd));
            a.timeRange = window;
        }
        return a;
    }

    private Map<String, Object> simFallbackOrigin(Simulation sim) {
        Map<String, Object> origin = new HashMap<>();
        if (sim.getRegion() != null) {
            origin.put("lat", sim.getRegion().centreLat());
            origin.put("lon", sim.getRegion().centreLon());
        } else {
            origin.put("lat", 0.0);
            origin.put("lon", 0.0);
        }
        return origin;
    }

    private SpillEvent lastSpill(String simulationId) {
        List<SpillEvent> spills = spillEventRepository.findBySimulationId(simulationId);
        return spills.isEmpty() ? null : spills.get(spills.size() - 1);
    }

    private Map<String, Object> safeExtractOrigin(Object originEstimate) {
        if (originEstimate instanceof Map<?, ?> m && m.containsKey("lat") && m.containsKey("lon")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> origin = new HashMap<>((Map<String, Object>) m);
            return origin;
        }
        return null;
    }

    private Instant extractPreferred(Object timeRange) {
        if (timeRange instanceof Map<?, ?> m && m.get("preferred") instanceof String iso) {
            try {
                return Instant.parse(iso);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    /** Shape the backtracking evidence block for the scorer: original fan
     *  trajectory endpoints (stored at Step 09) + origin + uncertainty. */
    private Map<String, Object> buildBacktrackEvidence(BacktrackingResult bt, Map<String, Object> origin) {
        if (bt.getTrajectories() == null || bt.getTrajectories().isEmpty()) {
            return null;
        }
        Map<String, Object> evidence = new HashMap<>();
        evidence.put("origin", origin);
        evidence.put("timeRange", bt.getOriginTimeRange());
        evidence.put("uncertaintyKm", bt.getUncertaintyKm());
        evidence.put("trajectories", bt.getTrajectories());
        return evidence;
    }

    private Map<String, Double> convertWeights(JsonNode node) {
        Map<String, Double> out = new HashMap<>();
        if (node != null && node.isObject()) {
            node.fields().forEachRemaining(f ->
                    out.put(f.getKey(), f.getValue().asDouble()));
        }
        return out;
    }

    private Object serializeNode(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return MAPPER.convertValue(node, Object.class);
    }

    private List<String> serializeStringList(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode n : node) {
                out.add(n.asText());
            }
        }
        return out;
    }

    /** Response for the live POST; mix of locally-computed run metadata and
     *  the scientific service's authoritative payload. */
    private Map<String, Object> responseFrom(AttributionRun ent, JsonNode score) {
        Map<String, Object> out = new HashMap<>();
        out.put("attributionRunId", ent.getAttributionRunId());
        out.put("simulationId", ent.getSimulationId());
        out.put("backtrackRunId", ent.getBacktrackRunId());
        out.put("status", ent.getStatus());
        out.put("aisSource", ent.getAisSource());
        out.put("sourceState", score.path("sourceState").asText(ent.getSourceState()));
        out.put("attributionModelVersion", score.path("attributionModelVersion").asText(ent.getModelVersion()));
        out.put("weightsUsed", serializeNode(score.path("weightsUsed")));
        out.put("conclusion", score.path("conclusion").asText("inconclusive"));
        out.put("ranking", serializeNode(score.path("ranking")));
        out.put("rankedVessels", score.path("rankedVessels"));
        out.put("warnings", serializeStringList(score.path("warnings")));
        out.put("origin", ent.getOrigin());
        out.put("timeRange", ent.getTimeRange());
        out.put("releaseTime", ent.getReleaseTime() == null ? null : ISO_Z.format(ent.getReleaseTime()));
        out.put("radiusKm", ent.getRadiusKm());
        out.put("maxGapMin", ent.getMaxGapMin());
        out.put("seed", ent.getSeed());
        out.put("aisQuery", ent.getAisQuery());
        out.put("filter", ent.getFilter());
        out.put("createdAt", ent.getCreatedAt() == null ? null : ISO_Z.format(ent.getCreatedAt()));
        return out;
    }

    /** Shape a persisted entity into the same response shape as the live POST
     *  so GET /runs and GET /runs/{id} are drop-in replays. */
    private Map<String, Object> entityToResponse(AttributionRun e) {
        Map<String, Object> out = new HashMap<>();
        out.put("attributionRunId", e.getAttributionRunId());
        out.put("simulationId", e.getSimulationId());
        out.put("backtrackRunId", e.getBacktrackRunId());
        out.put("status", e.getStatus());
        out.put("aisSource", e.getAisSource());
        out.put("sourceState", e.getSourceState());
        out.put("attributionModelVersion", e.getModelVersion());
        out.put("weightsUsed", e.getWeightsUsed());
        out.put("conclusion", e.getConclusion());
        out.put("ranking", e.getRanking());
        out.put("rankedVessels", e.getRankedVessels());
        out.put("scoreWarnings", e.getScoreWarnings() == null ? List.of() : e.getScoreWarnings());
        out.put("origin", e.getOrigin());
        out.put("timeRange", e.getTimeRange());
        out.put("releaseTime", e.getReleaseTime() == null ? null : ISO_Z.format(e.getReleaseTime()));
        out.put("radiusKm", e.getRadiusKm());
        out.put("maxGapMin", e.getMaxGapMin());
        out.put("seed", e.getSeed());
        out.put("environmentSource", e.getEnvironmentSource());
        out.put("aisQuery", e.getAisQuery());
        out.put("filter", e.getFilter());
        out.put("modelVersion", e.getModelVersion());
        out.put("warnings", e.getWarnings() == null ? List.of() : e.getWarnings());
        out.put("errors", e.getErrors() == null ? List.of() : e.getErrors());
        out.put("createdAt", e.getCreatedAt() == null ? null : ISO_Z.format(e.getCreatedAt()));
        return out;
    }

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new SimulationNotFound(simulationId);
        }
        return sim.get();
    }

    private static class Anchor {
        Map<String, Object> origin;
        Object timeRange;
        Instant releaseTime;
        Instant aisWindowStart;
        Instant aisWindowEnd;
        String backtrackRunId;
        Map<String, Object> backtrackEvidence;
    }

    public static class SimulationNotFound extends RuntimeException {
        public SimulationNotFound(String id) {
            super("simulation not found: " + id);
        }
    }

    public static class AttributionNotFound extends RuntimeException {
        public AttributionNotFound(String id) {
            super("attribution run not found: " + id);
        }
    }

    /** Attribution anchor could not be resolved: no spill event, backtracking
     *  run, or simulation clock is available for the simulation. */
    public static class AnchorNotResolved extends RuntimeException {
        public AnchorNotResolved(String simulationId) {
            super("cannot resolve attribution anchor for simulation " + simulationId
                    + ": no spill event, backtracking run, or simulation clock available");
        }
    }

    /** The pinned backtracking run no longer exists. */
    public static class BacktrackAnchorNotFound extends RuntimeException {
        public BacktrackAnchorNotFound(String backtrackRunId) {
            super("backtrack run not found: " + backtrackRunId);
        }
    }
}