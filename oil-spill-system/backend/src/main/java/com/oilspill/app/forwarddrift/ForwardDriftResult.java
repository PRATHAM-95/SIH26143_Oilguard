package com.oilspill.app.forwarddrift;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Persisted metadata for a forward oil-drift run (task §14 minimal drift_run
 * collection).
 *
 * Deliberately does NOT store the full particle array (can be tens of
 * thousands of rows in the scientific service). We persist a lightweight
 * summary: particle count, a down-sampled map-view particle list for replay,
 * the slick extent polygon, the mass balance and environment provenance. The
 * authoritative full result lives in the FastAPI service's run id.
 */
@Document(collection = "drift_run")
public class ForwardDriftResult {

    @Id
    private String driftRunId;

    private String simulationId;
    private String spillEventId;

    // Scientific service run id (authoritative full result).
    private String scientificRunId;

    private String status; // started | completed | failed

    // Parameters echoed back for reproducibility.
    private String oilType;
    private int particleCount;
    private int timestepSeconds;
    private double durationHours;

    // Environment provenance (CONTROLLED / CONTROLLED TEST FIELD by default).
    private String environmentSource;
    private String environmentDataset;
    private String modelVersion;
    private String reproducibilityDigest;

    // Lightweight map-view particles: [{lat, lon, radius, opacity}].
    private List<Map<String, Object>> renderedParticles;

    // GeoJSON Polygon: [[[lon,lat],...]] closed ring.
    private Object extent;

    private Map<String, Object> massBalance;

    private Instant startTime;
    private Instant createdAt;

    public String getDriftRunId() {
        return driftRunId;
    }

    public void setDriftRunId(String driftRunId) {
        this.driftRunId = driftRunId;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getSpillEventId() {
        return spillEventId;
    }

    public void setSpillEventId(String spillEventId) {
        this.spillEventId = spillEventId;
    }

    public String getScientificRunId() {
        return scientificRunId;
    }

    public void setScientificRunId(String scientificRunId) {
        this.scientificRunId = scientificRunId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOilType() {
        return oilType;
    }

    public void setOilType(String oilType) {
        this.oilType = oilType;
    }

    public int getParticleCount() {
        return particleCount;
    }

    public void setParticleCount(int particleCount) {
        this.particleCount = particleCount;
    }

    public int getTimestepSeconds() {
        return timestepSeconds;
    }

    public void setTimestepSeconds(int timestepSeconds) {
        this.timestepSeconds = timestepSeconds;
    }

    public double getDurationHours() {
        return durationHours;
    }

    public void setDurationHours(double durationHours) {
        this.durationHours = durationHours;
    }

    public String getEnvironmentSource() {
        return environmentSource;
    }

    public void setEnvironmentSource(String environmentSource) {
        this.environmentSource = environmentSource;
    }

    public String getEnvironmentDataset() {
        return environmentDataset;
    }

    public void setEnvironmentDataset(String environmentDataset) {
        this.environmentDataset = environmentDataset;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public String getReproducibilityDigest() {
        return reproducibilityDigest;
    }

    public void setReproducibilityDigest(String reproducibilityDigest) {
        this.reproducibilityDigest = reproducibilityDigest;
    }

    public List<Map<String, Object>> getRenderedParticles() {
        return renderedParticles;
    }

    public void setRenderedParticles(List<Map<String, Object>> renderedParticles) {
        this.renderedParticles = renderedParticles;
    }

    public Object getExtent() {
        return extent;
    }

    public void setExtent(Object extent) {
        this.extent = extent;
    }

    public Map<String, Object> getMassBalance() {
        return massBalance;
    }

    public void setMassBalance(Map<String, Object> massBalance) {
        this.massBalance = massBalance;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}