package com.oilspill.app.forwarddrift;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ForwardDriftServiceTest {

    private SimulationRepository simulationRepository;
    private SpillEventRepository spillEventRepository;
    private ForwardDriftRepository forwardDriftRepository;
    private WebClient pythonWebClient;
    private SimulationEventBroadcaster broadcaster;
    private ForwardDriftService service;

    private final ObjectMapper om = new ObjectMapper();

    private Simulation sim;
    private SpillEvent spill;

    @BeforeEach
    void setUp() {
        simulationRepository = mock(SimulationRepository.class);
        spillEventRepository = mock(SpillEventRepository.class);
        forwardDriftRepository = mock(ForwardDriftRepository.class);
        pythonWebClient = mock(WebClient.class);
        broadcaster = mock(SimulationEventBroadcaster.class);

        service = new ForwardDriftService(simulationRepository, spillEventRepository,
                forwardDriftRepository, pythonWebClient, broadcaster);
        // Use defaults (no @Value injection in unit tests).
        service.setForwardDriftPathForTest("/api/forward-drift");
        service.setForwardDriftTimeoutSecondsForTest(120);

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setClock(Instant.parse("2026-09-02T12:00:00Z"));

        spill = new SpillEvent();
        spill.setSpillEventId("spill1");
        spill.setSimulationId("sim1");
        spill.setVesselId("v1");
        spill.setLocation(new GeoPoint(75.14, 7.64));
        spill.setTime(Instant.parse("2026-09-02T12:00:00Z"));
        spill.setOilType("GENERIC CRUDE");
        spill.setQuantityKg(5000);

        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(spillEventRepository.findBySimulationId("sim1")).thenReturn(List.of(spill));
        when(forwardDriftRepository.save(any(ForwardDriftResult.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private WebClient.RequestBodySpec mockScientificSuccess() throws Exception {
        String body = "{\"particles\":[{\"lon\":75.14,\"lat\":7.64,\"z\":0.0,\"mass_kg\":1.3}],"
                + "\"extent\":{\"type\":\"Polygon\",\"coordinates\":[[[75.14,7.64],[75.15,7.64],[75.15,7.65],[75.14,7.64]]]},"
                + "\"massBalance\":{\"evaporated_kg\":20.0,\"dispersed_kg\":0.0,\"remaining_kg\":80.0},"
                + "\"driftRun\":{\"run_id\":\"dr-abc\",\"timestep_seconds\":900,\"duration_hours\":6.0,"
                + "\"environment_source\":\"CONTROLLED\",\"environment_dataset\":\"CONTROLLED TEST FIELD\","
                + "\"model_version\":\"opendrift-1.14.11/openoil\",\"reproducibility_digest\":\"d123\"}}";
        JsonNode node = om.readTree(body);
        ResponseEntity<JsonNode> entity = ResponseEntity.ok(node);

        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec requestSpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(pythonWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(requestSpec);
        when(requestSpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toEntity(JsonNode.class)).thenReturn(Mono.just(entity));

        return requestSpec;
    }

    @Test
    void runForwardDriftPersistsAndBroadcastsCompleted() throws Exception {
        mockScientificSuccess();

        Map<String, Object> out = service.runForwardDrift("sim1", new ForwardDriftRequest());

        // Success responses carry the scientific result + the persisted run id.
        assertNotNull(out.get("driftRunId"));
        assertTrue(out.get("particles") != null, "expected particles on success");
        assertNull(out.get("error"), "successful run should carry no error field");

        // persisted drift_run record
        ArgumentCaptor<ForwardDriftResult> captor = ArgumentCaptor.forClass(ForwardDriftResult.class);
        verify(forwardDriftRepository).save(captor.capture());
        ForwardDriftResult saved = captor.getValue();
        assertEquals("sim1", saved.getSimulationId());
        assertEquals("spill1", saved.getSpillEventId());
        assertEquals("GENERIC CRUDE", saved.getOilType());
        assertEquals("completed", saved.getStatus());
        assertEquals("CONTROLLED", saved.getEnvironmentSource());

        // WS: started, oil_particles, completed
        verify(broadcaster, atLeast(1)).broadcast(anyString(), any(SimulationEvent.class));
    }

    @Test
    void forwardDriftSendsOilParticlesEvent() throws Exception {
        mockScientificSuccess();

        service.runForwardDrift("sim1", new ForwardDriftRequest());

        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(anyString(), event.capture());
        boolean sawOilParticles = event.getAllValues().stream()
                .anyMatch(e -> "oil_particles".equals(e.getType()));
        assertTrue(sawOilParticles, "expected an oil_particles WS event");
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

        Map<String, Object> out = service.runForwardDrift("sim1", new ForwardDriftRequest());

        assertEquals("failed", out.get("status"));
        verify(broadcaster).broadcast(eq("sim1"), argThat(
                e -> "forward_drift.failed".equals(e.getType())));
    }

    @Test
    void rejectsMissingSimulation() {
        when(simulationRepository.findById("nope")).thenReturn(Optional.empty());
        assertThrows(ForwardDriftService.SimulationNotFound.class,
                () -> service.runForwardDrift("nope", new ForwardDriftRequest()));
    }

    @Test
    void rejectsNoSpillYet() {
        when(spillEventRepository.findBySimulationId("sim1")).thenReturn(List.of());
        assertThrows(ForwardDriftService.NoSpillYet.class,
                () -> service.runForwardDrift("sim1", new ForwardDriftRequest()));
    }

    @Test
    void requestOverridesDefaultOilType() throws Exception {
        mockScientificSuccess();
        ForwardDriftRequest req = new ForwardDriftRequest();
        req.setOilType("GENERIC DIESEL");
        req.setDurationHours(3.0);
        req.setParticleCount(1000);

        Map<String, Object> out = service.runForwardDrift("sim1", req);

        assertNotNull(out.get("driftRunId"));
        assertNull(out.get("error"));
    }
}