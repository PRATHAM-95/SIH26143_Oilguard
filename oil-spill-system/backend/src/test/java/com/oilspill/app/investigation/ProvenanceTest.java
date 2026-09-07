package com.oilspill.app.investigation;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProvenanceTest {

    @Test
    void normalizesRawScientificStates() {
        assertEquals(Provenance.REAL, Provenance.normalize("REAL_SENTINEL1"));
        assertEquals(Provenance.FIXTURE, Provenance.normalize("CACHED_SENTINEL1"));
        assertEquals(Provenance.FIXTURE, Provenance.normalize("LOCAL_FIXTURE"));
        assertEquals(Provenance.CONTROLLED, Provenance.normalize("SYNTHETIC"));
        assertEquals(Provenance.CONTROLLED, Provenance.normalize("CONTROLLED"));
        assertEquals(Provenance.UNAVAILABLE, Provenance.normalize("UNAVAILABLE"));
        assertEquals(Provenance.REAL, Provenance.normalize("GFW"));
    }

    @Test
    void unknownAndBlankMapToUnavailable() {
        assertEquals(Provenance.UNAVAILABLE, Provenance.normalize("MYSTERY_FEED"));
        assertEquals(Provenance.UNAVAILABLE, Provenance.normalize(""));
        assertEquals(Provenance.UNAVAILABLE, Provenance.normalize(null));
    }

    @Test
    void anyUnavailableAggregatesPartial() {
        assertEquals(Provenance.AGG_PARTIAL,
                Provenance.aggregate(List.of(Provenance.REAL, Provenance.CONTROLLED, Provenance.UNAVAILABLE)));
    }

    @Test
    void allRealAggregatesAllReal() {
        assertEquals(Provenance.AGG_ALL_REAL,
                Provenance.aggregate(List.of(Provenance.REAL, Provenance.REAL)));
    }

    @Test
    void anyRealOrFixtureAggregatesMixed() {
        assertEquals(Provenance.AGG_MIXED,
                Provenance.aggregate(List.of(Provenance.FIXTURE, Provenance.CONTROLLED)));
        assertEquals(Provenance.AGG_MIXED,
                Provenance.aggregate(List.of(Provenance.REAL, Provenance.CONTROLLED)));
    }

    @Test
    void allControlledAggregatesAllControlled() {
        assertEquals(Provenance.AGG_ALL_CONTROLLED,
                Provenance.aggregate(List.of(Provenance.CONTROLLED, Provenance.CONTROLLED)));
    }

    @Test
    void emptySetIsPartial() {
        assertEquals(Provenance.AGG_PARTIAL, Provenance.aggregate(List.of()));
    }
}