package com.oilspill.app.investigation;

/**
 * Optional overrides for POST /api/investigation/{incidentId}/start. When a
 * field is omitted the investigation uses the frozen defaults from
 * {@link InvestigationParams}.
 */
public class StartInvestigationRequest {

    private String sarSource;
    private String sarDetector;
    private Integer maxCandidates;

    private Integer backtrackEnsembleSize;
    private Integer backtrackParticlesPerMember;
    private Double backtrackDurationHours;

    private Integer forwardDriftParticleCount;
    private Double forwardDriftDurationHours;

    private String environmentSource;
    private String aisSource;

    private Double radiusKm;
    private Double maxGapMin;
    private Long seed;

    public String getSarSource() { return sarSource; }
    public void setSarSource(String sarSource) { this.sarSource = sarSource; }

    public String getSarDetector() { return sarDetector; }
    public void setSarDetector(String sarDetector) { this.sarDetector = sarDetector; }

    public Integer getMaxCandidates() { return maxCandidates; }
    public void setMaxCandidates(Integer maxCandidates) { this.maxCandidates = maxCandidates; }

    public Integer getBacktrackEnsembleSize() { return backtrackEnsembleSize; }
    public void setBacktrackEnsembleSize(Integer backtrackEnsembleSize) { this.backtrackEnsembleSize = backtrackEnsembleSize; }

    public Integer getBacktrackParticlesPerMember() { return backtrackParticlesPerMember; }
    public void setBacktrackParticlesPerMember(Integer backtrackParticlesPerMember) { this.backtrackParticlesPerMember = backtrackParticlesPerMember; }

    public Double getBacktrackDurationHours() { return backtrackDurationHours; }
    public void setBacktrackDurationHours(Double backtrackDurationHours) { this.backtrackDurationHours = backtrackDurationHours; }

    public Integer getForwardDriftParticleCount() { return forwardDriftParticleCount; }
    public void setForwardDriftParticleCount(Integer forwardDriftParticleCount) { this.forwardDriftParticleCount = forwardDriftParticleCount; }

    public Double getForwardDriftDurationHours() { return forwardDriftDurationHours; }
    public void setForwardDriftDurationHours(Double forwardDriftDurationHours) { this.forwardDriftDurationHours = forwardDriftDurationHours; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

    public String getAisSource() { return aisSource; }
    public void setAisSource(String aisSource) { this.aisSource = aisSource; }

    public Double getRadiusKm() { return radiusKm; }
    public void setRadiusKm(Double radiusKm) { this.radiusKm = radiusKm; }

    public Double getMaxGapMin() { return maxGapMin; }
    public void setMaxGapMin(Double maxGapMin) { this.maxGapMin = maxGapMin; }

    public Long getSeed() { return seed; }
    public void setSeed(Long seed) { this.seed = seed; }
}