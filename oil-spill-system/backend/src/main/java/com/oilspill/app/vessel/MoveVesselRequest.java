package com.oilspill.app.vessel;

/**
 * POST /api/simulation/{id}/vessels/{vesselId}/move request body:
 * { latitude, longitude, speed, heading }.
 */
public class MoveVesselRequest {

    private double latitude;
    private double longitude;
    private double speed;
    private double heading;

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
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