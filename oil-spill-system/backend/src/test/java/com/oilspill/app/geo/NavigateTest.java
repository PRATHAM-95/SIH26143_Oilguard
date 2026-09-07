package com.oilspill.app.geo;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NavigateTest {

    @Test
    void movingNorthAtOneKnotForOneHourAdvancesApproxOneNmi() {
        double[] r = Navigate.advance(10.0, 72.0, 1.0, 0.0, 1.0);
        // 1 knot * 1h = 1 nautical mile = 1/60 degree of latitude
        assertEquals(10.0 + (1.0 / 60.0), r[0], 1e-6);
        assertEquals(72.0, r[1], 1e-9);
    }

    @Test
    void movingEastAtOneKnotAtEquatorAdvancesOneNmiOfLongitude() {
        double[] r = Navigate.advance(0.0, 72.0, 1.0, 90.0, 1.0);
        assertEquals(0.0, r[0], 1e-9);
        // at cos(lat)=1, 1 nmi east = 1/60 degree longitude
        assertEquals(72.0 + (1.0 / 60.0), r[1], 1e-6);
    }

    @Test
    void zeroSpeedDoesNotMove() {
        double[] r = Navigate.advance(10.0, 72.0, 0.0, 45.0, 6.0);
        assertEquals(10.0, r[0], 1e-9);
        assertEquals(72.0, r[1], 1e-9);
    }

    @Test
    void deterministicOutputForIdenticalInput() {
        double[] a = Navigate.advance(10.0, 72.0, 12.0, 45.0, 6.0);
        double[] b = Navigate.advance(10.0, 72.0, 12.0, 45.0, 6.0);
        assertEquals(a[0], b[0], 0.0);
        assertEquals(a[1], b[1], 0.0);
    }

    @Test
    void twelveKnotsForSixHoursMovesTwelveNmiOfArc() {
        double[] r = Navigate.advance(10.0, 72.0, 12.0, 0.0, 6.0);
        double expectedLat = 10.0 + (12.0 * 6.0) / 60.0; // 1.2 degrees
        assertEquals(expectedLat, r[0], 1e-6);
    }

    @Test
    void distanceSymmetryish() {
        double d = Navigate.distanceMetres(10.0, 72.0, 10.0 + (12.0 * 6.0) / 60.0, 72.0);
        // 12 nmi for 6h at 12 knots = 72 nmi ~ 133.3 km
        assertTrue(Math.abs(Navigate.metersToKm(d) - 133.3) < 0.5, "distance near expected");
    }
}