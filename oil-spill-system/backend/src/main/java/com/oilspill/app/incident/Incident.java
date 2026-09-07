package com.oilspill.app.incident;

import com.oilspill.app.vessel.GeoPoint;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Incident record, mirroring SYSTEM_SPEC §13.1 `incident` collection.
 *
 * At Step 04 the incident is created from the synthetic spill so that an
 * investigation can be targeted later; the scientific observation fields
 * (geometry, area, detectionConfidence...) are intentionally left empty until
 * the detection/characterization stage. The spill origin is carried as the
 * incident's reference centre and is NOT exposed as ground truth.
 */
@Document(collection = "incident")
public class Incident {

    @Id
    private String incidentId;

    @Indexed
    private String simulationId;

    private String spillEventId;

    private Instant observedTime;

    /** Reference centre (GeoJSON Point, [lon, lat]) — NOT ground truth. */
    private GeoPoint centroid;

    private String status = "created";

    public String getIncidentId() {
        return incidentId;
    }

    public void setIncidentId(String incidentId) {
        this.incidentId = incidentId;
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

    public Instant getObservedTime() {
        return observedTime;
    }

    public void setObservedTime(Instant observedTime) {
        this.observedTime = observedTime;
    }

    public GeoPoint getCentroid() {
        return centroid;
    }

    public void setCentroid(GeoPoint centroid) {
        this.centroid = centroid;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}