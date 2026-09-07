package com.oilspill.app.vessel;

/**
 * Minimal GeoJSON representation for Mongo $geo queries.
 * coordinates = [longitude, latitude].
 */
public class GeoPoint {

    private String type = "Point";
    private double[] coordinates;

    public GeoPoint() {
        // deserialization
    }

    public GeoPoint(double lon, double lat) {
        this.coordinates = new double[]{lon, lat};
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double[] getCoordinates() {
        return coordinates;
    }

    public void setCoordinates(double[] coordinates) {
        this.coordinates = coordinates;
    }

    public double lon() {
        return coordinates[0];
    }

    public double lat() {
        return coordinates[1];
    }
}