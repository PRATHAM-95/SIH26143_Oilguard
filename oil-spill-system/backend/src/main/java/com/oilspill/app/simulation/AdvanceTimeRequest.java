package com.oilspill.app.simulation;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * POST /api/simulation/{id}/advance request body: { hours }.
 */
public class AdvanceTimeRequest {

    @NotNull
    @Min(value = 1, message = "hours must be >= 1")
    @Max(value = 120, message = "hours must be <= 120")
    private Integer hours;

    public Integer getHours() {
        return hours;
    }

    public void setHours(Integer hours) {
        this.hours = hours;
    }
}