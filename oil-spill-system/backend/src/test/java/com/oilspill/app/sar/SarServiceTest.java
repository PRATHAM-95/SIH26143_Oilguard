package com.oilspill.app.sar;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SarServiceTest {

    private SimulationRepository simulationRepository;
    private SarObservationRepository sarObservationRepository;
    private WebClient pythonWebClient;
    private SimulationEventBroadcaster broadcaster;
    private SarService service;

    private final ObjectMapper om = new ObjectMapper();

    private Simulation sim;

    @BeforeEach
    void setUp() {
        simulationRepository = mock(SimulationRepository.class);
        sarObservationRepository = mock(SarObservationRepository.class);
        pythonWebClient = mock(WebClient.class);
        broadcaster = mock(SimulationEventBroadcaster.class);

        service = new SarService(simulationRepository, sarObservationRepository,
                pythonWebClient, broadcaster, om);
        service.setSarDetectPathForTest("/api/sar/detect");
        service.setSarTimeoutSecondsForTest(120);

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setClock(Instant.parse("2026-09-02T12:00:00Z"));

        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(sarObservationRepository.save(any(SarObservation.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private void mockScientificSuccess(String body) throws Exception {
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
    }

    private static final String SUCCESS_BODY =
            "{\"observation_id\":\"obs-abc123\",\"status\":\"completed\","
            + "\"source_state\":\"LOCAL_FIXTURE\",\"source\":\"LOCAL_FIXTURE\","
            + "\"provider_dataset\":\"synthetic fixture (demo, not real Sentinel-1)\","
            + "\"scene_id\":\"fixture-synth-26143\",\"detector\":\"classical_dark_spot\","
            + "\"detector_version\":\"1.0.0\",\"polarization\":\"VV\",\"satellites\":[],"
            + "\"scene_footprint\":{\"type\":\"Polygon\",\"coordinates\":[[[72.0,15.0],[72.3,15.0],[72.3,14.7],[72.0,14.7],[72.0,15.0]]]},"
            + "\"candidates\":[{\"candidate_id\":\"c1\",\"classification\":\"OIL_CANDIDATE\","
            + "\"confidence\":0.78,\"centroid\":{\"lon\":72.1,\"lat\":14.8},"
            + "\"polygon\":[[72.0,14.8],[72.05,14.8],[72.05,14.82],[72.0,14.8]],"
            + "\"bbox\":{\"north\":14.82,\"south\":14.8,\"east\":72.05,\"west\":72.0},"
            + "\"area_km2\":64.28,\"perimeter_km\":20.0,\"length_km\":12.0,\"width_km\":3.0,"
            + "\"aspect_ratio\":3.8,\"orientation_deg\":32.0,\"shape_factor\":0.16,"
            + "\"pixel_area\":5406,\"look_alike_hints\":[],\"warnings\":[]}],"
            + "\"confidence\":0.78,\"slick_area_km2\":64.28,"
            + "\"age_available\":false,\"age_estimate\":null,"
            + "\"warnings\":[\"spill age not estimated\"],\"errors\":[]}";

    @Test
    void runSarDetectPersistsAndBroadcastsCompleted() throws Exception {
        mockScientificSuccess(SUCCESS_BODY);

        Map<String, Object> out = service.runSarDetect("sim1", new SarDetectRequest());

        assertNotNull(out.get("observationId"));
        assertEquals("completed", out.get("status"));
        // Provenance is propagated verbatim — a fixture is never relabelled real.
        assertEquals("LOCAL_FIXTURE", out.get("source_state"));
        assertEquals(Boolean.FALSE, out.get("age_available"));
        assertNull(out.get("error"), "successful run should carry no error field");

        ArgumentCaptor<SarObservation> captor = ArgumentCaptor.forClass(SarObservation.class);
        verify(sarObservationRepository, atLeast(1)).save(captor.capture());
        SarObservation saved = captor.getValue();
        assertEquals("sim1", saved.getSimulationId());
        assertEquals("completed", saved.getStatus());
        assertEquals("LOCAL_FIXTURE", saved.getSourceState());
        assertEquals("obs-abc123", saved.getScientificObservationId());
        assertFalse(saved.isAgeAvailable());

        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster, atLeast(2)).broadcast(anyString(), event.capture());
        boolean sawStarted = event.getAllValues().stream()
                .anyMatch(e -> "sar_observation.started".equals(e.getType()));
        boolean sawCompleted = event.getAllValues().stream()
                .anyMatch(e -> "sar_observation.completed".equals(e.getType()));
        assertTrue(sawStarted, "expected a sar_observation.started WS event");
        assertTrue(sawCompleted, "expected a sar_observation.completed WS event");
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

        Map<String, Object> out = service.runSarDetect("sim1", new SarDetectRequest());

        assertEquals("failed", out.get("status"));
        assertNotNull(out.get("error"));
        verify(broadcaster).broadcast(eq("sim1"), argThat(
                e -> "sar_observation.failed".equals(e.getType())));
    }

    @Test
    void rejectsMissingSimulation() {
        when(simulationRepository.findById("nope")).thenReturn(Optional.empty());
        assertThrows(SarService.SimulationNotFound.class,
                () -> service.runSarDetect("nope", new SarDetectRequest()));
        assertThrows(SarService.SimulationNotFound.class,
                () -> service.listObservations("nope"));
    }

    @Test
    void listObservationsReturnsPersistedRecords() {
        SarObservation o = new SarObservation();
        o.setObservationId("sar1");
        o.setSimulationId("sim1");
        when(sarObservationRepository.findBySimulationId("sim1")).thenReturn(List.of(o));

        List<SarObservation> got = service.listObservations("sim1");

        assertEquals(1, got.size());
        assertEquals("sar1", got.get(0).getObservationId());
    }
}
