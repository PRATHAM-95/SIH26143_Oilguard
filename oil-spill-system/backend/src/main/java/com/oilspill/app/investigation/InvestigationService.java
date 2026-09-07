package com.oilspill.app.investigation;

import com.mongodb.client.result.UpdateResult;
import com.oilspill.app.attribution.AttributionRepository;
import com.oilspill.app.attribution.AttributionRun;
import com.oilspill.app.backtrack.BacktrackingRepository;
import com.oilspill.app.backtrack.BacktrackingResult;
import com.oilspill.app.forwarddrift.ForwardDriftRepository;
import com.oilspill.app.forwarddrift.ForwardDriftResult;
import com.oilspill.app.groundtruth.GroundTruth;
import com.oilspill.app.groundtruth.GroundTruthRepository;
import com.oilspill.app.incident.Incident;
import com.oilspill.app.incident.IncidentRepository;
import com.oilspill.app.sar.SarObservation;
import com.oilspill.app.sar.SarObservationRepository;
import com.oilspill.app.simulation.Simulation;
import com.oilspill.app.simulation.SimulationRepository;
import com.oilspill.app.simulation.SimulationStatus;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.vessel.Vessel;
import com.oilspill.app.vessel.VesselRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Investigation orchestration entry points. Mongo (the investigation document)
 * is authoritative; the executor advances the state machine asynchronously.
 *
 * Ground-truth isolation: the {@code ground_truth} collection is read ONLY by
 * reveal(); no other path in this service or the executor touches it.
 */
@Service
public class InvestigationService {

    private static final DateTimeFormatter ISO_Z =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private static final String INVESTIGATION_COLLECTION = "investigation";

    private static final ConcurrentHashMap<String, Object> START_LOCKS = new ConcurrentHashMap<>();

    private final InvestigationRepository investigationRepository;
    private final IncidentRepository incidentRepository;
    private final SimulationRepository simulationRepository;
    private final SpillEventRepository spillEventRepository;
    private final SarObservationRepository sarObservationRepository;
    private final BacktrackingRepository backtrackingRepository;
    private final AttributionRepository attributionRepository;
    private final ForwardDriftRepository forwardDriftRepository;
    private final VesselRepository vesselRepository;
    private final GroundTruthRepository groundTruthRepository;
    private final InvestigationExecutor executor;
    private final MongoTemplate mongoTemplate;

    public InvestigationService(InvestigationRepository investigationRepository,
                                IncidentRepository incidentRepository,
                                SimulationRepository simulationRepository,
                                SpillEventRepository spillEventRepository,
                                SarObservationRepository sarObservationRepository,
                                BacktrackingRepository backtrackingRepository,
                                AttributionRepository attributionRepository,
                                ForwardDriftRepository forwardDriftRepository,
                                VesselRepository vesselRepository,
                                GroundTruthRepository groundTruthRepository,
                                InvestigationExecutor executor,
                                MongoTemplate mongoTemplate) {
        this.investigationRepository = investigationRepository;
        this.incidentRepository = incidentRepository;
        this.simulationRepository = simulationRepository;
        this.spillEventRepository = spillEventRepository;
        this.sarObservationRepository = sarObservationRepository;
        this.backtrackingRepository = backtrackingRepository;
        this.attributionRepository = attributionRepository;
        this.forwardDriftRepository = forwardDriftRepository;
        this.vesselRepository = vesselRepository;
        this.groundTruthRepository = groundTruthRepository;
        this.executor = executor;
        this.mongoTemplate = mongoTemplate;
    }

    // ------------------------------------------------------------------
    // Start
    // ------------------------------------------------------------------

    @Transactional
    public Map<String, Object> start(String incidentId, StartInvestigationRequest request) {
        Object lock = START_LOCKS.computeIfAbsent(incidentId, k -> new Object());
        synchronized (lock) {
            try {
                return doStart(incidentId, request);
            } finally {
                START_LOCKS.remove(incidentId);
            }
        }
    }

    private Map<String, Object> doStart(String incidentId, StartInvestigationRequest request) {
        Incident incident = requireIncident(incidentId);
        Simulation sim = requireSimulation(incident.getSimulationId());

        Optional<Investigation> latest = investigationRepository
                .findFirstByIncidentIdOrderByCreatedAtDesc(incidentId);
        if (latest.isPresent() && InvestigationStatus.isActive(latest.get().getStatus())) {
            Map<String, Object> existing = toResponse(latest.get());
            existing.put("reused", true);
            return existing;
        }

        InvestigationParams params = resolveParams(request);
        Investigation inv = new Investigation();
        inv.setInvestigationId("inv-" + UUID.randomUUID().toString().substring(0, 12));
        inv.setIncidentId(incidentId);
        inv.setSimulationId(incident.getSimulationId());
        inv.setSpillEventId(incident.getSpillEventId());
        inv.setStatus(InvestigationStatus.CREATED);
        inv.setParams(params);
        inv.setStages(initialStages());
        inv.setCreatedAt(Instant.now());
        inv.setUpdatedAt(Instant.now());
        investigationRepository.save(inv);

        sim.setStatus(SimulationStatus.investigation);
        sim.setUpdatedAt(Instant.now());
        simulationRepository.save(sim);

        executor.schedule(inv.getInvestigationId());
        Map<String, Object> out = toResponse(inv);
        out.put("reused", false);
        return out;
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    public Map<String, Object> get(String investigationId) {
        return toResponse(requireInvestigation(investigationId));
    }

    public List<Map<String, Object>> steps(String investigationId) {
        Investigation inv = requireInvestigation(investigationId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (InvestigationStage s : inv.getStages()) {
            out.add(stageToMap(s));
        }
        return out;
    }

    public List<Map<String, Object>> list(String simulationId, String incidentId, String status) {
        List<Investigation> matches = new ArrayList<>();
        if (simulationId != null && !simulationId.isBlank()) {
            matches.addAll(investigationRepository.findBySimulationIdOrderByCreatedAtDesc(simulationId));
        } else {
            matches.addAll(investigationRepository.findAll());
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Investigation inv : matches) {
            if (incidentId != null && !incidentId.isBlank() && !incidentId.equals(inv.getIncidentId())) {
                continue;
            }
            if (status != null && !status.isBlank() && !status.equalsIgnoreCase(inv.getStatus().name())) {
                continue;
            }
            out.add(summaryMap(inv));
        }
        out.sort(Comparator.comparing(m -> String.valueOf(m.get("createdAt"))));
        return out;
    }

    // ------------------------------------------------------------------
    // Retry / cancel
    // ------------------------------------------------------------------

    @Transactional
    public Map<String, Object> retry(String investigationId, RetryRequest request) {
        Investigation inv = requireInvestigation(investigationId);
        if (InvestigationStatus.isActive(inv.getStatus())) {
            throw new ConflictException("investigation " + investigationId + " is already running");
        }
        if (inv.getStatus() == InvestigationStatus.COMPLETED) {
            throw new ConflictException("investigation " + investigationId + " is completed; start a new investigation instead");
        }

        String requestedStageId = request == null ? null : request.getStageId();
        if (requestedStageId != null && !requestedStageId.isBlank()) {
            InvestigationStage stage = stageById(inv, requestedStageId);
            if (stage == null) {
                throw new ValidationException("unknown stage: " + requestedStageId);
            }
            resetFrom(inv, stage);
        } else {
            for (InvestigationStage s : inv.getStages()) {
                resetFrom(inv, s);
            }
        }

        inv.setStatus(InvestigationStatus.CREATED);
        inv.setErrors(new ArrayList<>());
        inv.setUpdatedAt(Instant.now());
        investigationRepository.save(inv);

        executor.schedule(inv.getInvestigationId());
        return toResponse(inv);
    }

    @Transactional
    public Map<String, Object> cancel(String investigationId) {
        Investigation inv = requireInvestigation(investigationId);
        if (!InvestigationStatus.isActive(inv.getStatus())) {
            throw new ConflictException("investigation " + investigationId
                    + " is not running (status " + inv.getStatus() + ")");
        }
        executor.requestCancel(inv.getInvestigationId());
        Instant now = Instant.now();
        long applied = mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(investigationId)
                        .and("status").in(InvestigationStatus.CREATED.name(),
                                InvestigationStatus.RUNNING.name())),
                new Update().set("status", InvestigationStatus.CANCELLED.name())
                        .set("claimedUntil", null)
                        .set("updatedAt", now),
                INVESTIGATION_COLLECTION).getModifiedCount();
        if (applied == 0) {
            return toResponse(requireInvestigation(investigationId));
        }
        inv.setStatus(InvestigationStatus.CANCELLED);
        inv.setUpdatedAt(now);
        return toResponse(inv);
    }

    // ------------------------------------------------------------------
    // Reveal (the ONLY reader of ground truth)
    // ------------------------------------------------------------------

    @Transactional
    public Map<String, Object> reveal(String investigationId) {
        Investigation inv = requireInvestigation(investigationId);
        if (inv.getStatus() != InvestigationStatus.COMPLETED) {
            throw new ConflictException("reveal requires a COMPLETED investigation (was "
                    + inv.getStatus() + ")");
        }

        GroundTruth gt = groundTruthRepository.findBySimulationId(inv.getSimulationId()).orElse(null);
        if (gt == null) {
            throw new ValidationException("no ground truth available for simulation "
                    + inv.getSimulationId());
        }

        Map<String, Object> origin = concludedOrigin(inv);
        Object releaseTime = concludedReleaseTime(inv);
        double positionErrorKm = haversine(
                toDouble(origin.get("lat")), toDouble(origin.get("lon")),
                gt.getActualOrigin().lat(), gt.getActualOrigin().lon());

        Double timeErrorMin = null;
        if (releaseTime instanceof String iso && gt.getActualSpillTime() != null) {
            try {
                timeErrorMin = (double) Math.abs(Duration.between(
                        Instant.parse(iso), gt.getActualSpillTime()).toMinutes());
            } catch (Exception ignored) {
                // non-parseable release time
            }
        }

        boolean attributionCorrect = false;
        List<String> notes = new ArrayList<>();
        Conclusion c = inv.getConclusion();
        Map<String, Object> candidate = c == null ? null : c.getCandidate();
        if (candidate != null && candidate.get("mmsi") != null) {
            String contenderMmsi = String.valueOf(candidate.get("mmsi"));
            String culpritMmsi = culpritMmsi(inv.getSimulationId(), gt.getActualVesselId());
            attributionCorrect = contenderMmsi.equals(culpritMmsi);
            if (contenderMmsi.equals(gt.getActualVesselId())) {
                notes.add("candidate mmsi also matches stored vessel id directly");
            }
        } else {
            notes.add("conclusion carries no top candidate; attribution correctness cannot be evaluated");
        }

        double scoreMargin = c == null || c.getMargin() == null ? 0.0 : c.getMargin();

        RevealMetrics metrics = new RevealMetrics();
        metrics.setRevealedAt(Instant.now());
        metrics.setPositionErrorKm(round2(positionErrorKm));
        metrics.setTimeErrorMin(timeErrorMin == null ? null : (double) timeErrorMin);
        metrics.setAttributionCorrect(attributionCorrect);
        metrics.setScoreMargin(scoreMargin);
        metrics.setNotes(notes.isEmpty() ? null : Map.of("notes", notes));
        inv.setReveal(metrics);
        inv.setUpdatedAt(Instant.now());
        investigationRepository.save(inv);

        Map<String, Object> out = new HashMap<>();
        out.put("investigationId", investigationId);
        out.put("revealed", true);
        out.put("positionError_km", metrics.getPositionErrorKm());
        out.put("timeError_min", metrics.getTimeErrorMin());
        out.put("attributionCorrect", metrics.getAttributionCorrect());
        out.put("scoreMargin", metrics.getScoreMargin());
        out.put("notes", notes);
        out.put("revealedAt", metrics.getRevealedAt());
        return out;
    }

    // ------------------------------------------------------------------
    // Report
    // ------------------------------------------------------------------

    public Map<String, Object> report(String investigationId) {
        Investigation inv = requireInvestigation(investigationId);
        Map<String, Object> report = new HashMap<>();

        Map<String, Object> summary = new HashMap<>();
        summary.put("investigationId", inv.getInvestigationId());
        summary.put("simulationId", inv.getSimulationId());
        summary.put("incidentId", inv.getIncidentId());
        summary.put("spillEventId", inv.getSpillEventId());
        summary.put("status", inv.getStatus().name());
        summary.put("startedAt", inv.getStartedAt() == null ? null : ISO_Z.format(inv.getStartedAt()));
        summary.put("completedAt", inv.getCompletedAt() == null ? null : ISO_Z.format(inv.getCompletedAt()));
        if (inv.getConclusion() != null) {
            summary.put("conclusionStatus", inv.getConclusion().getStatus());
            summary.put("conclusionReason", inv.getConclusion().getReason());
        }
        report.put("1_summary", summary);

        report.put("2_context", context(inv));
        report.put("3_detection", stageSection(inv, StageIds.DETECTION, "SAR_OBSERVATION"));
        report.put("4_characterization", stageSection(inv, StageIds.CHARACTERIZATION, "SAR_OBSERVATION"));
        report.put("5_environment", stageSection(inv, StageIds.ENVIRONMENT, null));
        report.put("6_forward_drift", stageSection(inv, StageIds.FORWARD_DRIFT, "FORWARD_DRIFT_RUN"));
        report.put("7_backtracking", stageSection(inv, StageIds.BACKTRACKING, "BACKTRACK_RUN"));
        report.put("8_source_area", sourceArea(inv));
        report.put("9_ais", stageSection(inv, StageIds.AIS, "ATTRIBUTION_RUN"));
        report.put("10_attribution", attributionSection(inv));
        report.put("11_conclusion", conclusionSection(inv));
        report.put("12_limitations", limitations(inv));
        return report;
    }

    // ------------------------------------------------------------------
    // Recovery
    // ------------------------------------------------------------------

    @EventListener(ApplicationReadyEvent.class)
    public void recoverStaleInvestigations() {
        List<Investigation> active = new ArrayList<>();
        active.addAll(investigationRepository.findByStatus(InvestigationStatus.CREATED));
        active.addAll(investigationRepository.findByStatus(InvestigationStatus.RUNNING));
        for (Investigation inv : active) {
            if (!executor.isInFlight(inv.getInvestigationId())) {
                executor.schedule(inv.getInvestigationId());
            }
        }
    }

    // ------------------------------------------------------------------
    // Response shaping
    // ------------------------------------------------------------------

    private Map<String, Object> toResponse(Investigation inv) {
        Map<String, Object> out = new HashMap<>();
        out.put("investigationId", inv.getInvestigationId());
        out.put("incidentId", inv.getIncidentId());
        out.put("simulationId", inv.getSimulationId());
        out.put("spillEventId", inv.getSpillEventId());
        out.put("status", inv.getStatus().name());
        out.put("params", paramsToMap(inv.getParams()));
        out.put("createdAt", inv.getCreatedAt() == null ? null : ISO_Z.format(inv.getCreatedAt()));
        out.put("startedAt", inv.getStartedAt() == null ? null : ISO_Z.format(inv.getStartedAt()));
        out.put("completedAt", inv.getCompletedAt() == null ? null : ISO_Z.format(inv.getCompletedAt()));
        out.put("updatedAt", inv.getUpdatedAt() == null ? null : ISO_Z.format(inv.getUpdatedAt()));
        out.put("progress", progress(inv));
        out.put("stages", inv.getStages().stream().map(this::stageToMap).toList());
        out.put("evidence", inv.getEvidence());
        out.put("conclusion", conclusionToResponse(inv.getConclusion()));
        out.put("provenance", provenanceToResponse(inv));
        out.put("errors", inv.getErrors());
        out.put("warnings", inv.getWarnings());
        out.put("reveal", Map.of("revealed", inv.getReveal() != null));
        return out;
    }

    private Map<String, Object> summaryMap(Investigation inv) {
        Map<String, Object> out = new HashMap<>();
        out.put("investigationId", inv.getInvestigationId());
        out.put("incidentId", inv.getIncidentId());
        out.put("simulationId", inv.getSimulationId());
        out.put("status", inv.getStatus().name());
        out.put("progress", progress(inv));
        out.put("conclusionStatus",
                inv.getConclusion() == null ? null : inv.getConclusion().getStatus());
        out.put("createdAt", inv.getCreatedAt() == null ? null : ISO_Z.format(inv.getCreatedAt()));
        out.put("updatedAt", inv.getUpdatedAt() == null ? null : ISO_Z.format(inv.getUpdatedAt()));
        return out;
    }

    private Map<String, Object> stageToMap(InvestigationStage s) {
        Map<String, Object> m = new HashMap<>();
        m.put("stageId", s.getStageId());
        m.put("status", s.getStatus().name());
        m.put("attemptCount", s.getAttemptCount());
        m.put("error", s.getError());
        m.put("stageStartedAt", s.getStartedAt() == null ? null : ISO_Z.format(s.getStartedAt()));
        m.put("stageCompletedAt", s.getCompletedAt() == null ? null : ISO_Z.format(s.getCompletedAt()));
        m.put("referenceId", s.getReferenceId());
        m.put("referenceType", s.getReferenceType());
        m.put("provenance", s.getProvenance());
        m.put("sourceState", s.getSourceState());
        m.put("modelVersion", s.getModelVersion());
        m.put("summary", s.getSummary());
        m.put("warnings", s.getWarnings() == null ? List.of() : s.getWarnings());
        return m;
    }

    private Map<String, Object> conclusionToResponse(Conclusion c) {
        if (c == null) {
            return new HashMap<>();
        }
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
        out.put("referenceAttributionRunId", c.getReferenceAttributionRunId());
        out.put("referenceBacktrackRunId", c.getReferenceBacktrackRunId());
        return out;
    }

    private Map<String, Object> provenanceToResponse(Investigation inv) {
        Map<String, String> perStage = new HashMap<>();
        for (InvestigationStage s : inv.getStages()) {
            if (StageIds.CONCLUSION.equals(s.getStageId())) {
                continue;
            }
            perStage.put(s.getStageId(), s.getProvenance() == null ? Provenance.UNAVAILABLE : s.getProvenance());
        }
        Map<String, Object> out = new HashMap<>();
        List<String> values = new ArrayList<>(perStage.values());
        out.put("aggregation", Provenance.aggregate(values));
        out.put("perStage", perStage);
        return out;
    }

    // ------------------------------------------------------------------
    // Report sections
    // ------------------------------------------------------------------

    private Map<String, Object> context(Investigation inv) {
        Map<String, Object> out = new HashMap<>();
        out.put("source", "application-level spill event and incident record (never ground truth)");
        spillEventRepository.findBySimulationId(inv.getSimulationId()).stream()
                .reduce((a, b) -> b)
                .ifPresent(spill -> {
                    out.put("observedTime", spill.getTime() == null ? null : ISO_Z.format(spill.getTime()));
                    out.put("oilType", spill.getOilType());
                    out.put("quantityKg", spill.getQuantityKg());
                    out.put("type", spill.getType());
                    Map<String, Object> loc = new HashMap<>();
                    loc.put("lat", spill.getLocation().lat());
                    loc.put("lon", spill.getLocation().lon());
                    out.put("reportedCentroid", loc);
                });
        return out;
    }

    private Map<String, Object> stageSection(Investigation inv, String stageId, String referenceType) {
        InvestigationStage stage = stageById(inv, stageId);
        if (stage == null) {
            return Map.of("status", "MISSING");
        }
        Map<String, Object> out = new HashMap<>();
        out.put("status", stage.getStatus().name());
        out.put("provenance", stage.getProvenance());
        out.put("sourceState", stage.getSourceState());
        out.put("modelVersion", stage.getModelVersion());
        out.put("referenceId", stage.getReferenceId());
        out.put("summary", stage.getSummary());
        out.put("warnings", stage.getWarnings() == null ? List.of() : stage.getWarnings());
        if (stage.getReferenceId() != null && !StageStatus.isSkippedOrUnavailable(stage.getStatus())) {
            resolveReference(referenceType, stage.getReferenceId(), out);
        }
        return out;
    }

    private void resolveReference(String referenceType, String referenceId, Map<String, Object> out) {
        if (referenceType == null) {
            return;
        }
        switch (referenceType) {
            case "SAR_OBSERVATION" -> sarObservationRepository.findById(referenceId).ifPresent(obs -> {
                Map<String, Object> ref = new HashMap<>();
                ref.put("sourceState", obs.getSourceState());
                ref.put("sceneId", obs.getSceneId());
                ref.put("satellites", obs.getSatellites());
                ref.put("estConfidence", obs.getConfidence());
                ref.put("estSlickAreaKm2", obs.getSlickAreaKm2());
                ref.put("candidateCount", obs.getCandidates() == null ? 0 : obs.getCandidates().size());
                out.put("_sarObservation", ref);
            });
            case "BACKTRACK_RUN" -> backtrackingRepository.findById(referenceId).ifPresent(bt -> {
                Map<String, Object> ref = new HashMap<>();
                ref.put("originEstimate", bt.getOriginEstimate());
                ref.put("originTimeRange", bt.getOriginTimeRange());
                ref.put("uncertaintyKm", bt.getUncertaintyKm());
                ref.put("ensembleSummary", bt.getEnsembleSummary());
                ref.put("seed", bt.getSeed());
                out.put("_backtrackingRun", ref);
            });
            case "FORWARD_DRIFT_RUN" -> forwardDriftRepository.findById(referenceId).ifPresent(fd -> {
                Map<String, Object> ref = new HashMap<>();
                ref.put("oilType", fd.getOilType());
                ref.put("particleCount", fd.getParticleCount());
                ref.put("durationHours", fd.getDurationHours());
                ref.put("environmentSource", fd.getEnvironmentSource());
                ref.put("extent", fd.getExtent());
                out.put("_forwardDriftRun", ref);
            });
            case "ATTRIBUTION_RUN" -> attributionRepository.findById(referenceId).ifPresent(run -> {
                Map<String, Object> ref = new HashMap<>();
                ref.put("aisSource", run.getAisSource());
                ref.put("sourceState", run.getSourceState());
                ref.put("dataset", run.getDataset());
                ref.put("aisQuery", run.getAisQuery());
                ref.put("filter", run.getFilter());
                ref.put("ranking", run.getRanking());
                ref.put("weightsUsed", run.getWeightsUsed());
                ref.put("radiusKm", run.getRadiusKm());
                ref.put("maxGapMin", run.getMaxGapMin());
                ref.put("seed", run.getSeed());
                out.put("_attributionRun", ref);
            });
            default -> {
            }
        }
    }

    private Map<String, Object> sourceArea(Investigation inv) {
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        InvestigationStage detection = stageById(inv, StageIds.DETECTION);
        Map<String, Object> out = new HashMap<>();
        if (backtrack != null && backtrack.getSummary() != null) {
            out.put("originEstimate", backtrack.getSummary().get("originEstimate"));
            out.put("originTimeRange", backtrack.getSummary().get("originTimeRange"));
            out.put("uncertaintyKm", backtrack.getSummary().get("uncertaintyKm"));
        }
        if (detection != null && detection.getSummary() != null) {
            out.put("slickAnchorCandidateId", detection.getSummary().get("maxConfidenceCandidateId"));
        }
        out.put("note", "source area is derived from backtracking + SAR anchor; never the hidden ground truth");
        return out;
    }

    private Map<String, Object> attributionSection(Investigation inv) {
        InvestigationStage attribution = stageById(inv, StageIds.ATTRIBUTION);
        Map<String, Object> out = new HashMap<>();
        if (attribution == null) {
            return Map.of("status", "MISSING");
        }
        out.put("status", attribution.getStatus().name());
        out.put("provenance", attribution.getProvenance());
        Map<String, Object> ref = new HashMap<>();
        if (attribution.getReferenceId() != null) {
            attributionRepository.findById(attribution.getReferenceId()).ifPresent(run -> {
                ref.put("rankedVessels", run.getRankedVessels());
                ref.put("ranking", run.getRanking());
                ref.put("weightsUsed", run.getWeightsUsed());
                ref.put("conclusion", run.getConclusion());
                ref.put("modelVersion", run.getModelVersion());
                ref.put("sourceState", run.getSourceState());
                ref.put("scoreWarnings", run.getScoreWarnings());
            });
        }
        out.put("run", ref.isEmpty() ? null : ref);
        out.put("thresholds", attribution.getSummary() == null ? null : Map.of(
                "minTopScore", attribution.getSummary().get("thresholdTopScore"),
                "minMargin", attribution.getSummary().get("thresholdMargin")));
        return out;
    }

    private Map<String, Object> conclusionSection(Investigation inv) {
        Conclusion c = inv.getConclusion();
        if (c == null) {
            return Map.of("status", "NOT_YET_COMPUTED");
        }
        Map<String, Object> out = new HashMap<>();
        out.put("status", c.getStatus());
        out.put("reason", c.getReason());
        out.put("candidate", c.getCandidate());
        out.put("margin", c.getMargin());
        out.put("topScore", c.getTopScore());
        out.put("thresholdsUsed", c.getThresholdsUsed());
        out.put("why", c.getWhy());
        out.put("language", "highest-ranked candidate; never 'culprit' or probability claims");
        return out;
    }

    private Map<String, Object> limitations(Investigation inv) {
        Map<String, Object> out = new HashMap<>();
        out.put("provenance", provenanceToResponse(inv));
        out.put("perStageVocabulary", "REAL|CONTROLLED|FIXTURE|UNAVAILABLE "
                + "(raw scientific states normalized; e.g. REAL_SENTINEL1->REAL, "
                + "LOCAL_FIXTURE->FIXTURE, SYNTHETIC->CONTROLLED)");
        out.put("honestyNotes", List.of(
                "AIS source in this build is CONTROLLED (deterministic simulated fleet), never presented as real AIS",
                "Environmental forcing is CONTROLLED; no real CMEMS/ERA5 credentials configured",
                "SAR scenes in this build are fixtures/synthetic; source state is propagated verbatim",
                "Reveal metrics are produced only by POST /api/investigation/{id}/reveal"));
        out.put("warnings", inv.getWarnings());
        return out;
    }

    // ------------------------------------------------------------------
    // Reveal helpers (ground-truth aware)
    // ------------------------------------------------------------------

    private Map<String, Object> concludedOrigin(Investigation inv) {
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        if (backtrack != null && backtrack.getSummary() != null) {
            Object origin = backtrack.getSummary().get("originEstimate");
            if (origin instanceof Map<?, ?> m && m.containsKey("lat")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> originMap = new HashMap<>((Map<String, Object>) m);
                return originMap;
            }
        }
        Incident incident = incidentRepository.findById(inv.getIncidentId()).orElse(null);
        Map<String, Object> fallback = new HashMap<>();
        if (incident != null && incident.getCentroid() != null) {
            fallback.put("lat", incident.getCentroid().lat());
            fallback.put("lon", incident.getCentroid().lon());
        }
        return fallback;
    }

    private Object concludedReleaseTime(Investigation inv) {
        InvestigationStage backtrack = stageById(inv, StageIds.BACKTRACKING);
        if (backtrack != null && backtrack.getSummary() != null) {
            Object range = backtrack.getSummary().get("originTimeRange");
            if (range instanceof Map<?, ?> m && m.get("preferred") != null) {
                return m.get("preferred");
            }
        }
        return spillEventRepository.findBySimulationId(inv.getSimulationId()).stream()
                .reduce((a, b) -> b)
                .map(SpillEvent::getTime)
                .map(Object::toString)
                .orElse(null);
    }

    private String culpritMmsi(String simulationId, String actualVesselId) {
        List<Vessel> vessels = vesselRepository.findBySimulationId(simulationId);
        for (Vessel v : vessels) {
            if (v.getVesselId().equals(actualVesselId)) {
                return v.getMmsi();
            }
        }
        return actualVesselId;
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private double toDouble(Object o) {
        if (o instanceof Number n) {
            return n.doubleValue();
        }
        return 0.0;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private List<InvestigationStage> initialStages() {
        List<InvestigationStage> stages = new ArrayList<>();
        for (String stageId : StageIds.ORDER) {
            InvestigationStage s = new InvestigationStage();
            s.setStageId(stageId);
            s.setStatus(StageStatus.PENDING);
            s.setAttemptCount(0);
            stages.add(s);
        }
        return stages;
    }

    private void resetFrom(Investigation inv, InvestigationStage stage) {
        if (!StageStatus.isTerminal(stage.getStatus())) {
            return;
        }
        if (stage.getStatus() == StageStatus.COMPLETED) {
            return;
        }
        stage.setStatus(StageStatus.PENDING);
        stage.setAttemptCount(0);
        stage.setError(null);
        stage.setCompletedAt(null);
    }

    private InvestigationStage stageById(Investigation inv, String stageId) {
        for (InvestigationStage s : inv.getStages()) {
            if (stageId.equals(s.getStageId())) {
                return s;
            }
        }
        return null;
    }

    private double progress(Investigation inv) {
        if (inv.getStages() == null || inv.getStages().isEmpty()) {
            return 0.0;
        }
        long completed = inv.getStages().stream()
                .filter(s -> s.getStatus() == StageStatus.COMPLETED
                        || StageStatus.isSkippedOrUnavailable(s.getStatus()))
                .count();
        return Math.min(1.0, (double) completed / inv.getStages().size());
    }

    private InvestigationParams resolveParams(StartInvestigationRequest r) {
        InvestigationParams p = new InvestigationParams();
        if (r == null) {
            return p;
        }
        if (r.getSarSource() != null && !r.getSarSource().isBlank()) {
            p.setSarSource(r.getSarSource());
        }
        if (r.getSarDetector() != null && !r.getSarDetector().isBlank()) {
            p.setSarDetector(r.getSarDetector());
        }
        if (r.getMaxCandidates() != null && r.getMaxCandidates() > 0) {
            p.setMaxCandidates(r.getMaxCandidates());
        }
        if (r.getBacktrackEnsembleSize() != null && r.getBacktrackEnsembleSize() > 0) {
            p.setBacktrackEnsembleSize(r.getBacktrackEnsembleSize());
        }
        if (r.getBacktrackParticlesPerMember() != null && r.getBacktrackParticlesPerMember() > 0) {
            p.setBacktrackParticlesPerMember(r.getBacktrackParticlesPerMember());
        }
        if (r.getBacktrackDurationHours() != null && r.getBacktrackDurationHours() > 0) {
            p.setBacktrackDurationHours(r.getBacktrackDurationHours());
        }
        if (r.getForwardDriftParticleCount() != null && r.getForwardDriftParticleCount() > 0) {
            p.setForwardDriftParticleCount(r.getForwardDriftParticleCount());
        }
        if (r.getForwardDriftDurationHours() != null && r.getForwardDriftDurationHours() > 0) {
            p.setForwardDriftDurationHours(r.getForwardDriftDurationHours());
        }
        if (r.getEnvironmentSource() != null && !r.getEnvironmentSource().isBlank()) {
            p.setEnvironmentSource(r.getEnvironmentSource());
        }
        if (r.getAisSource() != null && !r.getAisSource().isBlank()) {
            p.setAisSource(r.getAisSource());
        }
        if (r.getRadiusKm() != null && r.getRadiusKm() > 0) {
            p.setRadiusKm(r.getRadiusKm());
        }
        if (r.getMaxGapMin() != null && r.getMaxGapMin() > 0) {
            p.setMaxGapMin(r.getMaxGapMin());
        }
        if (r.getSeed() != null) {
            p.setSeed(r.getSeed());
        }
        return p;
    }

    private Map<String, Object> paramsToMap(InvestigationParams p) {
        if (p == null) {
            return new HashMap<>();
        }
        Map<String, Object> out = new HashMap<>();
        out.put("sarSource", p.getSarSource());
        out.put("sarDetector", p.getSarDetector());
        out.put("maxCandidates", p.getMaxCandidates());
        out.put("backtrackEnsembleSize", p.getBacktrackEnsembleSize());
        out.put("backtrackParticlesPerMember", p.getBacktrackParticlesPerMember());
        out.put("backtrackDurationHours", p.getBacktrackDurationHours());
        out.put("forwardDriftParticleCount", p.getForwardDriftParticleCount());
        out.put("forwardDriftDurationHours", p.getForwardDriftDurationHours());
        out.put("environmentSource", p.getEnvironmentSource());
        out.put("aisSource", p.getAisSource());
        out.put("radiusKm", p.getRadiusKm());
        out.put("maxGapMin", p.getMaxGapMin());
        out.put("seed", p.getSeed());
        return out;
    }

    private Incident requireIncident(String incidentId) {
        Optional<Incident> incident = incidentRepository.findById(incidentId);
        if (incident.isEmpty()) {
            throw new InvestigationNotFound("incident not found: " + incidentId);
        }
        return incident.get();
    }

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new InvestigationNotFound("simulation not found: " + simulationId);
        }
        return sim.get();
    }

    private Investigation requireInvestigation(String investigationId) {
        Optional<Investigation> inv = investigationRepository.findById(investigationId);
        if (inv.isEmpty()) {
            throw new InvestigationNotFound("investigation not found: " + investigationId);
        }
        return inv.get();
    }

    public static class InvestigationNotFound extends RuntimeException {
        public InvestigationNotFound(String message) {
            super(message);
        }
    }

    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) {
            super(message);
        }
    }

    public static class ValidationException extends RuntimeException {
        public ValidationException(String message) {
            super(message);
        }
    }
}