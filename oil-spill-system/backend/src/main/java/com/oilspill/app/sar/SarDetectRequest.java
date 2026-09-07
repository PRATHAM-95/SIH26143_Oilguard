package com.oilspill.app.sar;

/**
 * Request body for POST /api/simulation/{id}/sar/detect.
 *
 * All fields are optional overrides; the service supplies safe defaults that
 * produce an honest demo observation (LOCAL_FIXTURE, classical detector) when
 * nothing is specified, so the Investigation UI can always show something
 * real.
 *
 * Real Sentinel-1 is credential-gated in the Python service; asking for it
 * without configured CDSE credentials returns an honest "unavailable" state
 * rather than a fabricated scene.
 */
public class SarDetectRequest {

    private String source;      // AUTO | LOCAL_FIXTURE | SYNTHETIC | CACHED_SENTINEL1 | REAL_SENTINEL1
    private String detector;    // CLASSICAL | ONNX
    private Integer maxCandidates;

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDetector() {
        return detector;
    }

    public void setDetector(String detector) {
        this.detector = detector;
    }

    public Integer getMaxCandidates() {
        return maxCandidates;
    }

    public void setMaxCandidates(Integer maxCandidates) {
        this.maxCandidates = maxCandidates;
    }
}
