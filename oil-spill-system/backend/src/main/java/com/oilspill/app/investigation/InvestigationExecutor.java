package com.oilspill.app.investigation;

import com.mongodb.client.result.UpdateResult;
import com.oilspill.app.attribution.AttributionRepository;
import com.oilspill.app.attribution.AttributionRequest;
import com.oilspill.app.attribution.AttributionRun;
import com.oilspill.app.attribution.AttributionService;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.backtrack.BacktrackingRequest;
import com.oilspill.app.backtrack.BacktrackingResult;
import com.oilspill.app.backtrack.BacktrackingService;
import com.oilspill.app.forwarddrift.ForwardDriftRepository;
import com.oilspill.app.forwarddrift.ForwardDriftRequest;
import com.oilspill.app.forwarddrift.ForwardDriftResult;
import com.oilspill.app.forwarddrift.ForwardDriftService;
import com.oilspill.app.sar.SarDetectRequest;
import com.oilspill.app.sar.SarObservation;
import com.oilspill.app.sar.SarObservationRepository;
import com.oilspill.app.sar.SarService;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.simulation.SimulationStatus;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Durable "saga-lite" executor for one investigation. Mongo is the
 * authoritative state machine; the executor advances stages in fixed order
 * from the FIRST incomplete stage, so a restart or a retry always resumes from
 * persisted state. Runs at most {@code concurrency} investigations in parallel
 * and guards against double-execution with an in-memory in-flight set.
 *
 * Existing services (SarService, ForwardDriftService, BacktrackingService,
 * AttributionService) are orchestrated in-process; compatible persisted runs
 * are reused instead of re-running science.
 */
@Component
public class InvestigationExecutor {

    private static final Logger log = LoggerFactory.getLogger(InvestigationExecutor.class);

    /** 3 total attempts per stage (1 initial + 2 retries) with 1s then 3s backoff between attempts. */
    public static final int MAX_ATTEMPTS = 3;
    public static final long CLAIM_TIMEOUT_SECONDS = 600;

    private static final String COLLECTION = "investigation";

    private static final Set<String> CRITICAL_STAGES = Set.of(
            StageIds.DETECTION, StageIds.BACKTRACKING, StageIds.AIS, StageIds.ATTRIBUTION);

    private final InvestigationRepository investigationRepository;
    private final SimulationRepository simulationRepository;
    private final SarService sarService;
    private final SarObservationRepository sarObservationRepository;
    private final ForwardDriftService forwardDriftService;
    private final ForwardDriftRepository forwardDriftRepository;
    private final BacktrackingService backtrackingService;
    private final BacktrackingRepository backtrackingRepository;
    private final AttributionService attributionService;
    private final AttributionRepository attributionRepository;
    private final WebClient pythonWebClient;
    private final InvestigationEventBroadcaster broadcaster;
    private final MongoTemplate mongoTemplate;

    private ExecutorService executorService;
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();
    private final Set<String> cancelRequested = ConcurrentHashMap.newKeySet();

    @Value("${python.env-probe.path:/health}")
    private String envProbePath = "/health";

    @Value("${investigation.executor.concurrency:2}")
    private int concurrency = 2;

    public InvestigationExecutor(InvestigationRepository investigationRepository,
                                 SimulationRepository simulationRepository,
                                 SarService sarService,
                                 SarObservationRepository sarObservationRepository,
                                 ForwardDriftService forwardDriftService,
                                 ForwardDriftRepository forwardDriftRepository,
                                 BacktrackingService backtrackingService,
                                 BacktrackingRepository backtrackingRepository,
                                 AttributionService attributionService,
                                 AttributionRepository attributionRepository,
                                 WebClient pythonWebClient,
                                 InvestigationEventBroadcaster broadcaster,
                                 MongoTemplate mongoTemplate) {
        this.investigationRepository = investigationRepository;
        this.simulationRepository = simulationRepository;
        this.sarService = sarService;
        this.sarObservationRepository = sarObservationRepository;
        this.forwardDriftService = forwardDriftService;
        this.forwardDriftRepository = forwardDriftRepository;
        this.backtrackingService = backtrackingService;
        this.backtrackingRepository = backtrackingRepository;
        this.attributionService = attributionService;
        this.attributionRepository = attributionRepository;
        this.pythonWebClient = pythonWebClient;
        this.broadcaster = broadcaster;
        this.mongoTemplate = mongoTemplate;
    }

    @PostConstruct
    public void init() {
        executorService = Executors.newFixedThreadPool(Math.max(1, concurrency));
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdownNow();
    }

    public boolean isInFlight(String investigationId) {
        return inFlight.contains(investigationId);
    }

    public void schedule(String investigationId) {
        executorService.submit(() -> runInvestigation(investigationId));
    }

    /** Synchronous execution on the calling thread (unit-test hook). */
    public void runNow(String investigationId) {
        runInvestigation(investigationId);
    }

    public void requestCancel(String investigationId) {
        cancelRequested.add(investigationId);
    }

    public boolean isCancelRequested(String investigationId) {
        return cancelRequested.contains(investigationId);
    }

    private void runInvestigation(String investigationId) {
        if (!inFlight.add(investigationId)) {
            return;
        }
        try {
            Investigation inv = investigationRepository.findById(investigationId).orElse(null);
            if (inv == null) {
                log.warn("investigation {} not found during execute", investigationId);
                return;
            }
            InvestigationStatus status = inv.getStatus();
            if (status == InvestigationStatus.COMPLETED || status == InvestigationStatus.FAILED
                    || status == InvestigationStatus.CANCELLED) {
                if (status == InvestigationStatus.CANCELLED) {
                    broadcastCancelled(inv);
                }
                return;
            }
            if (cancelRequested.contains(investigationId)) {
                broadcastCancelled(inv);
                return;
            }
            execute(inv);
        } catch (Exception e) {
            log.error("investigation executor crashed for {}", investigationId, e);
            investigationRepository.findById(investigationId).ifPresent(inv -> failInvestigation(inv, e.getMessage()));
        } finally {
            inFlight.remove(investigationId);
            cancelRequested.remove(investigationId);
        }
    }

    private void execute(Investigation inv) {
        if (inv.getStatus() == InvestigationStatus.CREATED) {
            if (!persistStarted(inv)) {
                return;
            }
            broadcaster.broadcast(inv.getInvestigationId(),
                    InvestigationEvent.started(inv.getInvestigationId(), inv.getSimulationId()));
        }

        int index = 0;
        for (InvestigationStage stage : inv.getStages()) {
            if (cancelWon(inv)) {
                broadcastCancelled(inv);
                return;
            }
            if (StageStatus.isTerminal(stage.getStatus())) {
                index++;
                continue;
            }
            StageOutcome outcome = runStageWithRetry(inv, stage, index);
            if (outcome == StageOutcome.CANCELLED) {
                broadcastCancelled(inv);
                return;
            }
            if (outcome == StageOutcome.FAILED) {
                if (CRITICAL_STAGES.contains(stage.getStageId())) {
                    failInvestigation(inv, "critical stage " + stage.getStageId() + " failed after "
                            + MAX_ATTEMPTS + " attempts: " + stage.getError());
                    return;
                }
                if (StageIds.ENVIRONMENT.equals(stage.getStageId())) {
                    stage.setStatus(StageStatus.UNAVAILABLE);
                } else {
                    stage.setStatus(StageStatus.SKIPPED);
                }
                stage.setCompletedAt(Instant.now());
                inv.setUpdatedAt(Instant.now());
                conditionalStageCompletedSave(inv, stage);
                appendWarning(inv, "stage " + stage.getStageId() + " unavailable/skipped: " + stage.getError());
                broadcastStep(inv, stage, index);
                index++;
                continue;
            }
            index++;
        }

        if (cancelWon(inv)) {
            broadcastCancelled(inv);
            return;
        }
        Conclusion conclusion = buildConclusion(inv);
        if (!persistCompleted(inv, conclusion)) {
            return;
        }

        simulationRepository.findById(inv.getSimulationId()).ifPresent(sim -> {
            sim.setStatus(SimulationStatus.completed);
            sim.setUpdatedAt(Instant.now());
            simulationRepository.save(sim);
        });

        InvestigationEvent done = InvestigationEvent.completed(
                inv.getInvestigationId(), inv.getSimulationId(),
                conclusion.getStatus(), conclusionToMap(conclusion));
        broadcaster.broadcast(inv.getInvestigationId(), done);
    }

    private boolean persistStarted(Investigation inv) {
        Instant now = Instant.now();
        inv.setStatus(InvestigationStatus.RUNNING);
        inv.setStartedAt(now);
        inv.setUpdatedAt(now);
        long applied = mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(inv.getInvestigationId())
                        .and("status").is(InvestigationStatus.CREATED.name())),
                new Update().set("status", InvestigationStatus.RUNNING.name())
                        .set("startedAt", now)
                        .set("updatedAt", now),
                COLLECTION).getModifiedCount();
        if (applied == 0) {
            rejectIfCancelled(inv);
            return false;
        }
        return true;
    }

    private boolean persistCompleted(Investigation inv, Conclusion conclusion) {
        Evidence syn = conclusionEvidence(inv, conclusion);
        Instant now = Instant.now();
        long applied = mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(inv.getInvestigationId())
                        .and("status").ne(InvestigationStatus.CANCELLED.name())),
                new Update().set("status", InvestigationStatus.COMPLETED.name())
                        .set("conclusion", conclusion)
                        .set("completedAt", now)
                        .set("claimedUntil", null)
                        .set("updatedAt", now)
                        .set("warnings", inv.getWarnings())
                        .push("evidence", syn),
                COLLECTION).getModifiedCount();
        if (applied == 0) {
            rejectIfCancelled(inv);
            return false;
        }
        inv.getEvidence().add(syn);
        inv.setConclusion(conclusion);
        inv.setStatus(InvestigationStatus.COMPLETED);
        inv.setCompletedAt(now);
        inv.setClaimedUntil(null);
        inv.setUpdatedAt(now);
        return true;
    }

    private StageOutcome runStageWithRetry(Investigation inv, InvestigationStage stage, int index) {
        int attempt = 0;
        while (attempt < MAX_ATTEMPTS) {
            if (cancelWon(inv)) {
                return StageOutcome.CANCELLED;
            }
            attempt++;
            Instant now = Instant.now();
            stage.setAttemptCount(attempt);
            stage.setStatus(StageStatus.RUNNING);
            stage.setStartedAt(now);
            stage.setError(null);
            inv.setClaimedUntil(now.plusSeconds(CLAIM_TIMEOUT_SECONDS));
            inv.setUpdatedAt(now);
            if (!conditionalStageStartSave(inv, stage)) {
                return StageOutcome.CANCELLED;
            }
            broadcastStep(inv, stage, index);

            try {
                StageStatus outcome = runStage(stage.getStageId(), inv, stage);
                stage.setStatus(outcome);
                stage.setCompletedAt(Instant.now());
                inv.setClaimedUntil(null);
                inv.setUpdatedAt(Instant.now());
                conditionalStageCompletedSave(inv, stage);
                if (cancelWon(inv)) {
                    return StageOutcome.CANCELLED;
                }
                if (!StageIds.CONCLUSION.equals(stage.getStageId())) {
                    appendEvidence(inv, stage);
                }
                broadcastStep(inv, stage, index);
                return StageOutcome.PROGRESSED;
            } catch (StageExecutionException e) {
                log.warn("stage {} failed for investigation {}: {}", stage.getStageId(),
                        inv.getInvestigationId(), e.getMessage());
                stage.setError(e.getMessage());
                stage.setStatus(StageStatus.FAILED);
                inv.setUpdatedAt(Instant.now());
                conditionalStageCompletedSave(inv, stage);
                if (cancelWon(inv)) {
                    return StageOutcome.CANCELLED;
                }
                broadcastStep(inv, stage, index);
                if (attempt < MAX_ATTEMPTS) {
                    sleep(attempt == 1 ? 1000 : 3000);
                }
            }
        }
        return StageOutcome.FAILED;
    }

    // ------------------------------------------------------------------
    // Stage runners
    // ------------------------------------------------------------------

    private StageStatus runStage(String stageId, Investigation inv, InvestigationStage stage) {
        switch (stageId) {
            case StageIds.DETECTION -> runDetection(inv, stage);
            case StageIds.CHARACTERIZATION -> runCharacterization(inv, stage);
            case StageIds.ENVIRONMENT -> runEnvironmentProbe(stage);
            case StageIds.FORWARD_DRIFT -> runForwardDrift(inv, stage);
            case StageIds.BACKTRACKING -> runBacktracking(inv, stage);
            case StageIds.AIS -> runAisSearch(inv, stage);
            case StageIds.ATTRIBUTION -> {
                return runAttribution(inv, stage);
            }
            case StageIds.CONCLUSION -> { /* assembled in execute() */ }
            default -> throw new StageExecutionException("unknown stage: " + stageId);
        }
        return StageStatus.COMPLETED;
    }

    private void runDetection(Investigation inv, InvestigationStage stage) {
        InvestigationParams p = inv.getParams();
        SarObservation obs = latestCompletedSarObservation(inv.getSimulationId(), p.getSarSource(), p.getSarDetector());
        if (obs == null) {
            SarDetectRequest req = new SarDetectRequest();
            req.setSource(p.getSarSource());
            req.setDetector(p.getSarDetector());
            req.setMaxCandidates(p.getMaxCandidates());
            Map<String, Object> result = sarService.runSarDetect(inv.getSimulationId(), req);
            requireOk(result, "SAR detection");
            String id = (String) result.get("observationId");
            obs = sarObservationRepository.findById(id).orElse(null);
            if (obs == null) {
                throw new StageExecutionException("SAR observation not persisted after detect: " + id);
            }
        }
        if (!"completed".equals(obs.getStatus())) {
            throw new StageExecutionException("SAR observation not completed: " + obs.getStatus());
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("sourceState", obs.getSourceState());
        summary.put("source", obs.getSource());
        summary.put("estimatedConfidence", obs.getConfidence());
        summary.put("estimatedSlickAreaKm2", obs.getSlickAreaKm2());
        summary.put("maxConfidenceCandidateId", topCandidateId(obs.getCandidates()));
        summary.put("sceneFootprintAvailable", obs.getSceneFootprint() != null);
        stage.setReferenceType("SAR_OBSERVATION");
        stage.setReferenceId(obs.getObservationId());
        stage.setSourceState(obs.getSourceState());
        stage.setProvenance(Provenance.normalize(obs.getSourceState()));
        stage.setModelVersion(obs.getDetectorVersion() == null ? obs.getDetector() : obs.getDetectorVersion());
        stage.setSummary(summary);
        stage.setWarnings(obs.getWarnings());
    }

    private void runCharacterization(Investigation inv, InvestigationStage stage) {
        List<SarObservation> observations = sarObservationRepository.findBySimulationId(inv.getSimulationId());
        SarObservation obs = null;
        for (int i = observations.size() - 1; i >= 0; i--) {
            if ("completed".equals(observations.get(i).getStatus())) {
                obs = observations.get(i);
                break;
            }
        }
        if (obs == null) {
            throw new StageExecutionException("no completed SAR observation to characterize");
        }
        Map<String, Object> top = topCandidateAsMap(obs.getCandidates());
        Map<String, Object> summary = new HashMap<>();
        summary.put("topCandidate", top);
        summary.put("slickAreaKm2", obs.getSlickAreaKm2());
        summary.put("confidence", obs.getConfidence());
        summary.put("ageAvailable", obs.isAgeAvailable());
        summary.put("ageEstimate", obs.getAgeEstimate());
        summary.put("candidateCount", obs.getCandidates() == null ? 0 : obs.getCandidates().size());
        stage.setReferenceType("SAR_OBSERVATION");
        stage.setReferenceId(obs.getObservationId());
        stage.setSourceState(obs.getSourceState());
        stage.setProvenance(Provenance.normalize(obs.getSourceState()));
        stage.setModelVersion(obs.getDetectorVersion() == null ? obs.getDetector() : obs.getDetectorVersion());
        stage.setSummary(summary);
        stage.setWarnings(obs.getWarnings());
    }

    private void runEnvironmentProbe(InvestigationStage stage) {
        try {
            pythonWebClient.get()
                    .uri(envProbePath)
                    .retrieve()
                    .toBodilessEntity()
                    .block(Duration.ofSeconds(10));
        } catch (Exception e) {
            throw new StageExecutionException("scientific service unreachable: " + e.getMessage());
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("reachable", true);
        summary.put("ingestedSource", "CONTROLLED");
        summary.put("note", "scientific service reachable; drift forcing is CONTROLLED in this build "
                + "(no real CMEMS/ERA5 credentials are configured; never assumed)");
        stage.setReferenceType("ENVIRONMENT");
        stage.setSourceState("CONTROLLED");
        stage.setProvenance(Provenance.CONTROLLED);
        stage.setSummary(summary);
    }

    private void runForwardDrift(Investigation inv, InvestigationStage stage) {
        InvestigationParams p = inv.getParams();
        ForwardDriftResult run = latestCompatibleForwardDrift(inv.getSimulationId(), p);
        if (run == null) {
            ForwardDriftRequest req = new ForwardDriftRequest();
            req.setDurationHours(p.getForwardDriftDurationHours());
            req.setParticleCount(p.getForwardDriftParticleCount());
            req.setEnvironmentSource(p.getEnvironmentSource());
            Map<String, Object> result = forwardDriftService.runForwardDrift(inv.getSimulationId(), req);
            if (result.containsKey("error")) {
                throw new StageExecutionException("forward drift failed: " + result.get("error"));
            }
            String id = (String) result.get("driftRunId");
            run = forwardDriftRepository.findById(id).orElse(null);
            if (run == null) {
                throw new StageExecutionException("forward drift run not persisted: " + id);
            }
        }
        if (!"completed".equals(run.getStatus())) {
            throw new StageExecutionException("forward drift run not completed: " + run.getStatus());
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("driftRunId", run.getDriftRunId());
        summary.put("particleCount", run.getParticleCount());
        summary.put("durationHours", run.getDurationHours());
        summary.put("timestepSeconds", run.getTimestepSeconds());
        summary.put("oilType", run.getOilType());
        summary.put("environmentSource", run.getEnvironmentSource());
        summary.put("extent", run.getExtent());
        summary.put("massBalance", run.getMassBalance());
        stage.setReferenceType("FORWARD_DRIFT_RUN");
        stage.setReferenceId(run.getDriftRunId());
        stage.setSourceState(run.getEnvironmentSource());
        stage.setProvenance(Provenance.normalize(run.getEnvironmentSource()));
        stage.setModelVersion(run.getModelVersion());
        stage.setSummary(summary);
    }

    private void runBacktracking(Investigation inv, InvestigationStage stage) {
        InvestigationParams p = inv.getParams();
        BacktrackingResult run = latestCompatibleBacktracking(inv.getSimulationId(), p);
        if (run == null) {
            BacktrackingRequest req = new BacktrackingRequest();
            req.setDurationHours(p.getBacktrackDurationHours());
            req.setEnsembleSize(p.getBacktrackEnsembleSize());
            req.setParticlesPerMember(p.getBacktrackParticlesPerMember());
            req.setEnvironmentSource(p.getEnvironmentSource());
            req.setSeed((double) p.getSeed());
            Map<String, Object> result = backtrackingService.runBacktrack(inv.getSimulationId(), req);
            if (!"completed".equals(result.get("status"))) {
                throw new StageExecutionException("backtracking failed: "
                        + (result.get("error") == null ? result.get("status") : result.get("error")));
            }
            String id = (String) result.get("backtrackRunId");
            run = backtrackingRepository.findById(id).orElse(null);
            if (run == null) {
                throw new StageExecutionException("backtracking run not persisted: " + id);
            }
        }
        if (!"completed".equals(run.getStatus())) {
            throw new StageExecutionException("backtracking run not completed: " + run.getStatus());
        }
        Map<String, Object> originTimeRange = asMap(run.getOriginTimeRange());
        Map<String, Object> summary = new HashMap<>();
        summary.put("originEstimate", run.getOriginEstimate());
        summary.put("originTimeRange", originTimeRange);
        summary.put("uncertaintyKm", run.getUncertaintyKm());
        summary.put("confidence", run.getConfidence());
        summary.put("ensembleSummary", run.getEnsembleSummary());
        summary.put("sourceRegion", run.getSourceRegion());
        stage.setReferenceType("BACKTRACK_RUN");
        stage.setReferenceId(run.getBacktrackRunId());
        stage.setSourceState(run.getEnvironmentSource());
        stage.setProvenance(Provenance.normalize(run.getEnvironmentSource()));
        stage.setModelVersion(run.getModelVersion());
        stage.setSummary(summary);

        double uncertainty = run.getUncertaintyKm() == null ? 0.0 : run.getUncertaintyKm();
        double confidence = asDoubleOrZero(extractPath(run.getConfidence(), "trajectory_agreement"));
        broadcaster.broadcast(inv.getInvestigationId(), InvestigationEvent.originEstimated(
                inv.getInvestigationId(), inv.getSimulationId(),
                run.getOriginEstimate(), uncertainty, confidence));
    }

    private void runAisSearch(Investigation inv, InvestigationStage stage) {
        InvestigationParams p = inv.getParams();
        AttributionRun run = latestCompatibleAttribution(inv.getSimulationId(), p);
        if (run == null) {
            AttributionRequest req = new AttributionRequest();
            req.setSimulationId(inv.getSimulationId());
            req.setAisSource(p.getAisSource());
            req.setSeed(p.getSeed());
            req.setRadiusKm(p.getRadiusKm());
            req.setMaxGapMin(p.getMaxGapMin());
            req.setEnvironmentSource(p.getEnvironmentSource());
            Map<String, Object> result = attributionService.runAttribution(inv.getSimulationId(), req);
            if (!"completed".equals(result.get("status"))) {
                throw new StageExecutionException("AIS search failed: "
                        + (result.get("error") == null ? result.get("status") : result.get("error")));
            }
            String id = (String) result.get("attributionRunId");
            run = attributionRepository.findById(id).orElse(null);
            if (run == null) {
                throw new StageExecutionException("attribution run not persisted: " + id);
            }
        }
        if (!"completed".equals(run.getStatus())) {
            throw new StageExecutionException("attribution run not completed: " + run.getStatus());
        }
        Map<String, Object> query = asMap(run.getAisQuery());
        Map<String, Object> filter = asMap(run.getFilter());
        Map<String, Object> summary = new HashMap<>();
        summary.put("sourceState", run.getSourceState());
        summary.put("dataset", run.getDataset());
        summary.put("vesselCount", query.get("vesselCount"));
        summary.put("filterKept", filter.get("kept"));
        summary.put("filterDropped", filter.get("dropped"));
        summary.put("radiusKm", run.getRadiusKm());
        summary.put("maxGapMin", run.getMaxGapMin());
        stage.setReferenceType("ATTRIBUTION_RUN");
        stage.setReferenceId(run.getAttributionRunId());
        stage.setSourceState(run.getSourceState());
        stage.setProvenance(Provenance.normalize(run.getSourceState()));
        stage.setModelVersion(run.getModelVersion());
        stage.setSummary(summary);
        stage.setWarnings(run.getScoreWarnings());
    }

    private StageStatus runAttribution(Investigation inv, InvestigationStage stage) {
        InvestigationStage aisStage = stageById(inv, StageIds.AIS);
        if (aisStage == null || aisStage.getReferenceId() == null
                || StageStatus.isSkippedOrUnavailable(aisStage.getStatus())) {
            stage.setReferenceType("ATTRIBUTION_RUN");
            stage.setProvenance(Provenance.UNAVAILABLE);
            stage.setError("no AIS attribution run available to score");
            return StageStatus.UNAVAILABLE;
        }
        AttributionRun run = attributionRepository.findById(aisStage.getReferenceId()).orElse(null);
        if (run == null) {
            throw new StageExecutionException("attribution run missing: " + aisStage.getReferenceId());
        }
        List<Map<String, Object>> ranked = asMapList(run.getRankedVessels());
        Map<String, Object> ranking = asMap(run.getRanking());
        double topScore = asDoubleOrZero(ranking.get("top_score"));
        double margin = asDoubleOrZero(ranking.get("margin"));
        boolean decisive = Boolean.TRUE.equals(ranking.get("decisive"));

        Map<String, Object> summary = new HashMap<>();
        summary.put("topScore", topScore);
        summary.put("margin", margin);
        summary.put("decisive", decisive);
        summary.put("scientificConclusion", run.getConclusion());
        summary.put("rankedCount", ranked.size());
        summary.put("thresholdTopScore", Conclusion.MIN_TOP_SCORE);
        summary.put("thresholdMargin", Conclusion.MIN_MARGIN);
        stage.setReferenceType("ATTRIBUTION_RUN");
        stage.setReferenceId(run.getAttributionRunId());
        stage.setSourceState(run.getSourceState());
        stage.setProvenance(Provenance.normalize(run.getSourceState()));
        stage.setModelVersion(run.getModelVersion());
        stage.setSummary(summary);
        stage.setWarnings(run.getScoreWarnings());

        broadcaster.broadcast(inv.getInvestigationId(), InvestigationEvent.vesselsRanked(
                inv.getInvestigationId(), inv.getSimulationId(), ranked, margin));
        return StageStatus.COMPLETED;
    }

    // ------------------------------------------------------------------
    // Conclusion
    // ------------------------------------------------------------------

    private Conclusion buildConclusion(Investigation inv) {
        Conclusion c = new Conclusion();
        c.setThresholdsUsed(Map.of(
                "minTopScore", Conclusion.MIN_TOP_SCORE,
                "minMargin", Conclusion.MIN_MARGIN));
        List<String> why = new ArrayList<>();

        InvestigationStage detection = stageById(inv, StageIds.DETECTION);
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        InvestigationStage attribution = stageById(inv, StageIds.ATTRIBUTION);
        InvestigationStage ais = stageById(inv, StageIds.AIS);

        boolean criticalFailed = inv.getStages().stream()
                .anyMatch(s -> CRITICAL_STAGES.contains(s.getStageId()) && s.getStatus() == StageStatus.FAILED);
        if (criticalFailed) {
            c.setStatus(Conclusion.STATUS_FAILED);
            c.setReason("a critical stage failed and could not be completed");
            c.setProvenance(Provenance.aggregate(stageProvenances(inv)));
            c.setAggregation(aggregateLabel(inv));
            why.add("one or more critical scientific stages (detection/backtracking/AIS/attribution) failed");
            c.setWhy(why);
            return c;
        }

        if (attribution == null || attribution.getStatus() == StageStatus.UNAVAILABLE
                || attribution.getStatus() == StageStatus.SKIPPED || attribution.getReferenceId() == null) {
            c.setStatus(Conclusion.STATUS_DATA_INSUFFICIENT);
            c.setReason("no viable vessel-attribution evidence was produced");
            c.setProvenance(Provenance.aggregate(stageProvenances(inv)));
            c.setAggregation(aggregateLabel(inv));
            why.add(attribution == null || attribution.getReferenceId() == null
                    ? "attribution stage produced no scoring run" : "attribution stage was unavailable/skipped");
            c.setWhy(why);
            return c;
        }

        AttributionRun run = attributionRepository.findById(attribution.getReferenceId()).orElse(null);
        List<Map<String, Object>> ranked = run == null ? List.of() : asMapList(run.getRankedVessels());
        Map<String, Object> ranking = run == null ? Map.of() : asMap(run.getRanking());
        double topScore = asDoubleOrZero(ranking.get("top_score"));
        double margin = asDoubleOrZero(ranking.get("margin"));
        boolean decisive = Boolean.TRUE.equals(ranking.get("decisive"));

        c.setTopScore(topScore);
        c.setMargin(margin);
        c.setDecisive(decisive);
        c.setReferenceAttributionRunId(attribution.getReferenceId());
        if (backtrack != null) {
            c.setReferenceBacktrackRunId(backtrack.getReferenceId());
        }

        boolean aboveThreshold = topScore >= Conclusion.MIN_TOP_SCORE && margin >= Conclusion.MIN_MARGIN;
        if (ranked.isEmpty()) {
            c.setStatus(Conclusion.STATUS_NO_CANDIDATES);
            c.setReason("no candidate vessels survived filtering within the search window/radius");
            why.add("AIS reconstruction returned no candidate tracks to score");
        } else if (aboveThreshold) {
            c.setStatus(Conclusion.STATUS_CANDIDATE_IDENTIFIED);
            c.setReason("highest-ranked candidate meets the frozen score thresholds");
            c.setCandidate(ranked.get(0));
            why.add("top score " + round3(topScore) + " >= " + Conclusion.MIN_TOP_SCORE
                    + " and margin " + round3(margin) + " >= " + Conclusion.MIN_MARGIN);
        } else {
            c.setStatus(Conclusion.STATUS_INCONCLUSIVE);
            c.setReason("ranking is available but not decisive enough to name a candidate");
            why.add("top score " + round3(topScore) + (topScore >= Conclusion.MIN_TOP_SCORE ? " >= " : " < ")
                    + Conclusion.MIN_TOP_SCORE
                    + " and margin " + round3(margin) + (margin >= Conclusion.MIN_MARGIN ? " >= " : " < ")
                    + Conclusion.MIN_MARGIN);
        }
        c.setProvenance(Provenance.aggregate(stageProvenances(inv)));
        c.setAggregation(aggregateLabel(inv));
        c.setWhy(why);
        return c;
    }

    private List<String> stageProvenances(Investigation inv) {
        List<String> values = new ArrayList<>();
        for (InvestigationStage s : inv.getStages()) {
            if (StageIds.CONCLUSION.equals(s.getStageId())) {
                continue;
            }
            if (s.getStatus() == StageStatus.COMPLETED) {
                values.add(s.getProvenance() == null ? Provenance.UNAVAILABLE : s.getProvenance());
            } else if (s.getStatus() == StageStatus.UNAVAILABLE) {
                values.add(Provenance.UNAVAILABLE);
            }
        }
        return values;
    }

    private String aggregateLabel(Investigation inv) {
        List<String> perStage = new ArrayList<>();
        for (InvestigationStage s : inv.getStages()) {
            if (StageIds.CONCLUSION.equals(s.getStageId())) {
                continue;
            }
            if (s.getStatus() == StageStatus.COMPLETED) {
                perStage.add(s.getProvenance() == null ? Provenance.UNAVAILABLE : s.getProvenance());
            } else if (s.getStatus() == StageStatus.UNAVAILABLE) {
                perStage.add(Provenance.UNAVAILABLE);
            }
        }
        return Provenance.aggregate(perStage);
    }

    // ------------------------------------------------------------------
    // Reuse lookup (compatibility = same simulation + same parameters)
    // ------------------------------------------------------------------

    private SarObservation latestCompletedSarObservation(String simulationId, String source, String detector) {
        List<SarObservation> all = sarObservationRepository.findBySimulationId(simulationId);
        for (int i = all.size() - 1; i >= 0; i--) {
            SarObservation o = all.get(i);
            if ("completed".equals(o.getStatus())
                    && java.util.Objects.equals(source, o.getSource())
                    && java.util.Objects.equals(detector, o.getDetector())) {
                return o;
            }
        }
        return null;
    }

    private ForwardDriftResult latestCompatibleForwardDrift(String simulationId, InvestigationParams p) {
        List<ForwardDriftResult> all = forwardDriftRepository.findBySimulationId(simulationId);
        for (int i = all.size() - 1; i >= 0; i--) {
            ForwardDriftResult r = all.get(i);
            if ("completed".equals(r.getStatus())
                    && r.getParticleCount() == p.getForwardDriftParticleCount()
                    && Math.abs(r.getDurationHours() - p.getForwardDriftDurationHours()) < 1e-9
                    && java.util.Objects.equals(p.getEnvironmentSource(), r.getEnvironmentSource())) {
                return r;
            }
        }
        return null;
    }

    private BacktrackingResult latestCompatibleBacktracking(String simulationId, InvestigationParams p) {
        List<BacktrackingResult> all = backtrackingRepository.findBySimulationId(simulationId);
        for (int i = all.size() - 1; i >= 0; i--) {
            BacktrackingResult r = all.get(i);
            if ("completed".equals(r.getStatus())
                    && r.getEnsembleSize() == p.getBacktrackEnsembleSize()
                    && r.getParticlesPerMember() == p.getBacktrackParticlesPerMember()
                    && Math.abs(r.getDurationHours() - p.getBacktrackDurationHours()) < 1e-9
                    && java.util.Objects.equals(p.getEnvironmentSource(), r.getEnvironmentSource())
                    && java.util.Objects.equals(p.getSeed(), r.getSeed() == null ? null : r.getSeed().longValue())) {
                return r;
            }
        }
        return null;
    }

    private AttributionRun latestCompatibleAttribution(String simulationId, InvestigationParams p) {
        List<AttributionRun> all = attributionRepository.findBySimulationId(simulationId);
        for (int i = all.size() - 1; i >= 0; i--) {
            AttributionRun r = all.get(i);
            if ("completed".equals(r.getStatus())
                    && java.util.Objects.equals(p.getAisSource(), r.getAisSource())
                    && Math.abs(r.getRadiusKm() - p.getRadiusKm()) < 1e-9
                    && Math.abs(r.getMaxGapMin() - p.getMaxGapMin()) < 1e-9
                    && java.util.Objects.equals(p.getSeed(), r.getSeed())) {
                return r;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void failInvestigation(Investigation inv, String reason) {
        Instant now = Instant.now();
        inv.getErrors().add(reason);
        inv.setClaimedUntil(null);
        inv.setUpdatedAt(now);
        long applied = mongoTemplate.updateFirst(activeQuery(inv.getInvestigationId()),
                new Update().set("status", InvestigationStatus.FAILED.name())
                        .set("claimedUntil", null)
                        .set("updatedAt", now)
                        .set("warnings", inv.getWarnings())
                        .push("errors", reason),
                COLLECTION).getModifiedCount();
        inv.setStatus(InvestigationStatus.FAILED);
        inv.setUpdatedAt(now);
        if (applied == 0) {
            rejectIfCancelled(inv);
            return;
        }
        broadcaster.broadcast(inv.getInvestigationId(),
                InvestigationEvent.failed(inv.getInvestigationId(), inv.getSimulationId(), reason));
    }

    private void broadcastCancelled(Investigation inv) {
        if (inv.getStatus() == InvestigationStatus.CANCELLED) {
            broadcaster.broadcast(inv.getInvestigationId(),
                    InvestigationEvent.cancelled(inv.getInvestigationId(), inv.getSimulationId()));
            return;
        }
        long applied = mongoTemplate.updateFirst(activeQuery(inv.getInvestigationId()),
                new Update().set("status", InvestigationStatus.CANCELLED.name())
                        .set("claimedUntil", null)
                        .set("updatedAt", Instant.now()),
                COLLECTION).getModifiedCount();
        inv.setStatus(InvestigationStatus.CANCELLED);
        inv.setUpdatedAt(Instant.now());
        if (applied == 0) {
            rejectIfCancelled(inv);
            return;
        }
        broadcaster.broadcast(inv.getInvestigationId(),
                InvestigationEvent.cancelled(inv.getInvestigationId(), inv.getSimulationId()));
    }

    private void broadcastStep(Investigation inv, InvestigationStage stage, int index) {
        double progress = Math.min(0.99, (index + 1.0) / StageIds.ORDER.size());
        if (stage.getStatus() == StageStatus.COMPLETED
                && StageIds.CONCLUSION.equals(stage.getStageId())) {
            progress = 1.0;
        }
        broadcaster.broadcast(inv.getInvestigationId(), InvestigationEvent.stepComplete(
                inv.getInvestigationId(), inv.getSimulationId(),
                stage.getStageId(), stage.getStatus().name(), progress,
                stage.getError() == null ? "" : stage.getError()));
    }

    private void appendEvidence(Investigation inv, InvestigationStage stage) {
        int sequence = inv.getEvidence().size() + 1;
        Evidence ev = new Evidence();
        ev.setSequence(sequence);
        ev.setStageId(stage.getStageId());
        ev.setReferenceType(stage.getReferenceType());
        ev.setReferenceId(stage.getReferenceId());
        ev.setSourceState(stage.getSourceState());
        ev.setProvenance(stage.getProvenance());
        ev.setModelVersion(stage.getModelVersion());
        ev.setSummary(deterministicSummary(stage));
        ev.setUncertainty(extractUncertainty(stage));
        ev.setWarnings(stage.getWarnings());
        inv.getEvidence().add(ev);
        inv.setUpdatedAt(Instant.now());
        mongoTemplate.updateFirst(activeQuery(inv.getInvestigationId()),
                new Update().push("evidence", ev)
                        .set("updatedAt", inv.getUpdatedAt())
                        .set("warnings", inv.getWarnings()),
                COLLECTION);
    }

    private Evidence conclusionEvidence(Investigation inv, Conclusion conclusion) {
        int sequence = inv.getEvidence().size() + 1;
        Evidence ev = new Evidence();
        ev.setSequence(sequence);
        ev.setStageId(StageIds.CONCLUSION);
        ev.setReferenceType("SYNTHESIS");
        ev.setProvenance(conclusion.getProvenance());
        ev.setSummary("investigation concluded with status " + conclusion.getStatus()
                + " (" + conclusion.getReason() + ")");
        ev.setWarnings(inv.getWarnings());
        return ev;
    }

    private Query activeQuery(String investigationId) {
        return Query.query(Criteria.where("_id").is(investigationId)
                .and("status").in(InvestigationStatus.CREATED.name(), InvestigationStatus.RUNNING.name()));
    }

    private boolean cancelWon(Investigation inv) {
        if (cancelRequested.contains(inv.getInvestigationId())) {
            return true;
        }
        Investigation fresh = investigationRepository.findById(inv.getInvestigationId()).orElse(null);
        return fresh != null && fresh.getStatus() == InvestigationStatus.CANCELLED;
    }

    private void rejectIfCancelled(Investigation inv) {
        Investigation fresh = investigationRepository.findById(inv.getInvestigationId()).orElse(null);
        if (fresh != null && fresh.getStatus() == InvestigationStatus.CANCELLED) {
            broadcastCancelled(fresh);
        }
    }

    private boolean conditionalStageStartSave(Investigation inv, InvestigationStage stage) {
        int pos = inv.getStages().indexOf(stage);
        String p = "stages." + pos + ".";
        Long applied = mongoTemplate.updateFirst(activeQuery(inv.getInvestigationId()),
                new Update().set(p + "status", stage.getStatus().name())
                        .set(p + "attemptCount", stage.getAttemptCount())
                        .set(p + "startedAt", stage.getStartedAt())
                        .set(p + "error", null)
                        .set("claimedUntil", inv.getClaimedUntil())
                        .set("updatedAt", inv.getUpdatedAt())
                        .set("warnings", inv.getWarnings()),
                COLLECTION).getModifiedCount();
        return applied != null && applied > 0;
    }

    private void conditionalStageCompletedSave(Investigation inv, InvestigationStage stage) {
        int pos = inv.getStages().indexOf(stage);
        String p = "stages." + pos + ".";
        mongoTemplate.updateFirst(activeQuery(inv.getInvestigationId()),
                new Update().set(p + "status", stage.getStatus().name())
                        .set(p + "attemptCount", stage.getAttemptCount())
                        .set(p + "startedAt", stage.getStartedAt())
                        .set(p + "completedAt", stage.getCompletedAt())
                        .set(p + "error", stage.getError())
                        .set(p + "referenceId", stage.getReferenceId())
                        .set(p + "referenceType", stage.getReferenceType())
                        .set(p + "provenance", stage.getProvenance())
                        .set(p + "sourceState", stage.getSourceState())
                        .set(p + "modelVersion", stage.getModelVersion())
                        .set(p + "summary", stage.getSummary())
                        .set(p + "warnings", stage.getWarnings())
                        .set("claimedUntil", inv.getClaimedUntil())
                        .set("updatedAt", inv.getUpdatedAt())
                        .set("warnings", inv.getWarnings()),
                COLLECTION);
    }

    private String deterministicSummary(InvestigationStage stage) {
        Map<String, Object> s = stage.getSummary();
        if (s == null) {
            return stage.getStageId() + " completed";
        }
        return switch (stage.getStageId()) {
            case StageIds.DETECTION ->
                    "SAR detection identified " + s.getOrDefault("maxConfidenceCandidateId", "-")
                            + " (confidence " + s.getOrDefault("estimatedConfidence", "-")
                            + ", area " + s.getOrDefault("estimatedSlickAreaKm2", "-") + " km2)";
            case StageIds.CHARACTERIZATION ->
                    "Slick characterized from SAR candidates (" + s.getOrDefault("candidateCount", 0)
                            + " candidates)";
            case StageIds.ENVIRONMENT ->
                    "Environmental preflight probe ok; forcing kept CONTROLLED in this build";
            case StageIds.FORWARD_DRIFT ->
                    "Forward drift forecast over " + s.getOrDefault("durationHours", "-")
                            + " h with " + s.getOrDefault("particleCount", "-") + " particles";
            case StageIds.BACKTRACKING ->
                    "Backtracking estimated source origin with uncertainty "
                            + s.getOrDefault("uncertaintyKm", "-") + " km";
            case StageIds.AIS ->
                    "AIS reconstruction queried " + s.getOrDefault("vesselCount", "-")
                            + " vessels from " + s.getOrDefault("sourceState", "?");
            case StageIds.ATTRIBUTION ->
                    "Vessel scoring ranked " + s.getOrDefault("rankedCount", 0)
                            + " candidates (top score " + s.getOrDefault("topScore", "-") + ")";
            default -> stage.getStageId() + " completed";
        };
    }

    private Map<String, Object> extractUncertainty(InvestigationStage stage) {
        if (stage.getSummary() == null) {
            return null;
        }
        Map<String, Object> out = new HashMap<>();
        Object uncertainty = stage.getSummary().get("uncertaintyKm");
        if (uncertainty != null) {
            out.put("uncertainty_km", uncertainty);
        }
        return out.isEmpty() ? null : out;
    }

    private InvestigationStage stageById(Investigation inv, String stageId) {
        for (InvestigationStage s : inv.getStages()) {
            if (stageId.equals(s.getStageId())) {
                return s;
            }
        }
        return null;
    }

    private void requireOk(Map<String, Object> result, String stage) {
        if (result.containsKey("error")) {
            throw new StageExecutionException(stage + " failed: " + result.get("error"));
        }
    }

    private void appendWarning(Investigation inv, String warning) {
        inv.getWarnings().add(warning);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object o) {
        return o instanceof Map<?, ?> m ? new HashMap<>((Map<String, Object>) m) : new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object o) {
        if (o instanceof List<?> l) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object item : l) {
                if (item instanceof Map<?, ?> m) {
                    out.add(new HashMap<>((Map<String, Object>) m));
                }
            }
            return out;
        }
        return new ArrayList<>();
    }

    private Object extractPath(Object node, String key) {
        if (node instanceof Map<?, ?> m) {
            return m.get(key);
        }
        return null;
    }

    private double asDoubleOrZero(Object o) {
        if (o instanceof Number n) {
            return n.doubleValue();
        }
        if (o instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return 0.0;
            }
        }
        return 0.0;
    }

    private double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    private String topCandidateId(List<Map<String, Object>> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        Map<String, Object> top = candidates.get(0);
        Object id = top.get("candidate_id");
        return id == null ? null : String.valueOf(id);
    }

    private Map<String, Object> topCandidateAsMap(List<Map<String, Object>> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return new HashMap<>();
        }
        return new HashMap<>(candidates.get(0));
    }

    private Map<String, Object> conclusionToMap(Conclusion c) {
        Map<String, Object> out = new HashMap<>();
        out.put("status", c.getStatus());
        out.put("reason", c.getReason());
        out.put("aggregation", c.getAggregation());
        out.put("provenance", c.getProvenance());
        out.put("topScore", c.getTopScore());
        out.put("margin", c.getMargin());
        out.put("decisive", c.getDecisive());
        out.put("candidate", c.getCandidate());
        out.put("thresholdsUsed", c.getThresholdsUsed());
        out.put("why", c.getWhy());
        return out;
    }

    /** Result of running one stage, consumed by execute(). */
    public enum StageOutcome {
        PROGRESSED, FAILED, CANCELLED
    }

    /** Internal signal for a stage that cannot complete. */
    public static class StageExecutionException extends RuntimeException {
        public StageExecutionException(String message) {
            super(message);
        }
    }
}