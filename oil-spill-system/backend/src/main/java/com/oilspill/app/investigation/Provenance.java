package com.oilspill.app.investigation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Provenance vocabulary for the investigation evidence chain.
 *
 * Raw scientific-service states are mapped onto one of
 * REAL | CONTROLLED | FIXTURE | UNAVAILABLE (never invented), then the whole
 * investigation is labelled with an aggregate:
 *
 *   any UNAVAILABLE            -> PARTIAL
 *   all REAL                   -> ALL_REAL
 *   any REAL or FIXTURE        -> MIXED
 *   otherwise                  -> ALL_CONTROLLED
 *
 * The kata "all REAL" cannot occur in this build (AIS/environment/drift are
 * CONTROLLED), but the rule is kept for future real inputs.
 */
public final class Provenance {

    public static final String REAL = "REAL";
    public static final String CONTROLLED = "CONTROLLED";
    public static final String FIXTURE = "FIXTURE";
    public static final String UNAVAILABLE = "UNAVAILABLE";

    public static final String AGG_ALL_REAL = "ALL_REAL";
    public static final String AGG_ALL_CONTROLLED = "ALL_CONTROLLED";
    public static final String AGG_MIXED = "MIXED";
    public static final String AGG_PARTIAL = "PARTIAL";

    private static final Map<String, String> NORMALIZATION = Map.ofEntries(
            Map.entry("REAL_SENTINEL1", REAL),
            Map.entry("CACHED_SENTINEL1", FIXTURE),
            Map.entry("LOCAL_FIXTURE", FIXTURE),
            Map.entry("SYNTHETIC", CONTROLLED),
            Map.entry("SYNTHETIC_AIS", CONTROLLED),
            Map.entry("CONTROLLED", CONTROLLED),
            Map.entry("UNAVAILABLE", UNAVAILABLE),
            Map.entry("GFW", REAL),
            Map.entry("MARINE_CADASTRE", REAL),
            Map.entry("AISSTREAM", REAL));

    private Provenance() {
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNAVAILABLE;
        }
        return NORMALIZATION.getOrDefault(raw.trim().toUpperCase(), UNAVAILABLE);
    }

    public static String aggregate(List<String> perStageNormalized) {
        if (perStageNormalized == null || perStageNormalized.isEmpty()) {
            return AGG_PARTIAL;
        }
        boolean anyUnavailable = false;
        boolean allReal = true;
        boolean anyRealOrFixture = false;
        boolean allControlled = true;
        for (String p : perStageNormalized) {
            if (UNAVAILABLE.equals(p)) {
                anyUnavailable = true;
            }
            if (!REAL.equals(p)) {
                allReal = false;
            }
            if (REAL.equals(p) || FIXTURE.equals(p)) {
                anyRealOrFixture = true;
            }
            if (!CONTROLLED.equals(p)) {
                allControlled = false;
            }
        }
        if (anyUnavailable) {
            return AGG_PARTIAL;
        }
        if (allReal) {
            return AGG_ALL_REAL;
        }
        if (anyRealOrFixture) {
            return AGG_MIXED;
        }
        if (allControlled) {
            return AGG_ALL_CONTROLLED;
        }
        return AGG_PARTIAL;
    }

    public static List<String> normalizedValues(List<String> rawValues) {
        List<String> out = new ArrayList<>();
        for (String raw : rawValues) {
            out.add(normalize(raw));
        }
        return out;
    }

    public static String sha256(String canonical) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("sha-256 unavailable", e);
        }
    }
}