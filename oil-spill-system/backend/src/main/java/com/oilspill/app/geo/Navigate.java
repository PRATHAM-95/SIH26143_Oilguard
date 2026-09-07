package com.oilspill.app.geo;

/**
 * Deterministic, simplified great-circle navigation used by the Captain Mode
 * simulation. This is a VISUAL/application-level model for live demo — it is
 * intentionally NOT a full ship-physics or navigational model, and must not be
 * presented as such. Output is fully deterministic given the same inputs.
 */
public final class Navigate {

    private static final double EARTH_RADIUS_M = 6371000.0;
    /** Nautical miles per degree of latitude. */
    private static final double NM_PER_DEG = 60.0;

    private Navigate() {
    }

    /**
     * Advance a position by constant speed + heading for a duration.
     *
     * @param startLat   starting latitude (degrees, +north)
     * @param startLon   starting longitude (degrees, +east)
     * @param speedKn    speed in knots
     * @param headingDeg heading in degrees (0 = north, 90 = east, clockwise)
     * @param hours      elapsed time in hours
     * @return { lat, lon } after the step
     */
    public static double[] advance(double startLat, double startLon, double speedKn,
                                   double headingDeg, double hours) {
        double distanceNmi = speedKn * hours;                      // nautical miles travelled
        double dDeg = distanceNmi / NM_PER_DEG;                    // 1 nmi = 1/60 degree of arc
        double dRad = Math.toRadians(dDeg);                        // angular distance in radians
        double lat1 = Math.toRadians(startLat);
        double lon1 = Math.toRadians(startLon);
        double bearing = Math.toRadians(headingDeg);

        double lat2 = Math.asin(
                Math.sin(lat1) * Math.cos(dRad)
                        + Math.cos(lat1) * Math.sin(dRad) * Math.cos(bearing));

        double lon2 = lon1 + Math.atan2(
                Math.sin(bearing) * Math.sin(dRad) * Math.cos(lat1),
                Math.cos(dRad) - Math.sin(lat1) * Math.sin(lat2));

        return new double[]{Math.toDegrees(lat2), Math.toDegrees(lon2)};
    }

    /** Haversine great-circle distance in metres. */
    public static double distanceMetres(double lat1, double lon1, double lat2, double lon2) {
        double p1 = Math.toRadians(lat1);
        double p2 = Math.toRadians(lat2);
        double dp = Math.toRadians(lat2 - lat1);
        double dl = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dp / 2) * Math.sin(dp / 2)
                + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }

    /** Utility to convert known seed values to a heading-aware note-free helper. */
    public static double metersToKm(double metres) {
        return metres / 1000.0;
    }
}