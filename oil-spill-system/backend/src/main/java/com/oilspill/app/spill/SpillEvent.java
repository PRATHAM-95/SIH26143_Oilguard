package com.oilspill.app.spill;

import com.oilspill.app.vessel.GeoPoint;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Application-level oil spill event, mirroring SYSTEM_SPEC §13.1 `spill_event`.
 *
 * At Step 04 this is an application event only — it does NOT run OpenOil.
 * forwardSimulation is intentionally left empty until the science stage.
 */
@Document(collection = "spill_event")
public class SpillEvent {

    @Id
    private String spillEventId;

    @Indexed
    private String simulationId;

    private String vesselId;

    /** GeoJSON Point, coordinates [lon, lat]. */
    private GeoPoint location;

    @Indexed(direction = IndexDirection.DESCENDING)
    private Instant time;

    private String oilType;

    private double quantityKg;

    /** accidental | illegal */
    private String type;

    /** True = this is the hidden ground truth. */
    private boolean isGroundTruth;

    public String getSpillEventId() {
        return spillEventId;
    }

    public void setSpillEventId(String spillEventId) {
        this.spillEventId = spillEventId;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getVesselId() {
        return vesselId;
    }

    public void setVesselId(String vesselId) {
        this.vesselId = vesselId;
    }

    public GeoPoint getLocation() {
        return location;
    }

    public void setLocation(GeoPoint location) {
        this.location = location;
    }

    public Instant getTime() {
        return time;
    }

    public void setTime(Instant time) {
        this.time = time;
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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public boolean isGroundTruth() {
        return isGroundTruth;
    }

    public void setGroundTruth(boolean groundTruth) {
        isGroundTruth = groundTruth;
    }
}