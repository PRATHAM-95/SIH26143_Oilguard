package com.oilspill.app.backtrack;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Persisted metadata for a backtracking run (backtrack_run collection).
 *
 * Stores lightweight summary: source region, origin estimate, uncertainty,
 * confidence, ensemble summary, quality metrics. The full trajectory output
 * lives in the FastAPI service's run id.
 */
@Document(collection = "backtrack_run")
public class BacktrackingResult {

    @Id
    private String backtrackRunId;

    private String simulationId;
    private String sarObservationId;

    // Scientific service run id.
    private String scientificRunId;

    private String status; // started | completed | failed

    // Source estimation results.
    private Object sourceRegion;      // GeoJSON Polygon
    private Object sourceContours;    // [{level, polygon}]
    private Object originEstimate;    // {lat, lon}
    private Object originTimeRange;   // {earliest, latest, preferred}
    private Double uncertaintyKm;

    // Confidence metrics.
    private Object confidence;        // {source_concentration, environmental_quality, ...}

    // Ensemble summary.
    private Object ensembleSummary;   // {member_count, converged_count, ...}

    // Quality metrics.
    private Object quality;           // {total_particles, converged_particles, ...}

    // Lightweight trajectories for map rendering: [{member, endpoints: [{lon,lat}]}]
    private List<Map<String, Object>> trajectories;

    // Probability heatmap grid for visualization.
    private Object probabilityGrid;

    // Parameters.
    private int ensembleSize;
    private int particlesPerMember;
    private double durationHours;
    private String environmentSource;
    private String modelVersion;

    // Provenance.
    private Long seed;

    // Timestamps.
    private Instant startTime;
    private Instant createdAt;

    private List<String> warnings;
    private List<String> errors;

    // Getters and setters.

    public String getBacktrackRunId() { return backtrackRunId; }
    public void setBacktrackRunId(String backtrackRunId) { this.backtrackRunId = backtrackRunId; }

    public String getSimulationId() { return simulationId; }
    public void setSimulationId(String simulationId) { this.simulationId = simulationId; }

    public String getSarObservationId() { return sarObservationId; }
    public void setSarObservationId(String sarObservationId) { this.sarObservationId = sarObservationId; }

    public String getScientificRunId() { return scientificRunId; }
    public void setScientificRunId(String scientificRunId) { this.scientificRunId = scientificRunId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Object getSourceRegion() { return sourceRegion; }
    public void setSourceRegion(Object sourceRegion) { this.sourceRegion = sourceRegion; }

    public Object getSourceContours() { return sourceContours; }
    public void setSourceContours(Object sourceContours) { this.sourceContours = sourceContours; }

    public Object getOriginEstimate() { return originEstimate; }
    public void setOriginEstimate(Object originEstimate) { this.originEstimate = originEstimate; }

    public Object getOriginTimeRange() { return originTimeRange; }
    public void setOriginTimeRange(Object originTimeRange) { this.originTimeRange = originTimeRange; }

    public Double getUncertaintyKm() { return uncertaintyKm; }
    public void setUncertaintyKm(Double uncertaintyKm) { this.uncertaintyKm = uncertaintyKm; }

    public Object getConfidence() { return confidence; }
    public void setConfidence(Object confidence) { this.confidence = confidence; }

    public Object getEnsembleSummary() { return ensembleSummary; }
    public void setEnsembleSummary(Object ensembleSummary) { this.ensembleSummary = ensembleSummary; }

    public Object getQuality() { return quality; }
    public void setQuality(Object quality) { this.quality = quality; }

    public List<Map<String, Object>> getTrajectories() { return trajectories; }
    public void setTrajectories(List<Map<String, Object>> trajectories) { this.trajectories = trajectories; }

    public Object getProbabilityGrid() { return probabilityGrid; }
    public void setProbabilityGrid(Object probabilityGrid) { this.probabilityGrid = probabilityGrid; }

    public int getEnsembleSize() { return ensembleSize; }
    public void setEnsembleSize(int ensembleSize) { this.ensembleSize = ensembleSize; }

    public int getParticlesPerMember() { return particlesPerMember; }
    public void setParticlesPerMember(int particlesPerMember) { this.particlesPerMember = particlesPerMember; }

    public double getDurationHours() { return durationHours; }
    public void setDurationHours(double durationHours) { this.durationHours = durationHours; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public Long getSeed() { return seed; }
    public void setSeed(Long seed) { this.seed = seed; }

    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }

    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
}
