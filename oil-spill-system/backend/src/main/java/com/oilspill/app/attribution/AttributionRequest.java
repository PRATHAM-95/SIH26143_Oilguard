package com.oilspill.app.attribution;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for POST /api/attribution/run (STEP 10).
 *
 * The run is anchored on a simulation (its backtracking results when present).
 * An explicit ``backtrackRunId`` pins the run to a specific ensemble; otherwise
 * the most recent backtracking run for the simulation is used.
 */
public class AttributionRequest {

    @NotBlank
    private String simulationId;

    /** Optional: pin the run to a specific backtracking ensemble result. */
    private String backtrackRunId;

    /** AIS provider source; only "CONTROLLED" is available in this build, others fail honestly. */
    private String aisSource;

    private Long seed;

    @Min(1)
    private Double radiusKm;

    @Min(5)
    private Double maxGapMin;

    /** Label recorded for provenance. Real (CMEMS/ERA5) forcing requires credentials and is
     *  never assumed; when omitted the environmental factor stays neutral with a warning. */
    private String environmentSource;

    /** Optional client-supplied forcing passed through to the scientific scorer. */
    private Forcing currents;
    private Forcing wind;

    public String getSimulationId() { return simulationId; }
    public void setSimulationId(String simulationId) { this.simulationId = simulationId; }

    public String getBacktrackRunId() { return backtrackRunId; }
    public void setBacktrackRunId(String backtrackRunId) { this.backtrackRunId = backtrackRunId; }

    public String getAisSource() { return aisSource; }
    public void setAisSource(String aisSource) { this.aisSource = aisSource; }

    public Long getSeed() { return seed; }
    public void setSeed(Long seed) { this.seed = seed; }

    public Double getRadiusKm() { return radiusKm; }
    public void setRadiusKm(Double radiusKm) { this.radiusKm = radiusKm; }

    public Double getMaxGapMin() { return maxGapMin; }
    public void setMaxGapMin(Double maxGapMin) { this.maxGapMin = maxGapMin; }

    public String getEnvironmentSource() { return environmentSource; }
    public void setEnvironmentSource(String environmentSource) { this.environmentSource = environmentSource; }

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