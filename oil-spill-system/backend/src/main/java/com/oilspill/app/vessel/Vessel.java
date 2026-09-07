package com.oilspill.app.vessel;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Captain-mode controlled vessel, mirroring SYSTEM_SPEC §13.1 `vessel` collection.
 * This is a controlled simulation vessel, not a full AIS engine.
 */
@Document(collection = "vessel")
public class Vessel {

    @Id
    private String vesselId;

    @Indexed
    private String simulationId;

    private String mmsi;
    @Indexed
    private String imo;
    private String name;
    private String type;
    private double length;
    private double beam;
    private double draft;

    /** GeoJSON Point, coordinates [lon, lat]. */
    private GeoPoint position;

    private double speed;
    private double heading;
    private double course;

    /** Historical waypoints (time, lat, lon, speed, heading). */
    private List<TrackPoint> track = new ArrayList<>();

    private boolean isSimulated = true;

    public void addTrackPoint(TrackPoint tp) {
        if (track == null) {
            track = new ArrayList<>();
        }
        track.add(tp);
    }

    public String getVesselId() {
        return vesselId;
    }

    public void setVesselId(String vesselId) {
        this.vesselId = vesselId;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getMmsi() {
        return mmsi;
    }

    public void setMmsi(String mmsi) {
        this.mmsi = mmsi;
    }

    public String getImo() {
        return imo;
    }

    public void setImo(String imo) {
        this.imo = imo;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getLength() {
        return length;
    }

    public void setLength(double length) {
        this.length = length;
    }

    public double getBeam() {
        return beam;
    }

    public void setBeam(double beam) {
        this.beam = beam;
    }

    public double getDraft() {
        return draft;
    }

    public void setDraft(double draft) {
        this.draft = draft;
    }

    public GeoPoint getPosition() {
        return position;
    }

    public void setPosition(GeoPoint position) {
        this.position = position;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public double getHeading() {
        return heading;
    }

    public void setHeading(double heading) {
        this.heading = heading;
    }

    public double getCourse() {
        return course;
    }

    public void setCourse(double course) {
        this.course = course;
    }

    public List<TrackPoint> getTrack() {
        return track;
    }

    public void setTrack(List<TrackPoint> track) {
        this.track = track;
    }

    public boolean isSimulated() {
        return isSimulated;
    }

    public void setSimulated(boolean simulated) {
        isSimulated = simulated;
    }
}