package com.oilspill.app.investigation;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Persistent investigation aggregate (investigation collection). Mongo is the
 * authoritative state machine; WebSocket is only a live-update channel, so the
 * frontend can always re-hydrate from the document after a refresh/reconnect.
 */
@Document(collection = "investigation")
public class Investigation {

    @Id
    private String investigationId;

    @Indexed
    private String simulationId;

    @Indexed
    private String incidentId;

    private String spillEventId;

    @Indexed
    private InvestigationStatus status;

    private InvestigationParams params;

    private List<InvestigationStage> stages = new ArrayList<>();
    private List<Evidence> evidence = new ArrayList<>();
    private Conclusion conclusion;

    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    private RevealMetrics reveal;

    private Instant startedAt;
    private Instant completedAt;
    private Instant claimedUntil;
    private Instant createdAt;
    private Instant updatedAt;

    public String getInvestigationId() { return investigationId; }
    public void setInvestigationId(String investigationId) { this.investigationId = investigationId; }

    public String getSimulationId() { return simulationId; }
    public void setSimulationId(String simulationId) { this.simulationId = simulationId; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public String getSpillEventId() { return spillEventId; }
    public void setSpillEventId(String spillEventId) { this.spillEventId = spillEventId; }

    public InvestigationStatus getStatus() { return status; }
    public void setStatus(InvestigationStatus status) { this.status = status; }

    public InvestigationParams getParams() { return params; }
    public void setParams(InvestigationParams params) { this.params = params; }

    public List<InvestigationStage> getStages() { return stages; }
    public void setStages(List<InvestigationStage> stages) { this.stages = stages; }

    public List<Evidence> getEvidence() { return evidence; }
    public void setEvidence(List<Evidence> evidence) { this.evidence = evidence; }

    public Conclusion getConclusion() { return conclusion; }
    public void setConclusion(Conclusion conclusion) { this.conclusion = conclusion; }

    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }

    public RevealMetrics getReveal() { return reveal; }
    public void setReveal(RevealMetrics reveal) { this.reveal = reveal; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getClaimedUntil() { return claimedUntil; }
    public void setClaimedUntil(Instant claimedUntil) { this.claimedUntil = claimedUntil; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}