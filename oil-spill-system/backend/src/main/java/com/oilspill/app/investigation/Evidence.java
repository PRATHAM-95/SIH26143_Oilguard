package com.oilspill.app.investigation;

import java.util.List;
import java.util.Map;

/**
 * A single evidence-chain link. References the authoritative upstream run
 * document instead of duplicating heavy payloads; the summary is a
 * deterministic description built by the backend.
 */
public class Evidence {

    private int sequence;
    private String stageId;
    private String referenceType;
    private String referenceId;

    /** Normalized provenance of the evidence (REAL|CONTROLLED|FIXTURE|UNAVAILABLE). */
    private String provenance;

    /** Verbatim source-state string reported by the scientific service. */
    private String sourceState;

    private String modelVersion;
    private String summary;
    private Map<String, Object> uncertainty;
    private List<String> warnings;

    public int getSequence() { return sequence; }
    public void setSequence(int sequence) { this.sequence = sequence; }

    public String getStageId() { return stageId; }
    public void setStageId(String stageId) { this.stageId = stageId; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }

    public String getProvenance() { return provenance; }
    public void setProvenance(String provenance) { this.provenance = provenance; }

    public String getSourceState() { return sourceState; }
    public void setSourceState(String sourceState) { this.sourceState = sourceState; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public Map<String, Object> getUncertainty() { return uncertainty; }
    public void setUncertainty(Map<String, Object> uncertainty) { this.uncertainty = uncertainty; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}