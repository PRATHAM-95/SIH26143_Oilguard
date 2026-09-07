package com.oilspill.app.simulation;

/**
 * Geographic region (lat/lon bounds) used to initialise a simulation.
 * Mirrors SYSTEM_SPEC §15.1 POST /api/simulation request body.
 */
public class Region {

    private double north;
    private double south;
    private double east;
    private double west;

    public Region() {
        // deserialization
    }

    public Region(double north, double south, double east, double west) {
        this.north = north;
        this.south = south;
        this.east = east;
        this.west = west;
    }

    public double getNorth() {
        return north;
    }

    public void setNorth(double north) {
        this.north = north;
    }

    public double getSouth() {
        return south;
    }

    public void setSouth(double south) {
        this.south = south;
    }

    public double getEast() {
        return east;
    }

    public void setEast(double east) {
        this.east = east;
    }

    public double getWest() {
        return west;
    }

    public void setWest(double west) {
        this.west = west;
    }

    /** Representative centre of the bounding box. */
    public double centreLon() {
        return (west + east) / 2.0;
    }

    public double centreLat() {
        return (south + north) / 2.0;
    }

    public boolean contains(double lat, double lon) {
        return lat >= south && lat <= north && lon >= west && lon <= east;
    }
}