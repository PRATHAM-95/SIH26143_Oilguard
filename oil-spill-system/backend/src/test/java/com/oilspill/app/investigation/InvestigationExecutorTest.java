package com.oilspill.app.investigation;

import com.mongodb.client.result.UpdateResult;
import com.oilspill.app.attribution.AttributionRepository;
import com.oilspill.app.attribution.AttributionRun;
import com.oilspill.app.attribution.AttributionService;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.backtrack.BacktrackingResult;
import com.oilspill.app.backtrack.BacktrackingService;
import com.oilspill.app.forwarddrift.ForwardDriftRepository;
import com.oilspill.app.forwarddrift.ForwardDriftResult;
import com.oilspill.app.forwarddrift.ForwardDriftService;
import com.oilspill.app.sar.SarObservation;
import com.oilspill.app.sar.SarObservationRepository;
import com.oilspill.app.sar.SarService;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.simulation.SimulationStatus;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class InvestigationExecutorTest {

    private InvestigationRepository investigationRepository;
    private SimulationRepository simulationRepository;
    private SarService sarService;
    private SarObservationRepository sarObservationRepository;
    private ForwardDriftService forwardDriftService;
    private ForwardDriftRepository forwardDriftRepository;
    private BacktrackingService backtrackingService;
    private BacktrackingRepository backtrackingRepository;
    private AttributionService attributionService;
    private AttributionRepository attributionRepository;
    private WebClient pythonWebClient;
    private InvestigationEventBroadcaster broadcaster;
    private MongoTemplate mongoTemplate;
    private InvestigationExecutor executor;

    private Simulation sim;
    private Investigation inv;

    @BeforeEach
    void setUp() {
        investigationRepository = mock(InvestigationRepository.class);
        simulationRepository = mock(SimulationRepository.class);
        sarService = mock(SarService.class);
        sarObservationRepository = mock(SarObservationRepository.class);
        forwardDriftService = mock(ForwardDriftService.class);
        forwardDriftRepository = mock(ForwardDriftRepository.class);
        backtrackingService = mock(BacktrackingService.class);
        backtrackingRepository = mock(BacktrackingRepository.class);
        attributionService = mock(AttributionService.class);
        attributionRepository = mock(AttributionRepository.class);
        pythonWebClient = mock(WebClient.class);
        broadcaster = mock(InvestigationEventBroadcaster.class);
        mongoTemplate = mock(MongoTemplate.class);

        UpdateResult applied = mock(UpdateResult.class);
        when(applied.getModifiedCount()).thenReturn(1L);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), anyString())).thenReturn(applied);

        mockEnvProbeOk();

        executor = new InvestigationExecutor(investigationRepository, simulationRepository,
                sarService, sarObservationRepository, forwardDriftService, forwardDriftRepository,
                backtrackingService, backtrackingRepository, attributionService, attributionRepository,
                pythonWebClient, broadcaster, mongoTemplate);
        executor.init();

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setStatus(SimulationStatus.observation);
        sim.setClock(Instant.parse("2026-09-02T12:00:00Z"));

        inv = new Investigation();
        inv.setInvestigationId("inv1");
        inv.setSimulationId("sim1");
        inv.setIncidentId("inc1");
        inv.setSpillEventId("spill1");
        inv.setStatus(InvestigationStatus.CREATED);
        inv.setParams(new InvestigationParams());
        inv.setStages(initialStages());
        inv.setCreatedAt(Instant.now());
        inv.setUpdatedAt(Instant.now());

        when(investigationRepository.findById("inv1")).thenReturn(Optional.of(inv));
        when(investigationRepository.save(any(Investigation.class))).thenAnswer(a -> a.getArgument(0));
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(simulationRepository.save(any(Simulation.class))).thenAnswer(a -> a.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        executor.shutdown();
    }

    @Test
    void reusesCompatibleRunsAndCompletesWithCandidateIdentified() {
        seedReusableRuns();

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.COMPLETED, inv.getStatus());
        assertNotNull(inv.getConclusion());
        assertEquals(Conclusion.STATUS_CANDIDATE_IDENTIFIED, inv.getConclusion().getStatus());
        assertEquals("SIM0001", inv.getConclusion().getCandidate().get("mmsi"));
        assertEquals(0.8, inv.getConclusion().getTopScore());
        assertEquals(0.25, inv.getConclusion().getMargin());
        assertEquals(Provenance.AGG_MIXED, inv.getConclusion().getAggregation());

        assertEquals(8, inv.getEvidence().size(), "7 stage evidence + 1 synthesis link");

        for (InvestigationStage s : inv.getStages()) {
            assertEquals(StageStatus.COMPLETED, s.getStatus());
        }

        ArgumentCaptor<Simulation> simCaptor = ArgumentCaptor.forClass(Simulation.class);
        verify(simulationRepository).save(simCaptor.capture());
        assertEquals(SimulationStatus.completed, simCaptor.getValue().getStatus());

        verifyNoInteractions(sarService, forwardDriftService, backtrackingService, attributionService);

        ArgumentCaptor<InvestigationEvent> events = ArgumentCaptor.forClass(InvestigationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("inv1"), events.capture());
        List<String> types = events.getAllValues().stream()
                .map(InvestigationEvent::getType).distinct().toList();
        assertTrue(types.contains("investigation_started"));
        assertTrue(types.contains("step_complete"));
        assertTrue(types.contains("origin_estimated"));
        assertTrue(types.contains("vessels_ranked"));
        assertTrue(types.contains("investigation_complete"));
    }

    @Test
    void concludesInconclusiveWhenMarginBelowThreshold() {
        AttributionRun run = reusableAttribution(0.5, 0.01, false);
        when(attributionRepository.findBySimulationId("sim1")).thenReturn(List.of(run));
        when(attributionRepository.findById("att-reuse")).thenReturn(Optional.of(run));
        seedOtherRuns();

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.COMPLETED, inv.getStatus());
        assertEquals(Conclusion.STATUS_INCONCLUSIVE, inv.getConclusion().getStatus());
        assertNull(inv.getConclusion().getCandidate());
    }

    @Test
    void concludesNoCandidatesWhenRankedListEmpty() {
        AttributionRun run = reusableAttribution(0.0, 0.0, false);
        run.setRankedVessels(new ArrayList<>());
        when(attributionRepository.findBySimulationId("sim1")).thenReturn(List.of(run));
        when(attributionRepository.findById("att-reuse")).thenReturn(Optional.of(run));
        seedOtherRuns();

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.COMPLETED, inv.getStatus());
        assertEquals(Conclusion.STATUS_NO_CANDIDATES, inv.getConclusion().getStatus());
    }

    @Test
    void criticalStageFailureFailsInvestigation() {
        seedOtherRuns();
        when(backtrackingRepository.findBySimulationId("sim1")).thenReturn(List.of());
        when(backtrackingService.runBacktrack(anyString(), any())).thenReturn(
                Map.of("status", "failed", "error", "no forcing available"));

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.FAILED, inv.getStatus());
        assertFalse(inv.getErrors().isEmpty());
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        assertEquals(StageStatus.FAILED, backtrack.getStatus());
        assertEquals(3, backtrack.getAttemptCount());

        ArgumentCaptor<InvestigationEvent> events = ArgumentCaptor.forClass(InvestigationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("inv1"), events.capture());
        assertTrue(events.getAllValues().stream().anyMatch(e -> "investigation_failed".equals(e.getType())));
    }

    @Test
    void stageRecoversOnFinalAttempt() {
        seedOtherRuns();
        when(backtrackingRepository.findBySimulationId("sim1")).thenReturn(List.of());
        when(backtrackingService.runBacktrack(anyString(), any()))
                .thenThrow(new InvestigationExecutor.StageExecutionException("no forcing available"))
                .thenThrow(new InvestigationExecutor.StageExecutionException("no forcing available"))
                .thenReturn(Map.of("status", "completed", "backtrackRunId", "bt-retry"));
        BacktrackingResult fresh = reusableBacktracking();
        fresh.setBacktrackRunId("bt-retry");
        when(backtrackingRepository.findById("bt-retry")).thenReturn(Optional.of(fresh));
        when(attributionRepository.findBySimulationId("sim1"))
                .thenReturn(List.of(reusableAttribution(0.8, 0.25, true)));
        when(attributionRepository.findById("att-reuse"))
                .thenReturn(Optional.of(reusableAttribution(0.8, 0.25, true)));

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.COMPLETED, inv.getStatus());
        assertEquals(Conclusion.STATUS_CANDIDATE_IDENTIFIED, inv.getConclusion().getStatus());
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        assertEquals(StageStatus.COMPLETED, backtrack.getStatus());
        assertEquals(3, backtrack.getAttemptCount());
    }

    @Test
    void cancelledBeforeRunStaysCancelled() {
        seedReusableRuns();
        inv.setStatus(InvestigationStatus.CANCELLED);

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.CANCELLED, inv.getStatus());
        assertEquals(0, inv.getEvidence().size());
        assertNull(inv.getConclusion());
        verifyNoInteractions(sarService, forwardDriftService, backtrackingService, attributionService);

        ArgumentCaptor<InvestigationEvent> events = ArgumentCaptor.forClass(InvestigationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("inv1"), events.capture());
        assertEquals(1, events.getAllValues().size());
        assertEquals("investigation_cancelled", events.getAllValues().get(0).getType());
    }

    @Test
    void runNowOnFailedInvestigationIsNoOp() {
        seedReusableRuns();
        inv.setStatus(InvestigationStatus.FAILED);

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.FAILED, inv.getStatus());
        assertEquals(0, inv.getEvidence().size());
        assertNull(inv.getConclusion());
        verifyNoInteractions(sarService, forwardDriftService, backtrackingService, attributionService);
        verify(broadcaster, never()).broadcast(eq("inv1"), any(InvestigationEvent.class));
    }

    @Test
    void runNowTwiceNeverReAppendsConclusionEvidence() {
        seedReusableRuns();

        executor.runNow("inv1");
        assertEquals(8, inv.getEvidence().size());

        executor.runNow("inv1");
        assertEquals(8, inv.getEvidence().size());

        verify(broadcaster, times(1)).broadcast(eq("inv1"),
                argThat(e -> "investigation_complete".equals(e.getType())));
    }

    @Test
    void atomicFinalizeRefusesWhenPersistedStateIsCancelled() {
        seedReusableRuns();
        UpdateResult applied = mock(UpdateResult.class);
        when(applied.getModifiedCount()).thenReturn(1L);
        UpdateResult refused = mock(UpdateResult.class);
        when(refused.getModifiedCount()).thenReturn(0L);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), anyString())).thenAnswer(a -> {
            Update update = a.getArgument(1);
            Document set = (Document) update.getUpdateObject().get("$set");
            if (set != null && "COMPLETED".equals(set.getString("status"))) {
                inv.setStatus(InvestigationStatus.CANCELLED);
                return refused;
            }
            return applied;
        });

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.CANCELLED, inv.getStatus());
        assertEquals(7, inv.getEvidence().size(), "no conclusion evidence after refused completion");

        ArgumentCaptor<InvestigationEvent> events = ArgumentCaptor.forClass(InvestigationEvent.class);
        verify(broadcaster, atLeast(1)).broadcast(eq("inv1"), events.capture());
        List<String> types = events.getAllValues().stream()
                .map(InvestigationEvent::getType).distinct().toList();
        assertTrue(types.contains("investigation_cancelled"));
        assertFalse(types.contains("investigation_complete"));
    }

    @Test
    void concludesDataInsufficientWhenAttributionUnavailable() {
        seedOtherRuns();
        when(attributionRepository.findBySimulationId("sim1"))
                .thenReturn(List.of(reusableAttribution(0.8, 0.25, true)));
        when(attributionRepository.findById("att-reuse"))
                .thenReturn(Optional.of(reusableAttribution(0.8, 0.25, true)));
        InvestigationStage ais = stageById(inv, StageIds.AIS);
        ais.setStatus(StageStatus.COMPLETED);
        ais.setReferenceId(null);

        executor.runNow("inv1");

        assertEquals(InvestigationStatus.COMPLETED, inv.getStatus());
        assertEquals(Conclusion.STATUS_DATA_INSUFFICIENT, inv.getConclusion().getStatus());
        assertEquals(7, inv.getEvidence().size(), "6 stage evidence + 1 synthesis link");
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void seedReusableRuns() {
        seedOtherRuns();
        AttributionRun run = reusableAttribution(0.8, 0.25, true);
        when(attributionRepository.findBySimulationId("sim1")).thenReturn(List.of(run));
        when(attributionRepository.findById("att-reuse")).thenReturn(Optional.of(run));
    }

    private void seedOtherRuns() {
        when(sarObservationRepository.findBySimulationId("sim1")).thenReturn(List.of(reusableSar()));
        when(forwardDriftRepository.findBySimulationId("sim1")).thenReturn(List.of(reusableForwardDrift()));
        when(backtrackingRepository.findBySimulationId("sim1")).thenReturn(List.of(reusableBacktracking()));
    }

    private AttributionRun reusableAttribution(double topScore, double margin, boolean decisive) {
        AttributionRun run = new AttributionRun();
        run.setAttributionRunId("att-reuse");
        run.setSimulationId("sim1");
        run.setStatus("completed");
        run.setAisSource("CONTROLLED");
        run.setSourceState("CONTROLLED");
        run.setDataset("controlled-ais-v1");
        Map<String, Object> query = new HashMap<>();
        query.put("sourceState", "CONTROLLED");
        query.put("dataset", "controlled-ais-v1");
        query.put("vesselCount", 12);
        run.setAisQuery(query);
        Map<String, Object> filter = new HashMap<>();
        filter.put("kept", 1);
        filter.put("dropped", 11);
        run.setFilter(filter);
        run.setRadiusKm(150.0);
        run.setMaxGapMin(30.0);
        run.setSeed(26143L);
        run.setModelVersion("ais-scoring-v1");
        run.setConclusion("candidate");
        run.setRanking(Map.of(
                "top_score", topScore,
                "second_score", topScore - margin,
                "margin", margin,
                "decisive", decisive));
        Map<String, Object> vessel = new HashMap<>();
        vessel.put("mmsi", "SIM0001");
        vessel.put("name", "MV Demo");
        vessel.put("score", topScore);
        vessel.put("rank", 1);
        run.setRankedVessels(new ArrayList<>(List.of(vessel)));
        return run;
    }

    private SarObservation reusableSar() {
        SarObservation obs = new SarObservation();
        obs.setObservationId("sar-reuse");
        obs.setSimulationId("sim1");
        obs.setStatus("completed");
        obs.setSourceState("LOCAL_FIXTURE");
        obs.setSource("LOCAL_FIXTURE");
        obs.setDetector("CLASSICAL");
        obs.setDetectorVersion("classical-v1");
        obs.setConfidence(0.9);
        obs.setSlickAreaKm2(12.3);
        Map<String, Object> candidate = new HashMap<>();
        candidate.put("candidate_id", "c1");
        candidate.put("classification", "probable_slick");
        candidate.put("confidence", 0.93);
        obs.setCandidates(new ArrayList<>(List.of(candidate)));
        return obs;
    }

    private ForwardDriftResult reusableForwardDrift() {
        ForwardDriftResult r = new ForwardDriftResult();
        r.setDriftRunId("drift-reuse");
        r.setSimulationId("sim1");
        r.setStatus("completed");
        r.setOilType("GENERIC CRUDE");
        r.setParticleCount(500);
        r.setDurationHours(6.0);
        r.setTimestepSeconds(900);
        r.setEnvironmentSource("CONTROLLED");
        r.setModelVersion("opendrift-1.14.11/openoil");
        r.setExtent("{\"type\":\"Polygon\"}");
        r.setMassBalance(new HashMap<>());
        return r;
    }

    private BacktrackingResult reusableBacktracking() {
        BacktrackingResult r = new BacktrackingResult();
        r.setBacktrackRunId("bt-reuse");
        r.setSimulationId("sim1");
        r.setStatus("completed");
        r.setEnsembleSize(20);
        r.setParticlesPerMember(200);
        r.setDurationHours(6.0);
        r.setEnvironmentSource("CONTROLLED");
        r.setSeed(26143L);
        r.setModelVersion("opendrift-1.14.11/openoil-backtrack");
        r.setOriginEstimate(Map.of("lat", 19.08, "lon", 72.28));
        r.setOriginTimeRange(Map.of(
                "earliest", "2026-09-02T06:00:00Z",
                "latest", "2026-09-02T12:00:00Z",
                "preferred", "2026-09-02T09:00:00Z"));
        r.setUncertaintyKm(1.5);
        r.setConfidence(Map.of("trajectory_agreement", 0.9));
        return r;
    }

    private List<InvestigationStage> initialStages() {
        List<InvestigationStage> stages = new ArrayList<>();
        for (String id : StageIds.ORDER) {
            InvestigationStage s = new InvestigationStage();
            s.setStageId(id);
            s.setStatus(StageStatus.PENDING);
            stages.add(s);
        }
        return stages;
    }

    private InvestigationStage stageById(Investigation inv, String stageId) {
        for (InvestigationStage s : inv.getStages()) {
            if (stageId.equals(s.getStageId())) {
                return s;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private void mockEnvProbeOk() {
        WebClient.RequestHeadersUriSpec<?> uriSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(pythonWebClient.get()).thenAnswer(a -> uriSpec);
        when(uriSpec.uri(anyString())).thenAnswer(a -> headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(Mono.just(ResponseEntity.ok().build()));
    }
}