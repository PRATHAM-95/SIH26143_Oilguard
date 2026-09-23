package com.oilspill.app.investigation;

/**
 * Replayable parameter set chosen once when an investigation starts. Every
 * value is persisted with the investigation so a retry/recovery is
 * deterministic and the report can state exactly what was used.
 */
public class InvestigationParams {

    // SAR detection
    public static final String DEFAULT_SAR_SOURCE = "LOCAL_FIXTURE";
    public static final String DEFAULT_SAR_DETECTOR = "CLASSICAL";
    public static final int DEFAULT_MAX_CANDIDATES = 6;

    // Backtracking ensemble
    public static final int DEFAULT_BACKTRACK_ENSEMBLE_SIZE = 20;
    public static final int DEFAULT_BACKTRACK_PARTICLES_PER_MEMBER = 200;
    public static final double DEFAULT_BACKTRACK_DURATION_HOURS = 6.0;

    // Forward drift
    public static final int DEFAULT_FORWARD_DRIFT_PARTICLE_COUNT = 500;
    public static final double DEFAULT_FORWARD_DRIFT_DURATION_HOURS = 6.0;

    // Environment / AIS provenance (no AIS feeds in this build; environment
    // defaults to LIVE = real Open-Meteo wind, falling back to CONTROLLED in
    // the scientific service when the feed is offline)
    public static final String DEFAULT_ENVIRONMENT_SOURCE = "LIVE";
    public static final String DEFAULT_AIS_SOURCE = "CONTROLLED";

    // Attribution search geometry
    public static final double DEFAULT_RADIUS_KM = 150.0;
    public static final double DEFAULT_MAX_GAP_MIN = 30.0;

    public static final long DEFAULT_SEED = 26143L;

    private String sarSource = DEFAULT_SAR_SOURCE;
    private String sarDetector = DEFAULT_SAR_DETECTOR;
    private int maxCandidates = DEFAULT_MAX_CANDIDATES;

    private int backtrackEnsembleSize = DEFAULT_BACKTRACK_ENSEMBLE_SIZE;
    private int backtrackParticlesPerMember = DEFAULT_BACKTRACK_PARTICLES_PER_MEMBER;
    private double backtrackDurationHours = DEFAULT_BACKTRACK_DURATION_HOURS;

    private int forwardDriftParticleCount = DEFAULT_FORWARD_DRIFT_PARTICLE_COUNT;
    private double forwardDriftDurationHours = DEFAULT_FORWARD_DRIFT_DURATION_HOURS;

    private String environmentSource = DEFAULT_ENVIRONMENT_SOURCE;
    private String aisSource = DEFAULT_AIS_SOURCE;

    private double radiusKm = DEFAULT_RADIUS_KM;
    private double maxGapMin = DEFAULT_MAX_GAP_MIN;

    private long seed = DEFAULT_SEED;

    public String getSarSource() { return sarSource; }
    public void setSarSource(String sarSource) { this.sarSource = sarSource; }

    public String getSarDetector() { return sarDetector; }
    public void setSarDetector(String sarDetector) { this.sarDetector = sarDetector; }

    public int getMaxCandidates() { return maxCandidates; }
    public void setMaxCandidates(int maxCandidates) { this.maxCandidates = maxCandidates; }

    public int getBacktrackEnsembleSize() { return backtrackEnsembleSize; }
    public void setBacktrackEnsembleSize(int backtrackEnsembleSize) { this.backtrackEnsembleSize = backtrackEnsembleSize; }

    public int getBacktrackParticlesPerMember() { return backtrackParticlesPerMember; }
    public void setBacktrackParticlesPerMember(int backtrackParticlesPerMember) { this.backtrackParticlesPerMember = backtrackParticlesPerMember; }

    public double getBacktrackDurationHours() { return backtrackDurationHours; }
    public void setBacktrackDurationHours(double backtrackDurationHours) { this.backtrackDurationHours = backtrackDurationHours; }

    public int getForwardDriftParticleCount() { return forwardDriftParticleCount; }
    public void setForwardDriftParticleCount(int forwardDriftParticleCount) { this.forwardDriftParticleCount = forwardDriftParticleCount; }

    public double getForwardDriftDurationHours() { return forwardDriftDurationHours; }
    public void setForwardDriftDurationHours(double forwardDriftDurationHours) { this.forwardDriftDurationHours = forwardDriftDurationHours; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

    public String getAisSource() { return aisSource; }
    public void setAisSource(String aisSource) { this.aisSource = aisSource; }

    public double getRadiusKm() { return radiusKm; }
    public void setRadiusKm(double radiusKm) { this.radiusKm = radiusKm; }

    public double getMaxGapMin() { return maxGapMin; }
    public void setMaxGapMin(double maxGapMin) { this.maxGapMin = maxGapMin; }

    public long getSeed() { return seed; }
    public void setSeed(long seed) { this.seed = seed; }
}