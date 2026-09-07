package com.oilspill.app.vessel;

import java.time.Instant;

/**
 * A single historical position sample, mirroring SYSTEM_SPEC §13.1
 * `vessel.track[]` entries: { time, lat, lon, speed, heading }.
 */
public class TrackPoint {

    private Instant time;
    private double lat;
    private double lon;
    private double speed;
    private double heading;

    public TrackPoint() {
        // deserialization
    }

    public TrackPoint(Instant time, double lat, double lon, double speed, double heading) {
        this.time = time;
        this.lat = lat;
        this.lon = lon;
        this.speed = speed;
        this.heading = heading;
    }

    public Instant getTime() {
        return time;
    }

    public void setTime(Instant time) {
        this.time = time;
    }

    public double getLat() {
        return lat;
    }

    public void setLat(double lat) {
        this.lat = lat;
    }

    public double getLon() {
        return lon;
    }

    public void setLon(double lon) {
        this.lon = lon;
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
}