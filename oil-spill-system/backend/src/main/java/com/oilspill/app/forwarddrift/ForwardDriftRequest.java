package com.oilspill.app.forwarddrift;

/**
 * Request body for POST /api/simulation/{id}/forward-drift.
 *
 * Values are optional overrides; the service resolves defaults from the
 * simulation's active spill event (origin, time, oil type) where omitted.
 */
public class ForwardDriftRequest {

    private Double durationHours;
    private String oilType;
    private Integer particleCount;
    private String environmentSource;
    private Forcing currents;
    private Forcing wind;

    public Double getDurationHours() {
        return durationHours;
    }

    public void setDurationHours(Double durationHours) {
        this.durationHours = durationHours;
    }

    public String getOilType() {
        return oilType;
    }

    public void setOilType(String oilType) {
        this.oilType = oilType;
    }

    public Integer getParticleCount() {
        return particleCount;
    }

    public void setParticleCount(Integer particleCount) {
        this.particleCount = particleCount;
    }

    public String getEnvironmentSource() {
        return environmentSource;
    }

    public void setEnvironmentSource(String environmentSource) {
        this.environmentSource = environmentSource;
    }

    public Forcing getCurrents() {
        return currents;
    }

    public void setCurrents(Forcing currents) {
        this.currents = currents;
    }

    public Forcing getWind() {
        return wind;
    }

    public void setWind(Forcing wind) {
        this.wind = wind;
    }

    /** u/v velocity forcing in m/s. */
    public static class Forcing {
        private double u;
        private double v;

        public double getU() {
            return u;
        }

        public void setU(double u) {
            this.u = u;
        }

        public double getV() {
            return v;
        }

        public void setV(double v) {
            this.v = v;
        }
    }
}