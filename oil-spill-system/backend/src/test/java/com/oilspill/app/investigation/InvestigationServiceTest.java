package com.oilspill.app.investigation;

import com.mongodb.client.result.UpdateResult;
import com.oilspill.app.attribution.AttributionRepository;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.forwarddrift.ForwardDriftRepository;
import com.oilspill.app.groundtruth.GroundTruth;
import com.oilspill.app.groundtruth.GroundTruthRepository;
import com.oilspill.app.incident.Incident;
import com.oilspill.app.incident.IncidentRepository;
import com.oilspill.app.sar.SarObservationRepository;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.simulation.SimulationStatus;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.vessel.GeoPoint;
import com.oilspill.app.vessel.Vessel;
import com.oilspill.app.vessel.VesselRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InvestigationServiceTest {

    private InvestigationRepository investigationRepository;
    private IncidentRepository incidentRepository;
    private SimulationRepository simulationRepository;
    private SpillEventRepository spillEventRepository;
    private GroundTruthRepository groundTruthRepository;
    private VesselRepository vesselRepository;
    private InvestigationExecutor executor;
    private InvestigationService service;
    private MongoTemplate mongoTemplate;

    private Incident incident;
    private Simulation sim;

    @BeforeEach
    void setUp() {
        investigationRepository = mock(InvestigationRepository.class);
        incidentRepository = mock(IncidentRepository.class);
        simulationRepository = mock(SimulationRepository.class);
        spillEventRepository = mock(SpillEventRepository.class);
        SarObservationRepository sarObservationRepository = mock(SarObservationRepository.class);
        BacktrackingRepository backtrackingRepository = mock(BacktrackingRepository.class);
        AttributionRepository attributionRepository = mock(AttributionRepository.class);
        ForwardDriftRepository forwardDriftRepository = mock(ForwardDriftRepository.class);
        vesselRepository = mock(VesselRepository.class);
        groundTruthRepository = mock(GroundTruthRepository.class);
        executor = mock(InvestigationExecutor.class);

        when(investigationRepository.save(any(Investigation.class))).thenAnswer(a -> a.getArgument(0));

        mongoTemplate = mock(MongoTemplate.class);
        UpdateResult applied = mock(UpdateResult.class);
        when(applied.getModifiedCount()).thenReturn(1L);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), anyString())).thenReturn(applied);

        incident = new Incident();
        incident.setIncidentId("inc1");
        incident.setSimulationId("sim1");
        incident.setSpillEventId("spill1");
        incident.setCentroid(new GeoPoint(72.28, 19.08));

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setStatus(SimulationStatus.observation);

        when(incidentRepository.findById("inc1")).thenReturn(Optional.of(incident));
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));

        service = new InvestigationService(investigationRepository, incidentRepository,
                simulationRepository, spillEventRepository, sarObservationRepository,
                backtrackingRepository, attributionRepository, forwardDriftRepository,
                vesselRepository, groundTruthRepository, executor, mongoTemplate);
    }

    @Test
    void startCreatesInvestigationAndSchedules() {
        Map<String, Object> out = service.start("inc1", new StartInvestigationRequest());

        assertEquals(false, out.get("reused"));
        assertFalse(out.get("investigationId").toString().isBlank());
        assertEquals(InvestigationStatus.CREATED.name(), out.get("status"));

        ArgumentCaptor<Investigation> captor = ArgumentCaptor.forClass(Investigation.class);
        verify(investigationRepository).save(captor.capture());
        Investigation saved = captor.getValue();
        assertEquals(26143L, saved.getParams().getSeed());
        assertEquals("LOCAL_FIXTURE", saved.getParams().getSarSource());
        assertEquals(8, saved.getStages().size());
        assertEquals(StageStatus.PENDING, saved.getStages().get(0).getStatus());

        ArgumentCaptor<Simulation> simCaptor = ArgumentCaptor.forClass(Simulation.class);
        verify(simulationRepository).save(simCaptor.capture());
        assertEquals(SimulationStatus.investigation, simCaptor.getValue().getStatus());

        verify(executor).schedule(anyString());
    }

    @Test
    void startReusesActiveInvestigation() {
        Investigation active = investigation(InvestigationStatus.CREATED);
        when(investigationRepository.findFirstByIncidentIdOrderByCreatedAtDesc("inc1"))
                .thenReturn(Optional.of(active));

        Map<String, Object> out = service.start("inc1", new StartInvestigationRequest());

        assertEquals(true, out.get("reused"));
        assertEquals(active.getInvestigationId(), out.get("investigationId"));
        verify(investigationRepository, never()).save(any());
        verify(executor, never()).schedule(anyString());
    }

    @Test
    void startAfterCompletedCreatesNew() {
        Investigation done = investigation(InvestigationStatus.COMPLETED);
        when(investigationRepository.findFirstByIncidentIdOrderByCreatedAtDesc("inc1"))
                .thenReturn(Optional.of(done));

        Map<String, Object> out = service.start("inc1", new StartInvestigationRequest());

        assertEquals(false, out.get("reused"));
        verify(executor).schedule(anyString());
        verify(investigationRepository, atLeastOnce()).save(any(Investigation.class));
    }

    @Test
    void concurrentStartCreatesExactlyOne() throws Exception {
        final AtomicReference<Investigation> created = new AtomicReference<>();
        doAnswer(a -> {
            created.set(a.getArgument(0));
            return a.getArgument(0);
        }).when(investigationRepository).save(any(Investigation.class));
        when(investigationRepository.findFirstByIncidentIdOrderByCreatedAtDesc("inc1"))
                .thenAnswer(a -> created.get() == null ? Optional.empty() : Optional.of(created.get()));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        Future<Map<String, Object>> f1 = pool.submit(() -> {
            ready.countDown();
            try {
                go.await();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return service.start("inc1", new StartInvestigationRequest());
        });
        Future<Map<String, Object>> f2 = pool.submit(() -> {
            ready.countDown();
            try {
                go.await();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return service.start("inc1", new StartInvestigationRequest());
        });
        assertTrue(ready.await(5, TimeUnit.SECONDS));
        go.countDown();
        Map<String, Object> r1 = f1.get(15, TimeUnit.SECONDS);
        Map<String, Object> r2 = f2.get(15, TimeUnit.SECONDS);
        pool.shutdownNow();

        long reused = List.of(r1, r2).stream()
                .filter(r -> Boolean.TRUE.equals(r.get("reused"))).count();
        long createdCount = List.of(r1, r2).stream()
                .filter(r -> Boolean.FALSE.equals(r.get("reused"))).count();
        assertEquals(1L, createdCount, "exactly one investigation created");
        assertEquals(1L, reused, "second concurrent start reuses the active investigation");
        verify(investigationRepository).save(any(Investigation.class));
        verify(executor).schedule(anyString());
    }

    @Test
    void revealRequiresCompletedInvestigation() {
        Investigation inv = investigation(InvestigationStatus.RUNNING);
        when(investigationRepository.findById("inv-running")).thenReturn(Optional.of(inv));

        assertThrows(InvestigationService.ConflictException.class,
                () -> service.reveal("inv-running"));
    }

    @Test
    void revealComputesMetricsAndAttributesCorrectlyWithoutReadingVesselRepoTwice() {
        Investigation inv = completedInvestigation();
        when(investigationRepository.findById("inv1")).thenReturn(Optional.of(inv));

        GroundTruth gt = new GroundTruth();
        gt.setSimulationId("sim1");
        gt.setActualVesselId("v1");
        gt.setActualOrigin(new GeoPoint(72.28, 19.08));
        gt.setActualSpillTime(Instant.parse("2026-09-02T09:10:00Z"));
        when(groundTruthRepository.findBySimulationId("sim1")).thenReturn(Optional.of(gt));

        Vessel culprit = new Vessel();
        culprit.setVesselId("v1");
        culprit.setMmsi("SIM0001");
        when(vesselRepository.findBySimulationId("sim1")).thenReturn(List.of(culprit));

        Map<String, Object> out = service.reveal("inv1");

        assertEquals(true, out.get("revealed"));
        assertEquals(true, out.get("attributionCorrect"));
        assertTrue(((Number) out.get("positionError_km")).doubleValue() < 3.0);
        assertEquals(10.0, ((Number) out.get("timeError_min")).doubleValue());

        verify(groundTruthRepository).findBySimulationId("sim1");
        verify(investigationRepository, atLeast(1)).save(any());
    }

    @Test
    void revealMarksAttributionIncorrectWhenMmsiDiffers() {
        Investigation inv = completedInvestigation();
        when(investigationRepository.findById("inv1")).thenReturn(Optional.of(inv));

        GroundTruth gt = new GroundTruth();
        gt.setSimulationId("sim1");
        gt.setActualVesselId("v1");
        gt.setActualOrigin(new GeoPoint(72.28, 19.08));
        gt.setActualSpillTime(Instant.parse("2026-09-02T09:10:00Z"));
        when(groundTruthRepository.findBySimulationId("sim1")).thenReturn(Optional.of(gt));

        Vessel culprit = new Vessel();
        culprit.setVesselId("v1");
        culprit.setMmsi("SIM9999");
        when(vesselRepository.findBySimulationId("sim1")).thenReturn(List.of(culprit));

        Map<String, Object> out = service.reveal("inv1");

        assertEquals(false, out.get("attributionCorrect"));
    }

    @Test
    void revealWithoutGroundTruthThrowsValidation() {
        Investigation inv = completedInvestigation();
        when(investigationRepository.findById("inv1")).thenReturn(Optional.of(inv));
        when(groundTruthRepository.findBySimulationId("sim1")).thenReturn(Optional.empty());

        assertThrows(InvestigationService.ValidationException.class,
                () -> service.reveal("inv1"));
    }

    @Test
    void retryOnActiveThrowsConflict() {
        Investigation inv = investigation(InvestigationStatus.RUNNING);
        when(investigationRepository.findById("inv-running")).thenReturn(Optional.of(inv));

        assertThrows(InvestigationService.ConflictException.class,
                () -> service.retry("inv-running", new RetryRequest()));
    }

    @Test
    void retryOnCompletedThrowsConflict() {
        Investigation inv = investigation(InvestigationStatus.COMPLETED);
        when(investigationRepository.findById("inv-complete")).thenReturn(Optional.of(inv));

        assertThrows(InvestigationService.ConflictException.class,
                () -> service.retry("inv-complete", new RetryRequest()));
    }

    @Test
    void retryResetsFailedStageAndReschedules() {
        Investigation inv = failedInvestigation();
        when(investigationRepository.findById("inv-failed")).thenReturn(Optional.of(inv));

        RetryRequest request = new RetryRequest();
        request.setStageId(StageIds.BACKTRACKING);
        service.retry("inv-failed", request);

        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        assertEquals(StageStatus.PENDING, backtrack.getStatus());
        assertEquals(0, backtrack.getAttemptCount());
        assertEquals(InvestigationStatus.CREATED, inv.getStatus());
        verify(executor).schedule("inv1");
    }

    @Test
    void cancelRequiresActiveAndRequestsCancel() {
        Investigation inv = investigation(InvestigationStatus.RUNNING);
        when(investigationRepository.findById("inv-running")).thenReturn(Optional.of(inv));

        service.cancel("inv-running");

        assertEquals(InvestigationStatus.CANCELLED, inv.getStatus());
        verify(executor).requestCancel("inv1");
    }

    @Test
    void cancelOnCompletedThrowsConflict() {
        Investigation inv = investigation(InvestigationStatus.COMPLETED);
        when(investigationRepository.findById("inv-complete")).thenReturn(Optional.of(inv));

        assertThrows(InvestigationService.ConflictException.class,
                () -> service.cancel("inv-complete"));
    }

    @Test
    void reportNeverContainsRevealMetrics() {
        Investigation inv = completedInvestigation();
        when(investigationRepository.findById("inv1")).thenReturn(Optional.of(inv));

        Map<String, Object> report = service.report("inv1");

        List<String> sections = List.of(
                "1_summary", "2_context", "3_detection", "4_characterization",
                "5_environment", "6_forward_drift", "7_backtracking", "8_source_area",
                "9_ais", "10_attribution", "11_conclusion", "12_limitations");
        for (String key : sections) {
            assertTrue(report.containsKey(key), "report section missing: " + key);
        }
        assertNotNull(report.get("1_summary"));
        assertNotNull(report.get("11_conclusion"));
        assertNotNull(report.get("12_limitations"));
        String json = report.toString();
        assertFalse(json.contains("positionError_km"));
        assertFalse(json.contains("revealedAt"));
        verifyNoInteractions(groundTruthRepository);
    }

    @Test
    void recoveryReschedulesOnlyStaleInvestigations() {
        Investigation inFlight = investigation(InvestigationStatus.RUNNING);
        inFlight.setInvestigationId("inv-inflight");
        Investigation stale = investigation(InvestigationStatus.RUNNING);
        stale.setInvestigationId("inv-stale");
        when(investigationRepository.findByStatus(InvestigationStatus.CREATED)).thenReturn(List.of());
        when(investigationRepository.findByStatus(InvestigationStatus.RUNNING))
                .thenReturn(Arrays.asList(inFlight, stale));
        when(executor.isInFlight("inv-inflight")).thenReturn(true);
        when(executor.isInFlight("inv-stale")).thenReturn(false);

        service.recoverStaleInvestigations();

        verify(executor, never()).schedule("inv-inflight");
        verify(executor).schedule("inv-stale");
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Investigation investigation(InvestigationStatus status) {
        Investigation inv = new Investigation();
        inv.setInvestigationId("inv1");
        inv.setSimulationId("sim1");
        inv.setIncidentId("inc1");
        inv.setSpillEventId("spill1");
        inv.setStatus(status);
        inv.setParams(new InvestigationParams());
        inv.setStages(initialStages());
        inv.setCreatedAt(Instant.now());
        inv.setUpdatedAt(Instant.now());
        return inv;
    }

    private Investigation completedInvestigation() {
        Investigation inv = investigation(InvestigationStatus.COMPLETED);
        inv.setStartedAt(Instant.parse("2026-09-02T13:00:00Z"));
        inv.setCompletedAt(Instant.parse("2026-09-02T13:00:30Z"));

        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        backtrack.setStatus(StageStatus.COMPLETED);
        Map<String, Object> summary = new HashMap<>();
        summary.put("originEstimate", Map.of("lat", 19.08, "lon", 72.28));
        summary.put("originTimeRange", Map.of(
                "earliest", "2026-09-02T06:00:00Z",
                "latest", "2026-09-02T12:00:00Z",
                "preferred", "2026-09-02T09:20:00Z"));
        backtrack.setSummary(summary);

        InvestigationStage attribution = stageById(inv, StageIds.ATTRIBUTION);
        attribution.setStatus(StageStatus.COMPLETED);
        attribution.setReferenceId("att-run-1");

        Conclusion c = new Conclusion();
        c.setStatus(Conclusion.STATUS_CANDIDATE_IDENTIFIED);
        c.setTopScore(0.8);
        c.setMargin(0.25);
        c.setDecisive(true);
        Map<String, Object> candidate = new HashMap<>();
        candidate.put("mmsi", "SIM0001");
        candidate.put("name", "MV Demo");
        candidate.put("score", 0.8);
        c.setCandidate(candidate);
        c.setAggregation("ALL_CONTROLLED");
        inv.setConclusion(c);
        return inv;
    }

    private Investigation failedInvestigation() {
        Investigation inv = investigation(InvestigationStatus.FAILED);
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        backtrack.setStatus(StageStatus.FAILED);
        backtrack.setAttemptCount(3);
        backtrack.setError("boom");
        return inv;
    }

    private List<InvestigationStage> initialStages() {
        List<InvestigationStage> stages = new java.util.ArrayList<>();
        for (String id : StageIds.ORDER) {
            InvestigationStage s = new InvestigationStage();
            s.setStageId(id);
            s.setStatus(StageStatus.PENDING);
            s.setAttemptCount(0);
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

    private static String anyString() {
        return org.mockito.ArgumentMatchers.anyString();
    }
}