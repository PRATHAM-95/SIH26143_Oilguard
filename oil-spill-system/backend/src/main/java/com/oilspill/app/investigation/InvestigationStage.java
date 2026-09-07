package com.oilspill.app.investigation;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * One step of an investigation. Persisted embedded inside the investigation
 * document; the authoritative scientific payload stays in the referenced run.
 */
public class InvestigationStage {

    private String stageId;
    private StageStatus status;
    private Instant startedAt;
    private Instant completedAt;
    private int attemptCount;
    private String error;

    /** Reference to the persisted upstream run (sar-, bt-, att- or drift- prefixed). */
    private String referenceId;
    private String referenceType;

    /** Normalized provenance for this stage (REAL|CONTROLLED|FIXTURE|UNAVAILABLE). */
    private String provenance;

    /** Verbatim source-state string reported by the scientific service. */
    private String sourceState;

    private String modelVersion;
    private Map<String, Object> summary;
    private List<String> warnings;

    public String getStageId() { return stageId; }
    public void setStageId(String stageId) { this.stageId = stageId; }

    public StageStatus getStatus() { return status; }
    public void setStatus(StageStatus status) { this.status = status; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public String getProvenance() { return provenance; }
    public void setProvenance(String provenance) { this.provenance = provenance; }

    public String getSourceState() { return sourceState; }
    public void setSourceState(String sourceState) { this.sourceState = sourceState; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public Map<String, Object> getSummary() { return summary; }
    public void setSummary(Map<String, Object> summary) { this.summary = summary; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}