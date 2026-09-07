package com.oilspill.app.investigation;

import java.time.Instant;

/**
 * Server -> client investigation event frame, pushed over the raw JSON
 * WebSocket topic /ws/investigation/{investigationId} (STEP 11).
 *
 * Mirrors the flat, type-discriminated contract of the simulation topic.
 */
public class InvestigationEvent {

    public static final String TYPE_INVESTIGATION_STARTED = "investigation_started";
    public static final String TYPE_STEP_COMPLETE = "step_complete";
    public static final String TYPE_ORIGIN_ESTIMATED = "origin_estimated";
    public static final String TYPE_VESSELS_RANKED = "vessels_ranked";
    public static final String TYPE_INVESTIGATION_COMPLETE = "investigation_complete";
    public static final String TYPE_INVESTIGATION_FAILED = "investigation_failed";
    public static final String TYPE_INVESTIGATION_CANCELLED = "investigation_cancelled";

    private String type;
    private String investigationId;
    private String simulationId;

    private String stageId;
    private String stageStatus;
    private double progress;
    private String detail;
    private String message;

    private Object originEstimate;
    private double uncertaintyKm;
    private double confidence;

    private Object rankedVessels;
    private Object conclusionStatus;
    private Object conclusion;
    private double margin;

    private Instant timestamp;

    public InvestigationEvent() {
    }

    public static InvestigationEvent started(String investigationId, String simulationId) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_INVESTIGATION_STARTED;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.message = "investigation started";
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent stepComplete(String investigationId, String simulationId,
                                                  String stageId, String stageStatus,
                                                  double progress, String detail) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_STEP_COMPLETE;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.stageId = stageId;
        e.stageStatus = stageStatus;
        e.progress = progress;
        e.detail = detail;
        e.message = "step " + stageId + " " + stageStatus.toLowerCase();
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent originEstimated(String investigationId, String simulationId,
                                                     Object originEstimate, double uncertaintyKm,
                                                     double confidence) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_ORIGIN_ESTIMATED;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.stageId = StageIds.BACKTRACKING;
        e.originEstimate = originEstimate;
        e.uncertaintyKm = uncertaintyKm;
        e.confidence = confidence;
        e.message = "source origin estimated";
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent vesselsRanked(String investigationId, String simulationId,
                                                   Object rankedVessels, double margin) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_VESSELS_RANKED;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.stageId = StageIds.ATTRIBUTION;
        e.rankedVessels = rankedVessels;
        e.margin = margin;
        e.message = "vessels ranked";
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent completed(String investigationId, String simulationId,
                                               String conclusionStatus, Object conclusion) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_INVESTIGATION_COMPLETE;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.stageId = StageIds.CONCLUSION;
        e.stageStatus = "COMPLETED";
        e.progress = 1.0;
        e.conclusionStatus = conclusionStatus;
        e.conclusion = conclusion;
        e.message = "investigation completed";
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent failed(String investigationId, String simulationId,
                                            String reason) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_INVESTIGATION_FAILED;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.message = "investigation failed: " + reason;
        e.timestamp = Instant.now();
        return e;
    }

    public static InvestigationEvent cancelled(String investigationId, String simulationId) {
        InvestigationEvent e = new InvestigationEvent();
        e.type = TYPE_INVESTIGATION_CANCELLED;
        e.investigationId = investigationId;
        e.simulationId = simulationId;
        e.message = "investigation cancelled";
        e.timestamp = Instant.now();
        return e;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getInvestigationId() { return investigationId; }
    public void setInvestigationId(String investigationId) { this.investigationId = investigationId; }

    public String getSimulationId() { return simulationId; }
    public void setSimulationId(String simulationId) { this.simulationId = simulationId; }

    public String getStageId() { return stageId; }
    public void setStageId(String stageId) { this.stageId = stageId; }

    public String getStageStatus() { return stageStatus; }
    public void setStageStatus(String stageStatus) { this.stageStatus = stageStatus; }

    public double getProgress() { return progress; }
    public void setProgress(double progress) { this.progress = progress; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Object getOriginEstimate() { return originEstimate; }
    public void setOriginEstimate(Object originEstimate) { this.originEstimate = originEstimate; }

    public double getUncertaintyKm() { return uncertaintyKm; }
    public void setUncertaintyKm(double uncertaintyKm) { this.uncertaintyKm = uncertaintyKm; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public Object getRankedVessels() { return rankedVessels; }
    public void setRankedVessels(Object rankedVessels) { this.rankedVessels = rankedVessels; }

    public Object getConclusionStatus() { return conclusionStatus; }
    public void setConclusionStatus(Object conclusionStatus) { this.conclusionStatus = conclusionStatus; }

    public Object getConclusion() { return conclusion; }
    public void setConclusion(Object conclusion) { this.conclusion = conclusion; }

    public double getMargin() { return margin; }
    public void setMargin(double margin) { this.margin = margin; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}