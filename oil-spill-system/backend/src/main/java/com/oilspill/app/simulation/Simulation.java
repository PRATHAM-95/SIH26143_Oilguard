package com.oilspill.app.simulation;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Simulation aggregate root, mirroring SYSTEM_SPEC §13.1 `simulation` collection.
 */
@Document(collection = "simulation")
public class Simulation {

    @Id
    private String simulationId;

    private SimulationStatus status;

    private String mode;

    private Instant clock;

    private Region region;

    @Indexed
    private Instant createdAt;

    private Instant updatedAt;

    private String spillEventId;

    private String incidentId;

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public SimulationStatus getStatus() {
        return status;
    }

    public void setStatus(SimulationStatus status) {
        this.status = status;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Instant getClock() {
        return clock;
    }

    public void setClock(Instant clock) {
        this.clock = clock;
    }

    public Region getRegion() {
        return region;
    }

    public void setRegion(Region region) {
        this.region = region;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getSpillEventId() {
        return spillEventId;
    }

    public void setSpillEventId(String spillEventId) {
        this.spillEventId = spillEventId;
    }

    public String getIncidentId() {
        return incidentId;
    }

    public void setIncidentId(String incidentId) {
        this.incidentId = incidentId;
    }
}