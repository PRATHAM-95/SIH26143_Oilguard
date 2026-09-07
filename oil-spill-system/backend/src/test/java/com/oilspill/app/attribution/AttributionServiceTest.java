package com.oilspill.app.attribution;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.backtrack.BacktrackingResult;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AttributionServiceTest {

    private SimulationRepository simulationRepository;
    private SpillEventRepository spillEventRepository;
    private BacktrackingRepository backtrackingRepository;
    private AttributionRepository attributionRepository;
    private WebClient pythonWebClient;
    private SimulationEventBroadcaster broadcaster;
    private AttributionService service;
    private WebClient.RequestBodySpec requestSpec;

    private final ObjectMapper om = new ObjectMapper();

    private Simulation sim;
    private BacktrackingResult bt;

    @BeforeEach
    void setUp() {
        simulationRepository = mock(SimulationRepository.class);
        spillEventRepository = mock(SpillEventRepository.class);
        backtrackingRepository = mock(BacktrackingRepository.class);
        attributionRepository = mock(AttributionRepository.class);
        pythonWebClient = mock(WebClient.class);
        broadcaster = mock(SimulationEventBroadcaster.class);

        service = new AttributionService(simulationRepository, spillEventRepository,
                backtrackingRepository, attributionRepository, pythonWebClient, broadcaster);
        service.setAisPathsForTest("/api/ais/query", "/api/ais/filter", "/api/score-vessels", "/api/ais/availability");
        service.setAisTimeoutSecondsForTest(120);

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setClock(Instant.parse("2026-08-04T18:00:00Z"));
        sim.setRegion(new Region(20, 10, 80, 70));

        // Step 09 backtracking result pinning the anchor geometry.
        bt = new BacktrackingResult();
        bt.setBacktrackRunId("bt-run1");
        bt.setSimulationId("sim1");
        bt.setStatus("completed");
        bt.setOriginEstimate(Map.of("lat", 15.0, "lon", 72.4));
        bt.setOriginTimeRange(Map.of(
                "earliest", "2026-08-04T06:00:00Z",
                "latest", "2026-08-04T18:00:00Z",
                "preferred", "2026-08-04T12:00:00Z"));
        bt.setUncertaintyKm(1.8);
        bt.setTrajectories(List.of(Map.of(
                "member", 0,
                "endpoints", List.of(Map.of("lon", 72.4, "lat", 15.0), Map.of("lon", 72.45, "lat", 15.02)))));

        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(backtrackingRepository.findBySimulationId("sim1")).thenReturn(List.of(bt));
        when(attributionRepository.save(any(AttributionRun.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    /** Mock the 3 WebClient calls (query, filter, score) with queued responses.
     *  When ``recording`` is provided, each outgoing request body is appended. */
    private void mockScientificPipeline(String queryJson, String filterJson, String scoreJson,
                                        List<Object> recording) throws Exception {
        JsonNode queryNode = om.readTree(queryJson);
        JsonNode filterNode = om.readTree(filterJson);
        JsonNode scoreNode = om.readTree(scoreJson);

        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        requestSpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(pythonWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(requestSpec);
        if (recording != null) {
            when(requestSpec.bodyValue(any())).thenAnswer(inv -> {
                recording.add(inv.getArgument(0));
                return headersSpec;
            });
        } else {
            when(requestSpec.bodyValue(any())).thenReturn(headersSpec);
        }
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toEntity(JsonNode.class))
                .thenReturn(Mono.just(ResponseEntity.ok(queryNode)))
                .thenReturn(Mono.just(ResponseEntity.ok(filterNode)))
                .thenReturn(Mono.just(ResponseEntity.ok(scoreNode)));
    }

    private AttrRequestHelper defaultRequest() {
        AttrRequestHelper h = new AttrRequestHelper();
        return h;
    }

    @Test
    void runAttributionPersistsStartedThenCompletedAndBroadcastsAllEvents() throws Exception {
        mockScientificPipeline(QUERY_JSON, FILTER_JSON, SCORE_JSON, null);

        List<String> saveStatuses = new ArrayList<>();
        when(attributionRepository.save(any(AttributionRun.class))).thenAnswer(inv -> {
            saveStatuses.add(((AttributionRun) inv.getArgument(0)).getStatus());
            return inv.getArgument(0);
        });

        AttributionRequest req = defaultRequest().request();

        Map<String, Object> out = service.runAttribution("sim1", req);

        assertEquals("completed", out.get("status"));
        assertEquals("candidate", out.get("conclusion"));
        assertNotNull(out.get("rankedVessels"));
        assertNull(out.get("error"));
        assertEquals("bt-run1", out.get("backtrackRunId"));

        assertEquals("started", saveStatuses.get(0), "run must be persisted as 'started' first");
        assertEquals("completed", saveStatuses.get(saveStatuses.size() - 1));

        ArgumentCaptor<AttributionRun> captor = ArgumentCaptor.forClass(AttributionRun.class);
        verify(attributionRepository, atLeast(2)).save(captor.capture());
        AttributionRun completed = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertEquals("CONTROLLED", completed.getAisSource());
        assertEquals("ais-scoring-v1", completed.getModelVersion());
        assertEquals("candidate", completed.getConclusion());
        assertNotNull(completed.getAisQuery());
        Map<?, ?> querySummary = (Map<?, ?>) completed.getAisQuery();
        assertEquals(6, querySummary.get("vesselCount"));
        assertEquals("CONTROLLED", completed.getSourceState());
        assertNotNull(completed.getFilter());
        Map<?, ?> filterSummary = (Map<?, ?>) completed.getFilter();
        assertEquals(1, filterSummary.get("kept"));
        assertNotNull(completed.getRankedVessels());
        assertEquals(Instant.parse("2026-08-04T12:00:00Z"), completed.getReleaseTime());

        // Full event lifecycle in order.
        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("sim1"), event.capture());
        List<String> types = event.getAllValues().stream().map(SimulationEvent::getType).toList();
        assertEquals(6, types.size());
        assertEquals(List.of(
                "ais_search.started",
                "ais_search.completed",
                "vessels_filtered",
                "attribution.started",
                "vessel_scores_ready",
                "attribution.completed"), types);
    }

    @Test
    void passesAnchorAndBacktrackingEvidenceToScientificRequests() throws Exception {
        List<Object> bodies = new ArrayList<>();
        mockScientificPipeline(QUERY_JSON, FILTER_JSON, SCORE_JSON, bodies);

        service.runAttribution("sim1", defaultRequest().request());

        // query body: anchor origin + window = release -48h .. +24h
        @SuppressWarnings("unchecked")
        Map<String, Object> query = (Map<String, Object>) bodies.get(0);
        Map<?, ?> origin = (Map<?, ?>) query.get("origin");
        assertEquals(72.4, origin.get("lon"));
        assertEquals(15.0, origin.get("lat"));
        assertEquals("2026-08-02T12:00:00Z", query.get("timeStart"));
        assertEquals("2026-08-05T12:00:00Z", query.get("timeEnd"));
        assertEquals("CONTROLLED", query.get("source"));

        // score body: candidates + backtracking fan + release time
        @SuppressWarnings("unchecked")
        Map<String, Object> score = (Map<String, Object>) bodies.get(2);
        assertNotNull(score.get("candidates"));
        assertEquals("2026-08-04T12:00:00Z", score.get("releaseTime"));
        Map<?, ?> backtracking = (Map<?, ?>) score.get("backtracking");
        assertNotNull(backtracking, "backtracking evidence must be forwarded from the Step 09 run");
        assertEquals(1.8, backtracking.get("uncertaintyKm"));
    }

    @Test
    void passesEnvironmentForcingWhenClientSuppliesIt() throws Exception {
        List<Object> bodies = new ArrayList<>();
        mockScientificPipeline(QUERY_JSON, FILTER_JSON, SCORE_JSON, bodies);

        AttributionRequest req = defaultRequest().request();
        AttributionRequest.Forcing currents = new AttributionRequest.Forcing();
        currents.setU(0.35);
        currents.setV(-0.12);
        req.setCurrents(currents);

        service.runAttribution("sim1", req);

        @SuppressWarnings("unchecked")
        Map<String, Object> score = (Map<String, Object>) bodies.get(2);
        Map<?, ?> env = (Map<?, ?>) score.get("environment");
        assertNotNull(env);
        assertEquals(0.35, env.get("uCurrent"));
    }

    @Test
    void failsGracefullyWhenAisQueryFails() {
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

        Map<String, Object> out = service.runAttribution("sim1", defaultRequest().request());

        assertEquals("failed", out.get("status"));
        assertNotNull(out.get("error"));
        verify(broadcaster).broadcast(eq("sim1"), argThat(
                e -> "ais_search.failed".equals(e.getType())));
    }

    @Test
    void rejectsMissingSimulation() {
        when(simulationRepository.findById("nope")).thenReturn(Optional.empty());
        AttributionRequest req = defaultRequest().request();
        req.setSimulationId("nope");
        assertThrows(AttributionService.SimulationNotFound.class,
                () -> service.runAttribution("nope", req));
    }

    @Test
    void rejectsUnknownPinnedBacktrackRun() {
        when(backtrackingRepository.findById("bt-missing")).thenReturn(Optional.empty());
        AttributionRequest req = defaultRequest().request();
        req.setBacktrackRunId("bt-missing");
        assertThrows(IllegalStateException.class,
                () -> service.runAttribution("sim1", req));
    }

    @Test
    void listRunsShapesEntitiesLikePostResponse() {
        AttributionRun r = new AttributionRun();
        r.setAttributionRunId("att-1");
        r.setSimulationId("sim1");
        r.setStatus("completed");
        r.setAisSource("CONTROLLED");
        r.setSourceState("CONTROLLED");
        r.setModelVersion("ais-scoring-v1");
        r.setConclusion("inconclusive");
        r.setRankedVessels(List.of());
        r.setOrigin(Map.of("lat", 15.0, "lon", 72.4));
        when(attributionRepository.findBySimulationId("sim1")).thenReturn(List.of(r));

        List<Map<String, Object>> runs = service.listRuns("sim1");
        assertEquals(1, runs.size());
        Map<String, Object> first = runs.get(0);
        assertEquals("att-1", first.get("attributionRunId"));
        assertEquals("inconclusive", first.get("conclusion"));
        assertEquals(List.of(), first.get("scoreWarnings"));
        assertEquals(List.of(), first.get("warnings"));
        verify(attributionRepository).findBySimulationId("sim1");
    }

    @Test
    void getRunReturnsShapedEntityOrThrows() {
        AttributionRun r = new AttributionRun();
        r.setAttributionRunId("att-2");
        r.setSimulationId("sim1");
        r.setStatus("failed");
        when(attributionRepository.findById("att-2")).thenReturn(Optional.of(r));
        when(attributionRepository.findById("att-x")).thenReturn(Optional.empty());

        Map<String, Object> got = service.getRun("att-2");
        assertEquals("failed", got.get("status"));
        assertThrows(AttributionService.AttributionNotFound.class, () -> service.getRun("att-x"));
    }

    @Test
    void listProvidersFallsBackHonestlyWhenPythonDown() {
        when(pythonWebClient.get()).thenThrow(new RuntimeException("down"));
        Map<String, Object> report = service.listProviders();
        assertFalse((Boolean) report.get("pythonReachable"));
        Map<?, ?> ais = (Map<?, ?>) report.get("ais");
        assertEquals("UNAVAILABLE", ((Map<?, ?>) ais.get("gfw")).get("state"));
    }

    private static final String QUERY_JSON = "{"
            + "\"status\":\"completed\",\"sourceState\":\"CONTROLLED\","
            + "\"provider\":\"CONTROLLED\",\"dataset\":\"controlled-ais-v1\","
            + "\"vesselCount\":6,\"elapsedMs\":12,\"warnings\":[],"
            + "\"tracks\":[{\"mmsi\":\"419660001\",\"name\":\"MT TEST-01\","
            + "\"vesselType\":\"TANKER\",\"sourceState\":\"CONTROLLED\","
            + "\"provider\":\"CONTROLLED\",\"dataset\":\"controlled-ais-v1\","
            + "\"messages\":[{\"timestamp\":\"2026-08-04T12:00:00Z\","
            + "\"longitude\":72.4,\"latitude\":15.0,\"speedKnots\":10.0,"
            + "\"courseDeg\":60.0,\"headingDeg\":60.0,\"interpolated\":false}]}]}";

    private static final String FILTER_JSON = "{"
            + "\"status\":\"completed\",\"kept\":1,\"dropped\":0,"
            + "\"stats\":{\"mean_gap_min\":5.0},\"droppedVessels\":[],"
            + "\"candidates\":[{\"mmsi\":\"419660001\",\"name\":\"MT TEST-01\","
            + "\"vesselType\":\"TANKER\","
            + "\"track\":{\"mmsi\":\"419660001\",\"name\":\"MT TEST-01\","
            + "\"vesselType\":\"TANKER\",\"sourceState\":\"CONTROLLED\","
            + "\"provider\":\"CONTROLLED\",\"dataset\":\"controlled-ais-v1\","
            + "\"messages\":[{\"timestamp\":\"2026-08-04T12:00:00Z\","
            + "\"longitude\":72.4,\"latitude\":15.0,\"speedKnots\":10.0,"
            + "\"courseDeg\":60.0,\"headingDeg\":60.0,\"interpolated\":false}]},"
            + "\"messagesInWindow\":1,\"medianCadenceMin\":5.0,"
            + "\"interpolationFraction\":0.0,\"coverageGaps\":0,"
            + "\"minDistanceKm\":0.0,\"timeOfClosestApproach\":\"2026-08-04T12:00:00Z\","
            + "\"anomalies\":[],\"reliability\":\"HIGH\",\"reliabilityNotes\":[]}]}";

    private static final String SCORE_JSON = "{"
            + "\"status\":\"completed\",\"conclusion\":\"candidate\","
            + "\"ranking\":{\"margin\":0.3085,\"decisive\":true,\"top_score\":0.7167},"
            + "\"rankedVessels\":[{\"mmsi\":\"419660001\",\"rank\":1,\"score\":0.7167,"
            + "\"conclusion\":\"candidate\"}],"
            + "\"weightsUsed\":{\"spatial\":0.25,\"temporal\":0.2,\"trajectory\":0.25,"
            + "\"anomaly\":0.15,\"environmental\":0.15},"
            + "\"attributionModelVersion\":\"ais-scoring-v1\","
            + "\"sourceState\":\"CONTROLLED\",\"warnings\":[]}";

    /** Small helper so test call-sites read naturally. */
    private static class AttrRequestHelper {
        private final AttributionRequest inner = new AttributionRequest();

        AttributionRequest request() {
            inner.setSimulationId("sim1");
            return inner;
        }
    }
}