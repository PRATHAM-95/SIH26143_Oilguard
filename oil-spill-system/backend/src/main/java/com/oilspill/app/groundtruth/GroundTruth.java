package com.oilspill.app.groundtruth;

import com.oilspill.app.vessel.GeoPoint;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * HIDDEN ground truth, mirroring SYSTEM_SPEC §13.1 `ground_truth` collection.
 *
 * GROUND-TRUTH ISOLATION (SYSTEM_SPEC §14): this is a SEPARATE collection.
 * No simulation/investigation endpoint may return these fields. The ONLY
 * reader is the reveal flow (POST /investigation/{id}/reveal), which is
 * implemented in a later step. No service here ever exposes actualOrigin,
 * actualVesselId, actualSpillTime, actualOilType or actualQuantityKg.
 */
@Document(collection = "ground_truth")
public class GroundTruth {

    @Id
    private String groundTruthId;

    @Indexed(unique = true)
    private String simulationId;

    private String spillEventId;

    private String actualVesselId;

    /** GeoJSON Point, coordinates [lon, lat]. */
    private GeoPoint actualOrigin;

    private Instant actualSpillTime;

    private String actualOilType;

    private double actualQuantityKg;

    private Instant revealedAt;

    public String getGroundTruthId() {
        return groundTruthId;
    }

    public void setGroundTruthId(String groundTruthId) {
        this.groundTruthId = groundTruthId;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getSpillEventId() {
        return spillEventId;
    }

    public void setSpillEventId(String spillEventId) {
        this.spillEventId = spillEventId;
    }

    public String getActualVesselId() {
        return actualVesselId;
    }

    public void setActualVesselId(String actualVesselId) {
        this.actualVesselId = actualVesselId;
    }

    public GeoPoint getActualOrigin() {
        return actualOrigin;
    }

    public void setActualOrigin(GeoPoint actualOrigin) {
        this.actualOrigin = actualOrigin;
    }

    public Instant getActualSpillTime() {
        return actualSpillTime;
    }

    public void setActualSpillTime(Instant actualSpillTime) {
        this.actualSpillTime = actualSpillTime;
    }

    public String getActualOilType() {
        return actualOilType;
    }

    public void setActualOilType(String actualOilType) {
        this.actualOilType = actualOilType;
    }

    public double getActualQuantityKg() {
        return actualQuantityKg;
    }

    public void setActualQuantityKg(double actualQuantityKg) {
        this.actualQuantityKg = actualQuantityKg;
    }

    public Instant getRevealedAt() {
        return revealedAt;
    }

    public void setRevealedAt(Instant revealedAt) {
        this.revealedAt = revealedAt;
    }
}