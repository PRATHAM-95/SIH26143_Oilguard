package com.oilspill.app.simulation;

import jakarta.validation.constraints.NotNull;

/**
 * POST /api/simulation request body: { region:{north,south,east,west}, mode }.
 */
public class CreateSimulationRequest {

    @NotNull
    private Region region;

    /** "captain" | "investigation" (default captain). */
    private String mode = "captain";

    public Region getRegion() {
        return region;
    }

    public void setRegion(Region region) {
        this.region = region;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }
}