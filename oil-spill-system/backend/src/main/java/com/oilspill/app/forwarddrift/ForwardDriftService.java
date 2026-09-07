package com.oilspill.app.forwarddrift;

import com.fasterxml.jackson.databind.JsonNode;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
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
 * Orchestrates forward oil-drift (task §13):
 *
 *    1. load the simulation + active spill event (origin, time, oil type);
 *    2. broadcast forward_drift.started;
 *    3. call the FastAPI scientific service POST /api/forward-drift (§15.2);
 *    4. persist lightweight drift_run metadata (§14);
 *    5. broadcast oil_particles (§15.3 map view) + forward_drift.completed;
 *    6. return the scientific result to the frontend.
 *
 * No OpenOil code lives here — the Python service owns the numerical model.
 * If the Python service is unavailable the run is recorded as failed and the
 * failure is broadcast, so the UI can reflect the real state.
 */
@Service
public class ForwardDriftService {

    private static final DateTimeFormatter ISO_Z =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private final SimulationRepository simulationRepository;
    private final SpillEventRepository spillEventRepository;
    private final ForwardDriftRepository forwardDriftRepository;
    private final WebClient pythonWebClient;
    private final SimulationEventBroadcaster broadcaster;

    @Value("${python.forward-drift.path:/api/forward-drift}")
    private String forwardDriftPath;

    @Value("${python.forward-drift.timeout-seconds:120}")
    private int forwardDriftTimeoutSeconds;

    /** Package-private test hooks (bypass @Value for pure-unit tests). */
    void setForwardDriftPathForTest(String path) {
        this.forwardDriftPath = path;
    }

    void setForwardDriftTimeoutSecondsForTest(int seconds) {
        this.forwardDriftTimeoutSeconds = seconds;
    }

    public ForwardDriftService(SimulationRepository simulationRepository,
                               SpillEventRepository spillEventRepository,
                               ForwardDriftRepository forwardDriftRepository,
                               WebClient pythonWebClient,
                               SimulationEventBroadcaster broadcaster) {
        this.simulationRepository = simulationRepository;
        this.spillEventRepository = spillEventRepository;
        this.forwardDriftRepository = forwardDriftRepository;
        this.pythonWebClient = pythonWebClient;
        this.broadcaster = broadcaster;
    }

    /**
     * Run a forward-drift for a simulation's active spill.
     *
     * @return a map shaped for the frontend with the scientific result plus
     *         the persisted driftRunId (never leaks ground truth).
     */
    @Transactional
    public Map<String, Object> runForwardDrift(String simulationId, ForwardDriftRequest request) {
        Simulation sim = requireSimulation(simulationId);
        SpillEvent spill = requireActiveSpill(simulationId);

        double lat = spill.getLocation().lat();
        double lon = spill.getLocation().lon();
        Instant spillTime = spill.getTime();
        String oilType = request.getOilType() == null || request.getOilType().isBlank()
                ? spill.getOilType()
                : request.getOilType();
        double durationHours = request.getDurationHours() == null ? 6.0 : request.getDurationHours();
        int particleCount = (request.getParticleCount() == null || request.getParticleCount() <= 0)
                ? 500 : request.getParticleCount();
        String environmentSource = request.getEnvironmentSource() == null
                || request.getEnvironmentSource().isBlank()
                ? "CONTROLLED" : request.getEnvironmentSource();

        broadcaster.broadcast(simulationId, SimulationEvent.forwardDriftStarted(simulationId));

        String driftRunId = "drift-" + UUID.randomUUID().toString().substring(0, 12);
        try {
            Map<String, Object> body = new HashMap<>();
            Map<String, Object> origin = new HashMap<>();
            origin.put("lat", lat);
            origin.put("lon", lon);
            body.put("origin", origin);
            body.put("time", ISO_Z.format(spillTime));
            body.put("duration_hours", durationHours);
            body.put("currents", forcingOrEmpty(request.getCurrents()));
            body.put("wind", forcingOrEmpty(request.getWind()));
            body.put("oilType", oilType);
            body.put("particleCount", particleCount);
            body.put("environmentSource", environmentSource);

            ResponseEntity<JsonNode> result = pythonWebClient.post()
                    .uri(forwardDriftPath)
                    .bodyValue(body)
                    .retrieve()
                    .toEntity(JsonNode.class)
                    .block(Duration.ofSeconds(forwardDriftTimeoutSeconds));

            JsonNode payload = result == null ? null : result.getBody();
            if (payload == null || !payload.has("particles")) {
                throw new IllegalStateException(
                        "scientific service returned an unexpected payload: " + (payload == null ? "null" : payload));
            }

            ForwardDriftResult ent = persistRun(simulationId, spill.getSpillEventId(), driftRunId,
                    payload, oilType, particleCount, durationHours);
            ent.setStatus("completed");
            forwardDriftRepository.save(ent);

            // §15.3 map-view particle event.
            broadcaster.broadcast(simulationId,
                    SimulationEvent.oilParticles(simulationId, buildRenderedParticles(payload)));
            broadcaster.broadcast(simulationId,
                    SimulationEvent.forwardDriftCompleted(simulationId, driftRunId));

            return responseFrom(payload, driftRunId);
        } catch (Exception e) {
            ForwardDriftResult failed = new ForwardDriftResult();
            failed.setDriftRunId(driftRunId);
            failed.setSimulationId(simulationId);
            failed.setSpillEventId(spill.getSpillEventId());
            failed.setStatus("failed");
            failed.setOilType(oilType);
            failed.setDurationHours(durationHours);
            failed.setParticleCount(particleCount);
            failed.setCreatedAt(Instant.now());
            failed.setEnvironmentSource("CONTROLLED");
            failed.setModelVersion("opendrift-1.14.11/openoil");
            forwardDriftRepository.save(failed);

            broadcaster.broadcast(simulationId,
                    SimulationEvent.forwardDriftFailed(simulationId,
                            "scientific service unavailable: " + e.getMessage()));

            Map<String, Object> err = new HashMap<>();
            err.put("error", "Forward drift failed: " + e.getMessage());
            err.put("driftRunId", driftRunId);
            err.put("status", "failed");
            return err;
        }
    }

    private ForwardDriftResult persistRun(String simulationId, String spillEventId, String driftRunId,
                                          JsonNode payload, String oilType, int particleCount,
                                          double durationHours) {
        ForwardDriftResult ent = new ForwardDriftResult();
        ent.setDriftRunId(driftRunId);
        ent.setSimulationId(simulationId);
        ent.setSpillEventId(spillEventId);
        ent.setScientificRunId(payload.path("driftRun").path("run_id").asText());
        ent.setStatus("completed");
        ent.setOilType(oilType);
        ent.setParticleCount(particleCount);
        ent.setTimestepSeconds(payload.path("driftRun").path("timestep_seconds").asInt(900));
        ent.setDurationHours(payload.path("driftRun").path("duration_hours").asDouble(durationHours));
        ent.setEnvironmentSource(payload.path("driftRun").path("environment_source").asText("CONTROLLED"));
        ent.setEnvironmentDataset(payload.path("driftRun").path("environment_dataset").asText("CONTROLLED TEST FIELD"));
        ent.setModelVersion(payload.path("driftRun").path("model_version").asText("opendrift-1.14.11/openoil"));
        ent.setReproducibilityDigest(payload.path("driftRun").path("reproducibility_digest").asText());
        ent.setRenderedParticles(buildRenderedParticles(payload));
        ent.setExtent(serializeNode(payload.path("extent")));
        ent.setMassBalance(serializeNodeToMap(payload.path("massBalance")));
        ent.setStartTime(Instant.now());
        ent.setCreatedAt(Instant.now());
        return ent;
    }

    /** Down-sample the full particle cloud to a map-friendly snippet. */
    private List<Map<String, Object>> buildRenderedParticles(JsonNode payload) {
        JsonNode particles = payload.path("particles");
        int total = particles.size();
        int max = 800;
        int stride = total <= max ? 1 : (int) Math.ceil((double) total / max);
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < total; i += stride) {
            JsonNode p = particles.get(i);
            Map<String, Object> dto = new HashMap<>();
            dto.put("lat", round(p.path("lat").asDouble(), 6));
            dto.put("lon", round(p.path("lon").asDouble(), 6));
            double mass = p.path("mass_kg").asDouble();
            dto.put("radius", 2 + Math.min(6.0, mass / 200.0));
            dto.put("opacity", 0.35 + Math.min(0.55, mass / 800.0));
            out.add(dto);
        }
        return out;
    }

    /** Serialize a GeoJSON node to its canonical string for Mongo storage. */
    private Object serializeNode(JsonNode node) {
        return node.isMissingNode() ? null : node.toString();
    }

    /** Extract a flat Map<String,String> from a JSON object node. */
    private Map<String, Object> serializeNodeToMap(JsonNode node) {
        Map<String, Object> map = new HashMap<>();
        if (!node.isMissingNode() && node.isObject()) {
            node.fieldNames().forEachRemaining(f -> map.put(f, node.get(f).asText()));
        }
        return map;
    }

    private Map<String, Object> forcingOrEmpty(ForwardDriftRequest.Forcing f) {
        Map<String, Object> m = new HashMap<>();
        m.put("u", f == null ? 0.0 : f.getU());
        m.put("v", f == null ? 0.0 : f.getV());
        return m;
    }

    private Map<String, Object> responseFrom(JsonNode payload, String driftRunId) {
        Map<String, Object> out = new HashMap<>();
        out.put("driftRunId", driftRunId);
        out.put("particles", payload.path("particles"));
        out.put("extent", payload.path("extent"));
        out.put("massBalance", payload.path("massBalance"));
        out.put("driftRun", payload.path("driftRun"));
        return out;
    }

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new SimulationNotFound(simulationId);
        }
        return sim.get();
    }

    private SpillEvent requireActiveSpill(String simulationId) {
        List<SpillEvent> spills = spillEventRepository.findBySimulationId(simulationId);
        if (spills.isEmpty()) {
            throw new NoSpillYet(simulationId);
        }
        // Forward drift uses the most recent application-level spill.
        return spills.get(spills.size() - 1);
    }

    private static double round(double v, int places) {
        return BigDecimal.valueOf(v).setScale(places, RoundingMode.HALF_UP).doubleValue();
    }

    /** Reuse the existing simulation "not found" semantics for status mapping. */
    public static class SimulationNotFound extends RuntimeException {
        public SimulationNotFound(String simulationId) {
            super("simulation not found: " + simulationId);
        }
    }

    public static class NoSpillYet extends RuntimeException {
        public NoSpillYet(String simulationId) {
            super("no spill event for simulation " + simulationId + "; release a spill first");
        }
    }
}