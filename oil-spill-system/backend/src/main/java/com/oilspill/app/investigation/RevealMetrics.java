package com.oilspill.app.investigation;

import java.time.Instant;
import java.util.Map;

/**
 * Ground-truth comparison produced ONLY by POST /api/investigation/{id}/reveal
 * (guarded to COMPLETED investigations). This object is the single place the
 * hidden ground truth is ever materialised; regular GET/report responses never
 * surface it.
 */
public class RevealMetrics {

    private Instant revealedAt;
    private Double positionErrorKm;
    private Double timeErrorMin;
    private Boolean attributionCorrect;
    private Double scoreMargin;
    private Map<String, Object> notes;

    public Instant getRevealedAt() { return revealedAt; }
    public void setRevealedAt(Instant revealedAt) { this.revealedAt = revealedAt; }

    public Double getPositionErrorKm() { return positionErrorKm; }
    public void setPositionErrorKm(Double positionErrorKm) { this.positionErrorKm = positionErrorKm; }

    public Double getTimeErrorMin() { return timeErrorMin; }
    public void setTimeErrorMin(Double timeErrorMin) { this.timeErrorMin = timeErrorMin; }

    public Boolean getAttributionCorrect() { return attributionCorrect; }
    public void setAttributionCorrect(Boolean attributionCorrect) { this.attributionCorrect = attributionCorrect; }

    public Double getScoreMargin() { return scoreMargin; }
    public void setScoreMargin(Double scoreMargin) { this.scoreMargin = scoreMargin; }

    public Map<String, Object> getNotes() { return notes; }
    public void setNotes(Map<String, Object> notes) { this.notes = notes; }
}