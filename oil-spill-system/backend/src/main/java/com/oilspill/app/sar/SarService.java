package com.oilspill.app.sar;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.config.ScienceMetrics;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates a SAR oil-spill observation (Step 07):
 *
 *   1. load the simulation (sanity guard);
 *   2. broadcast sar_observation.started;
 *   3. call the FastAPI scientific service POST /api/sar/detect (§15 tool
 *      registry `detect_slick` / `characterize_slick`);
 *   4. persist lightweight sar_observation metadata (§14-style; NO raw
 *      raster stored, provenance preserved exactly);
 *   5. broadcast sar_observation.completed with a map-friendly result
 *      (candidates + scene footprint) for the Investigation view;
 *   6. return the scientific result to the frontend.
 *
 * Provenance is never invented: the sourceState returned by Python
 * (REAL_SENTINEL1 / CACHED_SENTINEL1 / LOCAL_FIXTURE / SYNTHETIC /
 * UNAVAILABLE) is propagated verbatim so a fixture/synthetic scene is never
 * labelled as real Sentinel-1.
 */
@Service
public class SarService {

    private final SimulationRepository simulationRepository;
    private final SarObservationRepository sarObservationRepository;
    private final WebClient pythonWebClient;
    private final SimulationEventBroadcaster broadcaster;
    private final ObjectMapper objectMapper;

    /** Optional (null in unit tests): Micrometer timing for the python call. */
    private ScienceMetrics scienceMetrics;

    @Autowired(required = false)
    public void setScienceMetrics(ScienceMetrics scienceMetrics) {
        this.scienceMetrics = scienceMetrics;
    }

    @Value("${python.sar-detect.path:/api/sar/detect}")
    private String sarDetectPath;

    @Value("${python.sar-detect.timeout-seconds:120}")
    private int sarTimeoutSeconds;

    void setSarDetectPathForTest(String path) {
        this.sarDetectPath = path;
    }

    void setSarTimeoutSecondsForTest(int seconds) {
        this.sarTimeoutSeconds = seconds;
    }

    public SarService(SimulationRepository simulationRepository,
                      SarObservationRepository sarObservationRepository,
                      WebClient pythonWebClient,
                      SimulationEventBroadcaster broadcaster,
                      ObjectMapper objectMapper) {
        this.simulationRepository = simulationRepository;
        this.sarObservationRepository = sarObservationRepository;
        this.pythonWebClient = pythonWebClient;
        this.broadcaster = broadcaster;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> runSarDetect(String simulationId, SarDetectRequest request) {
        requireSimulation(simulationId);

        String source = request.getSource() == null || request.getSource().isBlank()
                ? "LOCAL_FIXTURE" : request.getSource();
        String detector = request.getDetector() == null || request.getDetector().isBlank()
                ? "CLASSICAL" : request.getDetector();
        int maxCandidates = (request.getMaxCandidates() == null || request.getMaxCandidates() <= 0)
                ? 6 : request.getMaxCandidates();

        String observationId = "sar-" + UUID.randomUUID().toString().substring(0, 12);
        broadcaster.broadcast(simulationId,
                SimulationEvent.sarObservationStarted(simulationId, observationId));

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("source", source);
            body.put("detector", detector);
            body.put("max_candidates", maxCandidates);

            ResponseEntity<JsonNode> result = scienceMetrics == null
                    ? callPython(body)
                    : scienceMetrics.time("sar-detect", () -> callPython(body));

            JsonNode payload = result == null ? null : result.getBody();
            if (payload == null || !payload.has("observation_id")) {
                throw new IllegalStateException(
                        "scientific service returned an unexpected sar payload: "
                                + (payload == null ? "null" : payload));
            }

            String sciObservationId = payload.path("observation_id").asText();
            String status = payload.path("status").asText("completed");

            SarObservation ent = persist(simulationId, observationId, sciObservationId, payload, status);
            ent.setStatus("completed");
            sarObservationRepository.save(ent);

            Map<String, Object> resultMap = responseFrom(payload, observationId);
            broadcaster.broadcast(simulationId,
                    SimulationEvent.sarObservationCompleted(simulationId, observationId, resultMap));
            return resultMap;
        } catch (Exception e) {
            SarObservation failed = new SarObservation();
            failed.setObservationId(observationId);
            failed.setSimulationId(simulationId);
            failed.setStatus("failed");
            failed.setSourceState(source);
            failed.setSource(source);
            failed.setDetector(detector);
            List<String> errors = new ArrayList<>();
            errors.add("scientific service unavailable: " + e.getMessage());
            failed.setErrors(errors);
            failed.setCreatedAt(Instant.now());
            sarObservationRepository.save(failed);

            broadcaster.broadcast(simulationId,
                    SimulationEvent.sarObservationFailed(simulationId, observationId,
                            "scientific service unavailable: " + e.getMessage()));

            Map<String, Object> err = new HashMap<>();
            err.put("error", "SAR observation failed: " + e.getMessage());
            err.put("observationId", observationId);
            err.put("status", "failed");
            return err;
        }
    }

    /**
     * Return persisted SAR observations for a simulation (newest last).
     * Used by the Investigation UI to replay what was observed.
     */
    @Transactional(readOnly = true)
    public List<SarObservation> listObservations(String simulationId) {
        requireSimulation(simulationId);
        return sarObservationRepository.findBySimulationId(simulationId);
    }

    private ResponseEntity<JsonNode> callPython(Map<String, Object> body) {
        return pythonWebClient.post()
                .uri(sarDetectPath)
                .bodyValue(body)
                .retrieve()
                .toEntity(JsonNode.class)
                .block(Duration.ofSeconds(sarTimeoutSeconds));
    }

    private SarObservation persist(String simulationId, String observationId,
                                   String scientificObservationId, JsonNode payload, String status) {
        SarObservation ent = new SarObservation();
        ent.setObservationId(observationId);
        ent.setSimulationId(simulationId);
        ent.setScientificObservationId(scientificObservationId);
        ent.setStatus(status);
        ent.setSourceState(payload.path("source_state").asText("UNAVAILABLE"));
        ent.setSource(payload.path("source").asText(""));
        ent.setProviderDataset(payload.path("provider_dataset").asText(""));
        ent.setSceneId(payload.path("scene_id").asText(""));
        ent.setAcquisitionTime(payload.path("acquisition_time").asText(null));
        ent.setSatellites(textArray(payload.path("satellites")));
        ent.setPolarization(payload.path("polarization").asText("VV"));
        ent.setDetector(payload.path("detector").asText(""));
        ent.setDetectorVersion(payload.path("detector_version").asText(""));
        ent.setSceneFootprint(payload.path("scene_footprint").isMissingNode()
                ? null : toPlain(payload.path("scene_footprint")));
        ent.setCandidates(buildCandidates(payload.path("candidates")));
        ent.setConfidence(payload.path("confidence").isNull()
                ? null : payload.path("confidence").asDouble());
        ent.setSlickAreaKm2(payload.path("slick_area_km2").isNull()
                ? null : payload.path("slick_area_km2").asDouble());
        ent.setAgeAvailable(payload.path("age_available").asBoolean(false));
        ent.setAgeEstimate(payload.path("age_estimate").asText(null));
        ent.setWarnings(textArray(payload.path("warnings")));
        ent.setErrors(textArray(payload.path("errors")));
        ent.setCreatedAt(Instant.now());
        return ent;
    }

    private List<Map<String, Object>> buildCandidates(JsonNode arr) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) {
            return out;
        }
        for (JsonNode c : arr) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("candidate_id", c.path("candidate_id").asText());
            dto.put("classification", c.path("classification").asText());
            dto.put("confidence", c.path("confidence").asDouble());
            dto.put("centroid", toPlain(c.path("centroid")));
            dto.put("polygon", toPlain(c.path("polygon")));
            dto.put("bbox", toPlain(c.path("bbox")));
            dto.put("area_km2", c.path("area_km2").asDouble());
            dto.put("perimeter_km", c.path("perimeter_km").asDouble());
            dto.put("length_km", c.path("length_km").asDouble());
            dto.put("width_km", c.path("width_km").asDouble());
            dto.put("aspect_ratio", c.path("aspect_ratio").asDouble());
            dto.put("orientation_deg", c.path("orientation_deg").asDouble());
            dto.put("shape_factor", c.path("shape_factor").asDouble());
            dto.put("pixel_area", c.path("pixel_area").asInt());
            dto.put("contrast_db", c.path("contrast_db").isNull()
                    ? null : c.path("contrast_db").asDouble());
            dto.put("incidence_deg", c.path("incidence_deg").isNull()
                    ? null : c.path("incidence_deg").asDouble());
            dto.put("look_alike_hints", toPlain(c.path("look_alike_hints")));
            dto.put("warnings", toPlain(c.path("warnings")));
            out.add(dto);
        }
        return out;
    }

    /** Convert a JsonNode into a plain Java object (Map/List/String/number)
     * so Spring Data Mongo can reconstruct the document without a Jackson
     * concrete-type (ObjectNode) that has no no-arg constructor. */
    private Object toPlain(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        return objectMapper.convertValue(node, Object.class);
    }

    private List<String> textArray(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(n -> out.add(n.asText()));
        }
        return out;
    }

    private Map<String, Object> responseFrom(JsonNode payload, String observationId) {
        Map<String, Object> out = new HashMap<>();
        out.put("observationId", observationId);
        out.put("scientificObservationId", payload.path("observation_id").asText());
        out.put("status", payload.path("status").asText());
        out.put("source_state", payload.path("source_state").asText());
        out.put("source", payload.path("source").asText());
        out.put("provider_dataset", payload.path("provider_dataset").asText());
        out.put("acquisition_time", payload.path("acquisition_time").asText(null));
        out.put("satellites", payload.path("satellites"));
        out.put("polarization", payload.path("polarization").asText());
        out.put("scene_id", payload.path("scene_id").asText());
        out.put("scene_footprint", payload.path("scene_footprint"));
        out.put("detector", payload.path("detector").asText());
        out.put("detector_version", payload.path("detector_version").asText());
        out.put("candidates", payload.path("candidates"));
        out.put("confidence", payload.path("confidence"));
        out.put("slick_area_km2", payload.path("slick_area_km2"));
        out.put("age_available", payload.path("age_available").asBoolean(false));
        out.put("age_estimate", payload.path("age_estimate").asText(null));
        out.put("warnings", payload.path("warnings"));
        out.put("errors", payload.path("errors"));
        return out;
    }

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new SimulationNotFound(simulationId);
        }
        return sim.get();
    }

    public static class SimulationNotFound extends RuntimeException {
        public SimulationNotFound(String simulationId) {
            super("simulation not found: " + simulationId);
        }
    }
}
