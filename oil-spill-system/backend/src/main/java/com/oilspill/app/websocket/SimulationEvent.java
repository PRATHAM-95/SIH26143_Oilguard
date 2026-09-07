package com.oilspill.app.websocket;

/**
 * Server -> client simulation event frame, mirroring SYSTEM_SPEC §15.3.
 * Serialised to JSON and pushed over the raw WebSocket to /ws/simulation/{id}.
 *
 * A single class with nullable fields keeps the wire contract flat and
 * type-discriminated (frontend `isWsEvent` checks `.type`); only the fields
 * relevant to a given event type are populated.
 */
public class SimulationEvent {

    public static final String TYPE_CLOCK = "clock_update";
    public static final String TYPE_VESSEL_MOVED = "vessel_moved";
    public static final String TYPE_SPILL_RELEASED = "spill_released";
    public static final String TYPE_OIL_PARTICLES = "oil_particles";
    public static final String TYPE_FORWARD_DRIFT_STARTED = "forward_drift.started";
    public static final String TYPE_FORWARD_DRIFT_COMPLETED = "forward_drift.completed";
    public static final String TYPE_FORWARD_DRIFT_FAILED = "forward_drift.failed";

    // sar_observation (Step 07)
    public static final String TYPE_SAR_OBSERVATION_STARTED = "sar_observation.started";
    public static final String TYPE_SAR_OBSERVATION_COMPLETED = "sar_observation.completed";
    public static final String TYPE_SAR_OBSERVATION_FAILED = "sar_observation.failed";

    // backtracking (Step 09)
    public static final String TYPE_BACKTRACKING_STARTED = "backtracking.started";
    public static final String TYPE_BACKTRACKING_COMPLETED = "backtracking.completed";
    public static final String TYPE_BACKTRACKING_FAILED = "backtracking.failed";
    public static final String TYPE_ORIGIN_ESTIMATED = "origin_estimated";

    // attribution / AIS (Step 10)
    public static final String TYPE_AIS_SEARCH_STARTED = "ais_search.started";
    public static final String TYPE_AIS_SEARCH_COMPLETED = "ais_search.completed";
    public static final String TYPE_AIS_SEARCH_FAILED = "ais_search.failed";
    public static final String TYPE_VESSELS_FILTERED = "vessels_filtered";
    public static final String TYPE_ATTRIBUTION_STARTED = "attribution.started";
    public static final String TYPE_VESSEL_SCORES_READY = "vessel_scores_ready";
    public static final String TYPE_ATTRIBUTION_COMPLETED = "attribution.completed";

    private String type;
    private String simulationId;

    // clock_update
    private String time;

    // vessel_moved
    private String vesselId;
    private double speed;
    private double heading;
    private Position position;

    // spill_released
    private String spillEventId;
    private String quantityLabel;

    // forward_drift.started / completed / failed
    private String forwardDriftRunId;
    private String message;

    // sar_observation (Step 07)
    private String sarObservationId;
    private Object sarResult;

    // oil_particles (§15.3): lightweight map view of the particle field
    private Object particles;

    // backtracking (Step 09)
    private String backtrackRunId;
    private Object originEstimate;
    private double uncertainty_km;
    private double confidence;

    // attribution / AIS (Step 10)
    private String attributionRunId;
    private int vesselCount;
    private int kept;
    private int dropped;
    private String aisSource;
    private Object filterStats;
    private Object rankedVessels;
    private Object weightsUsed;
    private String conclusion;
    private Object result;

    public SimulationEvent() {
    }

    public static SimulationEvent clock(String simulationId, String timeIso) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_CLOCK;
        e.simulationId = simulationId;
        e.time = timeIso;
        return e;
    }

    public static SimulationEvent vesselMoved(String simulationId, String vesselId,
                                              double lat, double lon, double speed, double heading) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_VESSEL_MOVED;
        e.simulationId = simulationId;
        e.vesselId = vesselId;
        e.speed = speed;
        e.heading = heading;
        e.position = new Position(lat, lon);
        return e;
    }

    public static SimulationEvent spillReleased(String simulationId, String spillEventId,
                                                String vesselId, double lat, double lon) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_SPILL_RELEASED;
        e.simulationId = simulationId;
        e.spillEventId = spillEventId;
        e.vesselId = vesselId;
        e.position = new Position(lat, lon);
        return e;
    }

    public static SimulationEvent forwardDriftStarted(String simulationId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_FORWARD_DRIFT_STARTED;
        e.simulationId = simulationId;
        e.message = "forward drift started";
        return e;
    }

    public static SimulationEvent forwardDriftCompleted(String simulationId, String runId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_FORWARD_DRIFT_COMPLETED;
        e.simulationId = simulationId;
        e.forwardDriftRunId = runId;
        e.message = "forward drift completed";
        return e;
    }

    public static SimulationEvent forwardDriftFailed(String simulationId, String message) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_FORWARD_DRIFT_FAILED;
        e.simulationId = simulationId;
        e.message = message;
        return e;
    }

    /** Step 07: SAR observation lifecycle events. */
    public static SimulationEvent sarObservationStarted(String simulationId, String observationId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_SAR_OBSERVATION_STARTED;
        e.simulationId = simulationId;
        e.sarObservationId = observationId;
        e.message = "sar observation started";
        return e;
    }

    public static SimulationEvent sarObservationCompleted(String simulationId, String observationId,
                                                          Object result) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_SAR_OBSERVATION_COMPLETED;
        e.simulationId = simulationId;
        e.sarObservationId = observationId;
        e.sarResult = result;
        e.message = "sar observation completed";
        return e;
    }

    public static SimulationEvent sarObservationFailed(String simulationId, String observationId,
                                                       String message) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_SAR_OBSERVATION_FAILED;
        e.simulationId = simulationId;
        e.sarObservationId = observationId;
        e.message = message;
        return e;
    }

    /** §15.3 oil_particles event. `particles` is a List of rendered snippet
     *  maps {@code {lat, lon, radius, opacity}} for the map layer. */
    public static SimulationEvent oilParticles(String simulationId, Object particles) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_OIL_PARTICLES;
        e.simulationId = simulationId;
        e.particles = particles;
        return e;
    }

    /** Step 09: backtracking lifecycle events. */
    public static SimulationEvent backtrackingStarted(String simulationId, String backtrackRunId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_BACKTRACKING_STARTED;
        e.simulationId = simulationId;
        e.backtrackRunId = backtrackRunId;
        e.message = "backtracking started";
        return e;
    }

    public static SimulationEvent backtrackingCompleted(String simulationId, String backtrackRunId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_BACKTRACKING_COMPLETED;
        e.simulationId = simulationId;
        e.backtrackRunId = backtrackRunId;
        e.message = "backtracking completed";
        return e;
    }

    public static SimulationEvent backtrackingFailed(String simulationId, String message) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_BACKTRACKING_FAILED;
        e.simulationId = simulationId;
        e.message = message;
        return e;
    }

    public static SimulationEvent originEstimated(String simulationId, Object originEstimate,
                                                   double uncertaintyKm, double confidence) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_ORIGIN_ESTIMATED;
        e.simulationId = simulationId;
        e.originEstimate = originEstimate;
        e.uncertainty_km = uncertaintyKm;
        e.confidence = confidence;
        e.message = "origin estimated";
        return e;
    }

    /** Step 10: attribution / AIS lifecycle events. */
    public static SimulationEvent aisSearchStarted(String simulationId, String attributionRunId,
                                                   String aisSource) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_AIS_SEARCH_STARTED;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.aisSource = aisSource;
        e.message = "AIS search started";
        return e;
    }

    public static SimulationEvent aisSearchCompleted(String simulationId, String attributionRunId,
                                                     String aisSource, int vesselCount, Object result) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_AIS_SEARCH_COMPLETED;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.aisSource = aisSource;
        e.vesselCount = vesselCount;
        e.result = result;
        e.message = "AIS search completed";
        return e;
    }

    public static SimulationEvent aisSearchFailed(String simulationId, String attributionRunId,
                                                  String message) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_AIS_SEARCH_FAILED;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.message = message;
        return e;
    }

    public static SimulationEvent vesselsFiltered(String simulationId, int kept, int dropped,
                                                  Object filterStats) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_VESSELS_FILTERED;
        e.simulationId = simulationId;
        e.kept = kept;
        e.dropped = dropped;
        e.filterStats = filterStats;
        e.message = "vessels filtered";
        return e;
    }

    public static SimulationEvent attributionStarted(String simulationId, String attributionRunId) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_ATTRIBUTION_STARTED;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.message = "attribution scoring started";
        return e;
    }

    public static SimulationEvent vesselScoresReady(String simulationId, String attributionRunId,
                                                    Object rankedVessels, Object weightsUsed) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_VESSEL_SCORES_READY;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.rankedVessels = rankedVessels;
        e.weightsUsed = weightsUsed;
        e.message = "vessel scores ready";
        return e;
    }

    public static SimulationEvent attributionCompleted(String simulationId, String attributionRunId,
                                                       String conclusion, Object result) {
        SimulationEvent e = new SimulationEvent();
        e.type = TYPE_ATTRIBUTION_COMPLETED;
        e.simulationId = simulationId;
        e.attributionRunId = attributionRunId;
        e.conclusion = conclusion;
        e.result = result;
        e.message = "attribution completed";
        return e;
    }

    public String getType() {
        return type;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public String getTime() {
        return time;
    }

    public String getVesselId() {
        return vesselId;
    }

    public double getSpeed() {
        return speed;
    }

    public double getHeading() {
        return heading;
    }

    public Position getPosition() {
        return position;
    }

    public String getSpillEventId() {
        return spillEventId;
    }

    public Object getParticles() {
        return particles;
    }

    public String getForwardDriftRunId() {
        return forwardDriftRunId;
    }

    public String getMessage() {
        return message;
    }

    public String getSarObservationId() {
        return sarObservationId;
    }

    public Object getSarResult() {
        return sarResult;
    }

    public String getBacktrackRunId() {
        return backtrackRunId;
    }

    public Object getOriginEstimate() {
        return originEstimate;
    }

    public double getUncertainty_km() {
        return uncertainty_km;
    }

    public double getConfidence() {
        return confidence;
    }

    public String getAttributionRunId() {
        return attributionRunId;
    }

    public int getVesselCount() {
        return vesselCount;
    }

    public int getKept() {
        return kept;
    }

    public int getDropped() {
        return dropped;
    }

    public String getAisSource() {
        return aisSource;
    }

    public Object getFilterStats() {
        return filterStats;
    }

    public Object getRankedVessels() {
        return rankedVessels;
    }

    public Object getWeightsUsed() {
        return weightsUsed;
    }

    public String getConclusion() {
        return conclusion;
    }

    public Object getResult() {
        return result;
    }

    /** Nested position object { lat, lon }. */
    public static class Position {
        private double lat;
        private double lon;

        public Position() {
        }

        public Position(double lat, double lon) {
            this.lat = lat;
            this.lon = lon;
        }

        public double getLat() {
            return lat;
        }

        public double getLon() {
            return lon;
        }
    }
}