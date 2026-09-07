package com.oilspill.app.investigation;

import java.util.List;

public final class StageIds {

    public static final String DETECTION = "detection";
    public static final String CHARACTERIZATION = "characterization";
    public static final String ENVIRONMENT = "environment";
    public static final String FORWARD_DRIFT = "forward_drift";
    public static final String BACKTRACKING = "backtracking";
    public static final String AIS = "ais";
    public static final String ATTRIBUTION = "attribution";
    public static final String CONCLUSION = "conclusion";

    public static final List<String> ORDER = List.of(
            DETECTION, CHARACTERIZATION, ENVIRONMENT, FORWARD_DRIFT,
            BACKTRACKING, AIS, ATTRIBUTION, CONCLUSION);

    private StageIds() {
    }
}