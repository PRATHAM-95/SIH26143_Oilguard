package com.oilspill.app.investigation;

import java.util.List;
import java.util.Map;

/**
 * Deterministic synthesis of the stage results. Never promotes a candidate to
 * a "culprit"; the language is always "highest-ranked candidate" with the exact
 * thresholds used and a dead honest breakdown of what contributed.
 */
public class Conclusion {

    public static final String STATUS_CANDIDATE_IDENTIFIED = "CANDIDATE_IDENTIFIED";
    public static final String STATUS_INCONCLUSIVE = "INCONCLUSIVE";
    public static final String STATUS_NO_CANDIDATES = "NO_CANDIDATES";
    public static final String STATUS_DATA_INSUFFICIENT = "DATA_INSUFFICIENT";
    public static final String STATUS_FAILED = "FAILED";

    public static final double MIN_TOP_SCORE = 0.45;
    public static final double MIN_MARGIN = 0.05;

    private String status;
    private String reason;
    private String aggregation;
    private String provenance;
    private Double topScore;
    private Double margin;
    private Boolean decisive;
    private Map<String, Object> candidate;
    private Map<String, Object> thresholdsUsed;
    private List<String> why;
    private String referenceAttributionRunId;
    private String referenceBacktrackRunId;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getAggregation() { return aggregation; }
    public void setAggregation(String aggregation) { this.aggregation = aggregation; }

    public String getProvenance() { return provenance; }
    public void setProvenance(String provenance) { this.provenance = provenance; }

    public Double getTopScore() { return topScore; }
    public void setTopScore(Double topScore) { this.topScore = topScore; }

    public Double getMargin() { return margin; }
    public void setMargin(Double margin) { this.margin = margin; }

    public Boolean getDecisive() { return decisive; }
    public void setDecisive(Boolean decisive) { this.decisive = decisive; }

    public Map<String, Object> getCandidate() { return candidate; }
    public void setCandidate(Map<String, Object> candidate) { this.candidate = candidate; }

    public Map<String, Object> getThresholdsUsed() { return thresholdsUsed; }
    public void setThresholdsUsed(Map<String, Object> thresholdsUsed) { this.thresholdsUsed = thresholdsUsed; }

    public List<String> getWhy() { return why; }
    public void setWhy(List<String> why) { this.why = why; }

    public String getReferenceAttributionRunId() { return referenceAttributionRunId; }
    public void setReferenceAttributionRunId(String referenceAttributionRunId) { this.referenceAttributionRunId = referenceAttributionRunId; }

    public String getReferenceBacktrackRunId() { return referenceBacktrackRunId; }
    public void setReferenceBacktrackRunId(String referenceBacktrackRunId) { this.referenceBacktrackRunId = referenceBacktrackRunId; }
}