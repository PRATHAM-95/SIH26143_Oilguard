package com.oilspill.app.simulation;

/**
 * Simulation lifecycle, per SYSTEM_SPEC §13.1 `simulation.status`.
 *
 * Lifecycle: captain_mode -> simulating -> observation -> investigation -> completed.
 */
public enum SimulationStatus {
    /** Created, awaiting captain start. */
    captain_mode,
    /** Captain has started; the clock can be advanced. */
    simulating,
    /** A spill has been released; synthetic observation pending. */
    observation,
    /** An investigation has been started against the synthetic observation. */
    investigation,
    /** Investigation complete. */
    completed;

    public static boolean canStart(SimulationStatus from) {
        return from == captain_mode;
    }

    public static boolean canAdvance(SimulationStatus from) {
        return from == simulating;
    }

    public static boolean canSpill(SimulationStatus from) {
        return from == simulating;
    }
}