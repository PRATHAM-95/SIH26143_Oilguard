package com.oilspill.app.backtrack;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.websocket.SimulationEvent;
import com.oilspill.app.websocket.SimulationEventBroadcaster;
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
 * Orchestrates ensemble backward trajectory (backtracking):
 *
 *   1. load simulation + SAR observation or spill event (origin, time);
 *   2. broadcast backtracking.started;
 *   3. call FastAPI POST /api/backtrack;
 *   4. persist lightweight backtrack_run metadata;
 *   5. broadcast origin_estimated + backtracking.completed;
 *   6. return the result to the frontend.
 */
@Service
public class BacktrackingService {

    private static final DateTimeFormatter ISO_Z =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SimulationRepository simulationRepository;
    private final SpillEventRepository spillEventRepository;
    private final BacktrackingRepository backtrackingRepository;
    private final WebClient pythonWebClient;
    private final SimulationEventBroadcaster broadcaster;

    @Value("${python.backtrack.path:/api/backtrack}")
    private String backtrackPath;

    @Value("${python.backtrack.timeout-seconds:180}")
    private int backtrackTimeoutSeconds;

    void setBacktrackPathForTest(String path) {
        this.backtrackPath = path;
    }

    void setBacktrackTimeoutSecondsForTest(int seconds) {
        this.backtrackTimeoutSeconds = seconds;
    }

    public BacktrackingService(SimulationRepository simulationRepository,
                               SpillEventRepository spillEventRepository,
                               BacktrackingRepository backtrackingRepository,
                               WebClient pythonWebClient,
                               SimulationEventBroadcaster broadcaster) {
        this.simulationRepository = simulationRepository;
        this.spillEventRepository = spillEventRepository;
        this.backtrackingRepository = backtrackingRepository;
        this.pythonWebClient = pythonWebClient;
        this.broadcaster = broadcaster;
    }

    /**
     * Run backtracking for a simulation. Uses the most recent spill event
     * as the observation source, or a direct lat/lon/time if provided.
     */
    @Transactional
    public Map<String, Object> runBacktrack(String simulationId, BacktrackingRequest request) {
        Simulation sim = requireSimulation(simulationId);

        double lat, lon;
        Instant observationTime;

        // Use the most recent spill event as the observation source.
        List<SpillEvent> spills = spillEventRepository.findBySimulationId(simulationId);
        if (!spills.isEmpty()) {
            SpillEvent spill = spills.get(spills.size() - 1);
            lat = spill.getLocation().lat();
            lon = spill.getLocation().lon();
            observationTime = spill.getTime();
        } else {
            // Fallback: use simulation region center and clock.
            lat = sim.getRegion().centreLat();
            lon = sim.getRegion().centreLon();
            observationTime = sim.getClock();
        }

        double durationHours = request.getDurationHours() == null ? 6.0 : request.getDurationHours();
        int ensembleSize = request.getEnsembleSize() == null ? 20 : request.getEnsembleSize();
        int particlesPerMember = request.getParticlesPerMember() == null ? 200 : request.getParticlesPerMember();
        String environmentSource = request.getEnvironmentSource() == null || request.getEnvironmentSource().isBlank()
                ? "CONTROLLED" : request.getEnvironmentSource();
        Long seed = request.getSeed() != null ? request.getSeed().longValue() : null;
        String sarObservationId = request.getSarObservationId();

        String backtrackRunId = "bt-" + UUID.randomUUID().toString().substring(0, 12);

        // Persist the run as 'started' BEFORE the (potentially long) scientific
        // call, so a non-terminal lifecycle state is always recorded even if the
        // process dies mid-run.
        Instant startedAt = Instant.now();
        BacktrackingResult ent = new BacktrackingResult();
        ent.setBacktrackRunId(backtrackRunId);
        ent.setSimulationId(simulationId);
        ent.setSarObservationId(sarObservationId);
        ent.setStatus("started");
        ent.setEnsembleSize(ensembleSize);
        ent.setParticlesPerMember(particlesPerMember);
        ent.setDurationHours(durationHours);
        ent.setEnvironmentSource(environmentSource);
        ent.setSeed(seed);
        ent.setModelVersion("opendrift-1.14.11/openoil-backtrack");
        ent.setStartTime(startedAt);
        ent.setCreatedAt(startedAt);
        backtrackingRepository.save(ent);

        broadcaster.broadcast(simulationId, SimulationEvent.backtrackingStarted(simulationId, backtrackRunId));

        try {
            // Build the FastAPI request body.
            Map<String, Object> body = new HashMap<>();
            Map<String, Object> origin = new HashMap<>();
            origin.put("lat", lat);
            origin.put("lon", lon);
            body.put("origin", origin);
            body.put("time", ISO_Z.format(observationTime));
            body.put("duration_hours", durationHours);
            body.put("ensemble_size", ensembleSize);
            body.put("particles_per_member", particlesPerMember);
            body.put("environmentSource", environmentSource);
            body.put("simulation_id", simulationId);
            if (seed != null) {
                body.put("seed", seed);
            }
            body.put("currents", forcingOrEmpty(request.getCurrents()));
            body.put("wind", forcingOrEmpty(request.getWind()));

            ResponseEntity<JsonNode> result = pythonWebClient.post()
                    .uri(backtrackPath)
                    .bodyValue(body)
                    .retrieve()
                    .toEntity(JsonNode.class)
                    .block(Duration.ofSeconds(backtrackTimeoutSeconds));

            JsonNode payload = result == null ? null : result.getBody();
            if (payload == null || !payload.has("status")) {
                throw new IllegalStateException(
                        "scientific service returned unexpected backtracking payload: " +
                        (payload == null ? "null" : payload));
            }

            populateFromPayload(ent, payload);
            ent.setStatus("completed");
            backtrackingRepository.save(ent);

            // Broadcast origin_estimated event for the frontend.
            Object originEstimate = serializeNode(payload.path("origin_estimate"));
            double uncertainty = payload.path("uncertainty_km").asDouble(0.0);
            double confidence = payload.path("confidence").path("trajectory_agreement").asDouble(0.0);

            broadcaster.broadcast(simulationId,
                    SimulationEvent.originEstimated(simulationId, originEstimate, uncertainty, confidence));
            broadcaster.broadcast(simulationId,
                    SimulationEvent.backtrackingCompleted(simulationId, backtrackRunId));

            return responseFrom(payload, backtrackRunId,
                    durationHours, ensembleSize, particlesPerMember, environmentSource);

        } catch (Exception e) {
            ent.setStatus("failed");
            ent.setWarnings(List.of("Backtracking failed: " + e.getMessage()));
            backtrackingRepository.save(ent);

            broadcaster.broadcast(simulationId,
                    SimulationEvent.backtrackingFailed(simulationId,
                            "backtracking failed: " + e.getMessage()));

            Map<String, Object> err = new HashMap<>();
            err.put("error", "Backtracking failed: " + e.getMessage());
            err.put("backtrackRunId", backtrackRunId);
            err.put("status", "failed");
            return err;
        }
    }

    /** List persisted backtracking runs for a simulation (replay), shaped like
     *  the POST /backtrack response so the frontend can restore a result. */
    public List<Map<String, Object>> listBacktrackRuns(String simulationId) {
        return backtrackingRepository.findBySimulationId(simulationId).stream()
                .map(this::entityToResponse)
                .toList();
    }

    private BacktrackingResult populateFromPayload(BacktrackingResult ent, JsonNode payload) {
        ent.setScientificRunId(payload.path("run_id").asText());
        ent.setSourceRegion(serializeNode(payload.path("source_region")));
        ent.setSourceContours(serializeNode(payload.path("source_contours")));
        ent.setOriginEstimate(serializeNode(payload.path("origin_estimate")));
        ent.setOriginTimeRange(serializeNode(payload.path("origin_time_range")));
        ent.setUncertaintyKm(payload.path("uncertainty_km").asDouble(0.0));
        ent.setConfidence(serializeNode(payload.path("confidence")));
        ent.setEnsembleSummary(serializeNode(payload.path("ensemble_summary")));
        ent.setQuality(serializeNode(payload.path("quality")));
        ent.setTrajectories(buildRenderedTrajectories(payload));
        ent.setProbabilityGrid(serializeNode(payload.path("source_probability_grid")));
        if (!payload.path("backtrackRun").path("environment_source").isMissingNode()) {
            ent.setEnvironmentSource(payload.path("backtrackRun").path("environment_source").asText(ent.getEnvironmentSource()));
        }
        if (!payload.path("backtrackRun").path("model_version").isMissingNode()) {
            ent.setModelVersion(payload.path("backtrackRun").path("model_version").asText(ent.getModelVersion()));
        }
        ent.setWarnings(serializeStringList(payload.path("warnings")));
        ent.setErrors(serializeStringList(payload.path("errors")));
        return ent;
    }

    /** Extract lightweight trajectory endpoints for map rendering. */
    private List<Map<String, Object>> buildRenderedTrajectories(JsonNode payload) {
        JsonNode trajectories = payload.path("trajectories");
        List<Map<String, Object>> out = new ArrayList<>();
        if (trajectories.isArray()) {
            for (JsonNode t : trajectories) {
                Map<String, Object> dto = new HashMap<>();
                dto.put("member", t.path("member").asInt());
                dto.put("wind_drift_factor", t.path("wind_drift_factor").asDouble());
                JsonNode endpoints = t.path("endpoints");
                List<Map<String, Object>> epList = new ArrayList<>();
                if (endpoints.isArray()) {
                    int stride = endpoints.size() <= 50 ? 1 : (int) Math.ceil((double) endpoints.size() / 50);
                    for (int i = 0; i < endpoints.size(); i += stride) {
                        JsonNode ep = endpoints.get(i);
                        Map<String, Object> epDto = new HashMap<>();
                        epDto.put("lon", round(ep.path("lon").asDouble(), 6));
                        epDto.put("lat", round(ep.path("lat").asDouble(), 6));
                        epList.add(epDto);
                    }
                }
                dto.put("endpoints", epList);
                out.add(dto);
            }
        }
        return out;
    }

    /** Materialise a FastAPI JSON subtree as a nested object (Map/List/scalar)
     *  so both the API response and Mongo persistence retain structured JSON
     *  instead of a JSON-string. Returns null for missing/null nodes. */
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

    private Map<String, Object> forcingOrEmpty(BacktrackingRequest.Forcing f) {
        Map<String, Object> m = new HashMap<>();
        m.put("u", f == null ? 0.0 : f.getU());
        m.put("v", f == null ? 0.0 : f.getV());
        return m;
    }

    private Map<String, Object> responseFrom(JsonNode payload, String backtrackRunId,
                                             double durationHours, int ensembleSize,
                                             int particlesPerMember, String environmentSource) {
        Map<String, Object> out = new HashMap<>();
        out.put("backtrackRunId", backtrackRunId);
        out.put("run_id", payload.path("run_id").asText());
        out.put("status", payload.path("status").asText());
        out.put("duration_hours", durationHours);
        out.put("ensemble_size", ensembleSize);
        out.put("particles_per_member", particlesPerMember);
        // Report the source the scientific service actually used (authoritative),
        // falling back to the requested value when the payload omits it.
        String reportedEnv = payload.path("backtrackRun").path("environment_source").asText(null);
        out.put("environment_source",
                (reportedEnv == null || reportedEnv.isBlank()) ? environmentSource : reportedEnv);
        out.put("source_region", serializeNode(payload.path("source_region")));
        out.put("source_contours", serializeNode(payload.path("source_contours")));
        out.put("origin_estimate", serializeNode(payload.path("origin_estimate")));
        out.put("origin_time_range", serializeNode(payload.path("origin_time_range")));
        out.put("uncertainty_km", payload.path("uncertainty_km").asDouble(0.0));
        out.put("confidence", serializeNode(payload.path("confidence")));
        out.put("trajectories", payload.path("trajectories"));
        out.put("ensemble_summary", serializeNode(payload.path("ensemble_summary")));
        out.put("quality", serializeNode(payload.path("quality")));
        out.put("warnings", serializeStringList(payload.path("warnings")));
        return out;
    }

    /** Shape a persisted entity into the same snake_case response as the POST
     *  endpoint so ``GET /{id}/backtrack/runs`` is a drop-in replay. */
    private Map<String, Object> entityToResponse(BacktrackingResult e) {
        Map<String, Object> out = new HashMap<>();
        out.put("backtrackRunId", e.getBacktrackRunId());
        out.put("sarObservationId", e.getSarObservationId());
        out.put("run_id", e.getScientificRunId());
        out.put("status", e.getStatus());
        out.put("duration_hours", e.getDurationHours());
        out.put("ensemble_size", e.getEnsembleSize());
        out.put("particles_per_member", e.getParticlesPerMember());
        out.put("environment_source", e.getEnvironmentSource());
        out.put("source_region", e.getSourceRegion());
        out.put("source_contours", e.getSourceContours());
        out.put("origin_estimate", e.getOriginEstimate());
        out.put("origin_time_range", e.getOriginTimeRange());
        out.put("uncertainty_km", e.getUncertaintyKm());
        out.put("confidence", e.getConfidence());
        out.put("trajectories", e.getTrajectories());
        out.put("ensemble_summary", e.getEnsembleSummary());
        out.put("quality", e.getQuality());
        out.put("probability_grid", e.getProbabilityGrid());
        out.put("model_version", e.getModelVersion());
        out.put("seed", e.getSeed());
        out.put("warnings", e.getWarnings() == null ? List.of() : e.getWarnings());
        return out;
    }

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new SimulationNotFound(simulationId);
        }
        return sim.get();
    }

    private static double round(double v, int places) {
        return Math.round(v * Math.pow(10, places)) / Math.pow(10, places);
    }

    public static class SimulationNotFound extends RuntimeException {
        public SimulationNotFound(String id) {
            super("simulation not found: " + id);
        }
    }
}
