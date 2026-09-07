package com.oilspill.app.investigation;

public enum InvestigationStatus {
    CREATED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED;

    public static boolean isActive(InvestigationStatus status) {
        return status == CREATED || status == RUNNING;
    }
}