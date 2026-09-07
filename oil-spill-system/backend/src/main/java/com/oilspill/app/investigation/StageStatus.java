package com.oilspill.app.investigation;

public enum StageStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
    SKIPPED,
    UNAVAILABLE;

    public static boolean isTerminal(StageStatus status) {
        return status == COMPLETED || status == FAILED || status == SKIPPED || status == UNAVAILABLE;
    }

    public static boolean isSkippedOrUnavailable(StageStatus status) {
        return status == SKIPPED || status == UNAVAILABLE;
    }
}