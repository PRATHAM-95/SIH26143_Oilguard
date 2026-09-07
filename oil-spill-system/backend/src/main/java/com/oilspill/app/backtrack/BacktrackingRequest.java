package com.oilspill.app.backtrack;

import jakarta.validation.constraints.Min;

/**
 * Request DTO for POST /api/simulation/{id}/backtrack.
 */
public class BacktrackingRequest {

    @Min(1)
    private Double durationHours;

    @Min(2)
    private Integer ensembleSize;

    @Min(10)
    private Integer particlesPerMember;

    private String environmentSource;

    private Double seed;

    /** Optional SAR observation (step 09 operated on a SAR-detected slick). */
    private String sarObservationId;

    private Forcing currents;
    private Forcing wind;

    // Getters and setters.

    public Double getDurationHours() { return durationHours; }
    public void setDurationHours(Double durationHours) { this.durationHours = durationHours; }

    public Integer getEnsembleSize() { return ensembleSize; }
    public void setEnsembleSize(Integer ensembleSize) { this.ensembleSize = ensembleSize; }

    public Integer getParticlesPerMember() { return particlesPerMember; }
    public void setParticlesPerMember(Integer particlesPerMember) { this.particlesPerMember = particlesPerMember; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

    public Double getSeed() { return seed; }
    public void setSeed(Double seed) { this.seed = seed; }

    public String getSarObservationId() { return sarObservationId; }
    public void setSarObservationId(String sarObservationId) { this.sarObservationId = sarObservationId; }

    public Forcing getCurrents() { return currents; }
    public void setCurrents(Forcing currents) { this.currents = currents; }

    public Forcing getWind() { return wind; }
    public void setWind(Forcing wind) { this.wind = wind; }

    public static class Forcing {
        private double u = 0.0;
        private double v = 0.0;

        public double getU() { return u; }
        public void setU(double u) { this.u = u; }
        public double getV() { return v; }
        public void setV(double v) { this.v = v; }
    }
}
