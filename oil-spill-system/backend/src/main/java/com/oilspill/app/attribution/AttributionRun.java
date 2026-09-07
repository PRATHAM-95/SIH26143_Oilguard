package com.oilspill.app.attribution;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Persisted metadata for an attribution run (attribution_run collection, STEP 10).
 *
 * Stores the full replayable result of the pipeline
 * AIS query -> filter -> five-factor vessel scoring. Provenance is never
 * invented: the ais source state/name reported by the scientific service is
 * stored verbatim, so a CONTROLLED fleet is never mistaken for real AIS.
 */
@Document(collection = "attribution_run")
public class AttributionRun {

    @Id
    private String attributionRunId;

    private String simulationId;
    private String backtrackRunId;

    private String status; // started | completed | failed

    // Provenance.
    private String aisSource;        // CONTROLLED | GFW | ...
    private String sourceState;      // scientific-service authoritative state
    private String dataset;
    private String environmentSource;
    private String modelVersion;     // ais-scoring-v1
    private Map<String, Double> weightsUsed;

    // Anchor geometry (from the backtracking result, or the spill/simulation).
    private Object origin;           // {lat, lon}
    private Object timeRange;        // {earliest, latest, preferred}
    private Instant releaseTime;

    // Pipeline summary.
    private Object aisQuery;         // {sourceState, provider, dataset, vesselCount, elapsedMs, warnings}
    private Object filter;           // {kept, dropped, stats, droppedVessels}
    private String conclusion;       // candidate | inconclusive
    private Object ranking;          // {margin, decisive, top_score}
    private Object rankedVessels;    // scientific-service ranked list (verbatim)
    private List<String> scoreWarnings;

    // Parameters.
    private double radiusKm;
    private double maxGapMin;
    private Long seed;

    // Timestamps.
    private Instant startTime;
    private Instant createdAt;

    private List<String> warnings;
    private List<String> errors;

    public String getAttributionRunId() { return attributionRunId; }
    public void setAttributionRunId(String attributionRunId) { this.attributionRunId = attributionRunId; }

    public String getSimulationId() { return simulationId; }
    public void setSimulationId(String simulationId) { this.simulationId = simulationId; }

    public String getBacktrackRunId() { return backtrackRunId; }
    public void setBacktrackRunId(String backtrackRunId) { this.backtrackRunId = backtrackRunId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAisSource() { return aisSource; }
    public void setAisSource(String aisSource) { this.aisSource = aisSource; }

    public String getSourceState() { return sourceState; }
    public void setSourceState(String sourceState) { this.sourceState = sourceState; }

    public String getDataset() { return dataset; }
    public void setDataset(String dataset) { this.dataset = dataset; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public Map<String, Double> getWeightsUsed() { return weightsUsed; }
    public void setWeightsUsed(Map<String, Double> weightsUsed) { this.weightsUsed = weightsUsed; }

    public Object getOrigin() { return origin; }
    public void setOrigin(Object origin) { this.origin = origin; }

    public Object getTimeRange() { return timeRange; }
    public void setTimeRange(Object timeRange) { this.timeRange = timeRange; }

    public Instant getReleaseTime() { return releaseTime; }
    public void setReleaseTime(Instant releaseTime) { this.releaseTime = releaseTime; }

    public Object getAisQuery() { return aisQuery; }
    public void setAisQuery(Object aisQuery) { this.aisQuery = aisQuery; }

    public Object getFilter() { return filter; }
    public void setFilter(Object filter) { this.filter = filter; }

    public String getConclusion() { return conclusion; }
    public void setConclusion(String conclusion) { this.conclusion = conclusion; }

    public Object getRanking() { return ranking; }
    public void setRanking(Object ranking) { this.ranking = ranking; }

    public Object getRankedVessels() { return rankedVessels; }
    public void setRankedVessels(Object rankedVessels) { this.rankedVessels = rankedVessels; }

    public List<String> getScoreWarnings() { return scoreWarnings; }
    public void setScoreWarnings(List<String> scoreWarnings) { this.scoreWarnings = scoreWarnings; }

    public double getRadiusKm() { return radiusKm; }
    public void setRadiusKm(double radiusKm) { this.radiusKm = radiusKm; }

    public double getMaxGapMin() { return maxGapMin; }
    public void setMaxGapMin(double maxGapMin) { this.maxGapMin = maxGapMin; }

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