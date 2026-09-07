package com.oilspill.app.spill;

/**
 * POST /api/simulation/{id}/vessels/{vesselId}/spill request body:
 * { type, oilType, quantityKg }.
 */
public class SpillRequest {

    /** accidental | illegal */
    private String type = "accidental";
    private String oilType = "GENERIC CRUDE";
    private double quantityKg = 5000;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getOilType() {
        return oilType;
    }

    public void setOilType(String oilType) {
        this.oilType = oilType;
    }

    public double getQuantityKg() {
        return quantityKg;
    }

    public void setQuantityKg(double quantityKg) {
        this.quantityKg = quantityKg;
    }
}