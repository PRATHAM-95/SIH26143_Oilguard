package com.oilspill.app.sar;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Persisted metadata for a SAR oil-spill observation (Step 07).
 *
 * Deliberately does NOT store the raw backscatter raster (potentially large /
 * sensitive). We persist a lightweight summary: provenance, detector identity,
 * a confidence / area summary, the down-sampled candidate list (polygon +
 * metrics) and the scene footprint, all of which are enough to replay the
 * Investigation map view. The authoritative full result lives in the FastAPI
 * scientific service's observation id.
 *
 * Provenance is enforced at the API boundary: a fixture/synthetic scene is
 * stored with its honest {@code sourceState} and must never be labelled as
 * real Sentinel-1.
 */
@Document(collection = "sar_observation")
public class SarObservation {

    @Id
    private String observationId;

    private String simulationId;

    // Scientific service observation id (authoritative full result).
    private String scientificObservationId;

    private String status; // processing | completed | unavailable | failed

    // Provenance (REAL_SENTINEL1 | CACHED_SENTINEL1 | LOCAL_FIXTURE | SYNTHETIC | UNAVAILABLE).
    private String sourceState;
    private String source;
    private String providerDataset;

    private String sceneId;
    private String acquisitionTime;
    private List<String> satellites;
    private String polarization;

    // Detector identity.
    private String detector;
    private String detectorVersion;

    // Lightweight summary.
    private Object sceneFootprint;   // GeoJSON Polygon
    private List<Map<String, Object>> candidates; // flattened, map-friendly
    private Double confidence;
    private Double slickAreaKm2;
    private boolean ageAvailable;
    private String ageEstimate;

    private List<String> warnings;
    private List<String> errors;

    private Instant createdAt;

    public String getObservationId() {
        return observationId;
    }

    public void setObservationId(String observationId) {
        this.observationId = observationId;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getScientificObservationId() {
        return scientificObservationId;
    }

    public void setScientificObservationId(String scientificObservationId) {
        this.scientificObservationId = scientificObservationId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSourceState() {
        return sourceState;
    }

    public void setSourceState(String sourceState) {
        this.sourceState = sourceState;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getProviderDataset() {
        return providerDataset;
    }

    public void setProviderDataset(String providerDataset) {
        this.providerDataset = providerDataset;
    }

    public String getSceneId() {
        return sceneId;
    }

    public void setSceneId(String sceneId) {
        this.sceneId = sceneId;
    }

    public String getAcquisitionTime() {
        return acquisitionTime;
    }

    public void setAcquisitionTime(String acquisitionTime) {
        this.acquisitionTime = acquisitionTime;
    }

    public List<String> getSatellites() {
        return satellites;
    }

    public void setSatellites(List<String> satellites) {
        this.satellites = satellites;
    }

    public String getPolarization() {
        return polarization;
    }

    public void setPolarization(String polarization) {
        this.polarization = polarization;
    }

    public String getDetector() {
        return detector;
    }

    public void setDetector(String detector) {
        this.detector = detector;
    }

    public String getDetectorVersion() {
        return detectorVersion;
    }

    public void setDetectorVersion(String detectorVersion) {
        this.detectorVersion = detectorVersion;
    }

    public Object getSceneFootprint() {
        return sceneFootprint;
    }

    public void setSceneFootprint(Object sceneFootprint) {
        this.sceneFootprint = sceneFootprint;
    }

    public List<Map<String, Object>> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<Map<String, Object>> candidates) {
        this.candidates = candidates;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public Double getSlickAreaKm2() {
        return slickAreaKm2;
    }

    public void setSlickAreaKm2(Double slickAreaKm2) {
        this.slickAreaKm2 = slickAreaKm2;
    }

    public boolean isAgeAvailable() {
        return ageAvailable;
    }

    public void setAgeAvailable(boolean ageAvailable) {
        this.ageAvailable = ageAvailable;
    }

    public String getAgeEstimate() {
        return ageEstimate;
    }

    public void setAgeEstimate(String ageEstimate) {
        this.ageEstimate = ageEstimate;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
