package com.oilspill.app.backtrack;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.simulation.Region;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.vessel.GeoPoint;
import com.oilspill.app.websocket.SimulationEvent;
import com.oilspill.app.websocket.SimulationEventBroadcaster;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class BacktrackingServiceTest {

    private SimulationRepository simulationRepository;
    private SpillEventRepository spillEventRepository;
    private BacktrackingRepository backtrackingRepository;
    private WebClient pythonWebClient;
    private SimulationEventBroadcaster broadcaster;
    private BacktrackingService service;
    private WebClient.RequestBodySpec requestSpec;

    private final ObjectMapper om = new ObjectMapper();

    private Simulation sim;
    private SpillEvent spill;

    @BeforeEach
    void setUp() {
        simulationRepository = mock(SimulationRepository.class);
        spillEventRepository = mock(SpillEventRepository.class);
        backtrackingRepository = mock(BacktrackingRepository.class);
        pythonWebClient = mock(WebClient.class);
        broadcaster = mock(SimulationEventBroadcaster.class);

        service = new BacktrackingService(simulationRepository, spillEventRepository,
                backtrackingRepository, pythonWebClient, broadcaster);
        service.setBacktrackPathForTest("/api/backtrack");
        service.setBacktrackTimeoutSecondsForTest(120);

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setClock(Instant.parse("2026-09-02T12:00:00Z"));
        sim.setRegion(new Region(25, -10, 100, 50));

        spill = new SpillEvent();
        spill.setSpillEventId("spill1");
        spill.setSimulationId("sim1");
        spill.setVesselId("v1");
        spill.setLocation(new GeoPoint(72.28, 19.08));
        spill.setTime(Instant.parse("2026-09-02T12:00:00Z"));

        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(spillEventRepository.findBySimulationId("sim1")).thenReturn(List.of(spill));
        when(backtrackingRepository.save(any(BacktrackingResult.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private void mockScientificSuccess() throws Exception {
        String body = "{"
                + "\"run_id\":\"bt-abc123\","
                + "\"status\":\"completed\","
                + "\"origin_estimate\":{\"lon\":71.9,\"lat\":18.6},"
                + "\"uncertainty_km\":1.8,"
                + "\"confidence\":{\"source_concentration\":\"HIGH\","
                + "   \"environmental_quality\":\"CONTROLLED\","
                + "   \"trajectory_agreement\":0.92,\"ensemble_stability\":0.8},"
                + "\"source_region\":{\"type\":\"Polygon\",\"coordinates\":[[[71.9,18.6],[72,18.6],[72,18.7],[71.9,18.6]]]},"
                + "\"origin_time_range\":{\"earliest\":\"2026-09-02T06:00:00Z\","
                + "   \"latest\":\"2026-09-02T12:00:00Z\",\"preferred\":\"2026-09-02T09:00:00Z\"},"
                + "\"trajectories\":[{\"member\":0,\"wind_drift_factor\":0.03,"
                + "   \"endpoints\":[{\"lon\":71.95,\"lat\":18.62},{\"lon\":72.2,\"lat\":18.9}]}],"
                + "\"ensemble_summary\":{\"member_count\":20,\"converged_count\":19,"
                + "   \"mean_endpoint_distance_km\":4.2,\"std_endpoint_distance_km\":1.3},"
                + "\"quality\":{\"total_particles\":4000,\"converged_particles\":3800,"
                + "   \"land_hits\":0,\"domain_exits\":0,\"invalid_particles\":0,\"warnings\":[]},"
                + "\"backtrackRun\":{\"environment_source\":\"CONTROLLED\","
                + "   \"model_version\":\"opendrift-1.14.11/openoil-backtrack\"},"
                + "\"warnings\":[]"
                + "}";
        JsonNode node = om.readTree(body);
        ResponseEntity<JsonNode> entity = ResponseEntity.ok(node);

        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        requestSpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(pythonWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(requestSpec);
        when(requestSpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toEntity(JsonNode.class)).thenReturn(Mono.just(entity));
    }

    @Test
    void runBacktrackPersistsAndBroadcastsCompleted() throws Exception {
        mockScientificSuccess();
        BacktrackingRequest req = new BacktrackingRequest();
        req.setSarObservationId("sar-123");

        // The run must be persisted as 'started' first, then promoted to
        // 'completed' — a non-terminal lifecycle row always exists. The service
        // reuses one entity object, so capture the status at save-time.
        List<String> saveStatuses = new ArrayList<>();
        when(backtrackingRepository.save(any(BacktrackingResult.class))).thenAnswer(inv -> {
            saveStatuses.add(((BacktrackingResult) inv.getArgument(0)).getStatus());
            return inv.getArgument(0);
        });

        Map<String, Object> out = service.runBacktrack("sim1", req);

        assertNotNull(out.get("backtrackRunId"));
        assertEquals("completed", out.get("status"));
        assertNull(out.get("error"), "successful run should carry no error field");
        assertEquals("started", saveStatuses.get(0), "run must be persisted as 'started' first");
        assertEquals("completed", saveStatuses.get(saveStatuses.size() - 1),
                "terminal state must be persisted last");

        ArgumentCaptor<BacktrackingResult> captor = ArgumentCaptor.forClass(BacktrackingResult.class);
        verify(backtrackingRepository, atLeast(2)).save(captor.capture());
        BacktrackingResult completed = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertEquals("sim1", completed.getSimulationId());
        assertEquals("completed", completed.getStatus());
        assertEquals("bt-abc123", completed.getScientificRunId());
        assertEquals("CONTROLLED", completed.getEnvironmentSource());
        assertEquals("sar-123", completed.getSarObservationId());
        assertNotNull(completed.getSourceRegion());
        assertEquals(20, completed.getEnsembleSize());
        assertEquals(200, completed.getParticlesPerMember());
        assertEquals(6.0, completed.getDurationHours());
        assertNotNull(completed.getStartTime(), "startTime must be set when the run starts");
        assertNotNull(completed.getCreatedAt());
        assertNotNull(completed.getModelVersion());

        // Response echoes the parameters used.
        assertEquals(20, out.get("ensemble_size"));
        assertEquals(200, out.get("particles_per_member"));
        assertEquals(6.0, out.get("duration_hours"));
        assertEquals("CONTROLLED", out.get("environment_source"));

        // WS: started + origin_estimated + backtracking.completed
        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("sim1"), event.capture());
        List<String> types = event.getAllValues().stream().map(SimulationEvent::getType).toList();
        assertTrue(types.contains("backtracking.started"));
        assertTrue(types.contains("origin_estimated"));
        assertTrue(types.contains("backtracking.completed"));
    }

    @Test
    void passesConfiguredEnsembleParametersThrough() throws Exception {
        mockScientificSuccess();
        BacktrackingRequest req = new BacktrackingRequest();
        req.setDurationHours(12.0);
        req.setEnsembleSize(8);
        req.setParticlesPerMember(50);
        req.setEnvironmentSource("CMEMS");

        Map<String, Object> out = service.runBacktrack("sim1", req);

        // The configured values must reach the scientific request body.
        ArgumentCaptor<Object> bodyCaptor = ArgumentCaptor.forClass(Object.class);
        verify(requestSpec).bodyValue(bodyCaptor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> sent = (Map<String, Object>) bodyCaptor.getValue();
        assertEquals(12.0, sent.get("duration_hours"));
        assertEquals(8, sent.get("ensemble_size"));
        assertEquals(50, sent.get("particles_per_member"));
        assertEquals("CMEMS", sent.get("environmentSource"));

        // Response echoes the configuration; the environment source reports what
        // the scientific service actually used (payload-authoritative).
        assertEquals(12.0, out.get("duration_hours"));
        assertEquals(8, out.get("ensemble_size"));
        assertEquals(50, out.get("particles_per_member"));
        assertEquals("CONTROLLED", out.get("environment_source"));

        ArgumentCaptor<BacktrackingResult> captor = ArgumentCaptor.forClass(BacktrackingResult.class);
        verify(backtrackingRepository, atLeast(2)).save(captor.capture());
        BacktrackingResult completed = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertEquals(12.0, completed.getDurationHours());
        assertEquals(8, completed.getEnsembleSize());
        assertEquals(50, completed.getParticlesPerMember());
        assertEquals("CONTROLLED", completed.getEnvironmentSource());
    }

    @Test
    void failsGracefullyWhenScientificServiceDown() {
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec requestSpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(pythonWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(requestSpec);
        when(requestSpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toEntity(JsonNode.class))
                .thenThrow(new RuntimeException("connection refused"));

        Map<String, Object> out = service.runBacktrack("sim1", new BacktrackingRequest());

        assertEquals("failed", out.get("status"));
        assertNotNull(out.get("error"));
        verify(broadcaster).broadcast(eq("sim1"), argThat(
                e -> "backtracking.failed".equals(e.getType())));
    }

    @Test
    void rejectsMissingSimulation() {
        when(simulationRepository.findById("nope")).thenReturn(Optional.empty());
        assertThrows(BacktrackingService.SimulationNotFound.class,
                () -> service.runBacktrack("nope", new BacktrackingRequest()));
    }

    @Test
    void fallsBackToRegionCentreWhenNoSpill() throws Exception {
        when(spillEventRepository.findBySimulationId("sim1")).thenReturn(List.of());
        // Capture the body so we can assert the fallback origin = region centre.
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec requestSpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(pythonWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(requestSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toEntity(JsonNode.class)).thenReturn(Mono.just(
                ResponseEntity.ok(om.readTree("{\"status\":\"completed\",\"run_id\":\"bt-r\","
                        + "\"warnings\":[]}"))));
        // Capture requestSpec.bodyValue arg.
        org.mockito.stubbing.Answer<?> capture = inv -> {
            Map<?, ?> sent = inv.getArgument(0);
            Map<?, ?> origin = (Map<?, ?>) sent.get("origin");
            assertEquals(7.5, origin.get("lat"));
            assertEquals(75.0, origin.get("lon"));
            return headersSpec;
        };
        when(requestSpec.bodyValue(any())).thenAnswer(capture);

        Map<String, Object> out = service.runBacktrack("sim1", new BacktrackingRequest());
        assertEquals("completed", out.get("status"));
    }

    @Test
    void listBacktrackRunsShapesEntitiesLikePostResponse() {
        BacktrackingResult r = new BacktrackingResult();
        r.setBacktrackRunId("bt-x");
        r.setSimulationId("sim1");
        r.setScientificRunId("bt-sci");
        r.setStatus("completed");
        r.setDurationHours(6.0);
        r.setEnsembleSize(20);
        when(backtrackingRepository.findBySimulationId("sim1")).thenReturn(List.of(r));

        List<Map<String, Object>> runs = service.listBacktrackRuns("sim1");
        assertEquals(1, runs.size());
        Map<String, Object> first = runs.get(0);
        assertEquals("bt-x", first.get("backtrackRunId"));
        assertEquals("completed", first.get("status"));
        assertEquals("bt-sci", first.get("run_id"));
        assertEquals(6.0, first.get("duration_hours"));
        assertEquals(20, first.get("ensemble_size"));
        assertEquals(List.of(), first.get("warnings"));
        verify(backtrackingRepository).findBySimulationId("sim1");
    }
}
