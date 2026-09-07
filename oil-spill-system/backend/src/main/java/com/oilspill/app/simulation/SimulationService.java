package com.oilspill.app.simulation;

import com.oilspill.app.geo.Navigate;
import com.oilspill.app.groundtruth.GroundTruth;
import com.oilspill.app.groundtruth.GroundTruthRepository;
import com.oilspill.app.incident.Incident;
import com.oilspill.app.incident.IncidentRepository;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.vessel.GeoPoint;
import com.oilspill.app.vessel.TrackPoint;
import com.oilspill.app.vessel.Vessel;
import com.oilspill.app.vessel.VesselRepository;
import com.oilspill.app.websocket.SimulationEvent;
import com.oilspill.app.websocket.SimulationEventBroadcaster;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates the Captain Mode simulation lifecycle.
 *
 * Lifecycle (SYSTEM_SPEC §13.1 `simulation.status`):
 *   captain_mode -> simulating -> observation -> investigation -> completed.
 *
 * Ground-truth isolation (§14): a spill creates a hidden `ground_truth`
 * document. None of the simulation-facing responses below ever return its
 * fields — the reveal flow is the only reader and is implemented later.
 */
@Service
public class SimulationService {

    private final SimulationRepository simulationRepository;
    private final VesselRepository vesselRepository;
    private final SpillEventRepository spillEventRepository;
    private final IncidentRepository incidentRepository;
    private final GroundTruthRepository groundTruthRepository;
    private final SimulationEventBroadcaster broadcaster;

    public SimulationService(SimulationRepository simulationRepository,
                             VesselRepository vesselRepository,
                             SpillEventRepository spillEventRepository,
                             IncidentRepository incidentRepository,
                             GroundTruthRepository groundTruthRepository,
                             SimulationEventBroadcaster broadcaster) {
        this.simulationRepository = simulationRepository;
        this.vesselRepository = vesselRepository;
        this.spillEventRepository = spillEventRepository;
        this.incidentRepository = incidentRepository;
        this.groundTruthRepository = groundTruthRepository;
        this.broadcaster = broadcaster;
    }

    /* ------------------------------------------------------------------ */
    /* Create                                                             */
    /* ------------------------------------------------------------------ */

    @Transactional
    public Map<String, Object> create(CreateSimulationRequest request) {
        Region region = request.getRegion();
        if (region == null) {
            throw new SimulationValidationException("region is required");
        }

        Instant now = Instant.now();
        Simulation sim = new Simulation();
        sim.setStatus(SimulationStatus.captain_mode);
        sim.setMode(request.getMode() == null ? "captain" : request.getMode());
        sim.setClock(now);
        sim.setRegion(region);
        sim.setCreatedAt(now);
        sim.setUpdatedAt(now);
        sim = simulationRepository.save(sim);

        // Seed one controlled Captain vessel inside the region.
        createDefaultVessel(sim, region);

        Map<String, Object> out = new HashMap<>();
        out.put("simulationId", sim.getSimulationId());
        out.put("status", sim.getStatus().name());
        out.put("clock", sim.getClock().toString());
        return out;
    }

    private void createDefaultVessel(Simulation sim, Region region) {
        double lat = region.centreLat();
        double lon = region.centreLon();

        Vessel vessel = new Vessel();
        vessel.setSimulationId(sim.getSimulationId());
        vessel.setMmsi("SIM" + sim.getSimulationId().substring(0, Math.min(6, sim.getSimulationId().length())) + "01");
        vessel.setImo("");
        vessel.setName("MV Captain Demo");
        vessel.setType("Cargo");
        vessel.setLength(200);
        vessel.setBeam(32);
        vessel.setDraft(12);
        vessel.setPosition(new GeoPoint(lon, lat));
        vessel.setSpeed(12.0);
        vessel.setHeading(45.0);
        vessel.setCourse(45.0);
        vessel.setSimulated(true);
        vessel.addTrackPoint(new TrackPoint(sim.getClock(), lat, lon, vessel.getSpeed(), vessel.getHeading()));
        vesselRepository.save(vessel);
    }

    /* ------------------------------------------------------------------ */
    /* Read                                                               */
    /* ------------------------------------------------------------------ */

    public Map<String, Object> getSimulation(String simulationId) {
        Simulation sim = requireSimulation(simulationId);
        Map<String, Object> out = new HashMap<>();
        out.put("simulationId", sim.getSimulationId());
        out.put("status", sim.getStatus().name());
        out.put("mode", sim.getMode());
        out.put("clock", sim.getClock());
        out.put("vessels", vesselDtos(simulationId));
        out.put("spillEvent", spillEventDto(simulationId));
        out.put("incident", incidentExists(simulationId));
        out.put("investigation", null);
        return out;
    }

    /** Vessel-facing list, mirroring GET /api/simulation/{id}/vessels. */
    public Map<String, Object> listVessels(String simulationId) {
        requireSimulation(simulationId);
        Map<String, Object> out = new HashMap<>();
        out.put("vessels", vesselDtos(simulationId));
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* Lifecycle transitions                                              */
    /* ------------------------------------------------------------------ */

    /** captain_mode -> simulating. */
    @Transactional
    public Map<String, Object> start(String simulationId) {
        Simulation sim = requireSimulation(simulationId);
        if (!SimulationStatus.canStart(sim.getStatus())) {
            throw new SimulationValidationException(
                    "cannot start simulation from status " + sim.getStatus());
        }
        sim.setStatus(SimulationStatus.simulating);
        sim.setUpdatedAt(Instant.now());
        simulationRepository.save(sim);

        // Announce the new clock so subscribers render immediately.
        broadcaster.broadcast(sim.getSimulationId(),
                SimulationEvent.clock(sim.getSimulationId(), sim.getClock().toString()));

        Map<String, Object> out = new HashMap<>();
        out.put("simulationId", sim.getSimulationId());
        out.put("status", sim.getStatus().name());
        out.put("clock", sim.getClock());
        return out;
    }

    /**
     * Advances the simulation clock and moves every vessel deterministically.
     * Broadcasts a clock_update then a vessel_moved per vessel.
     */
    @Transactional
    public Map<String, Object> advance(String simulationId, int hours) {
        if (hours <= 0) {
            throw new SimulationValidationException("hours must be positive");
        }
        Simulation sim = requireSimulation(simulationId);
        if (!SimulationStatus.canAdvance(sim.getStatus())) {
            throw new SimulationValidationException(
                    "cannot advance simulation from status " + sim.getStatus());
        }

        Instant newClock = sim.getClock().plusSeconds(hours * 3600L);
        sim.setClock(newClock);
        sim.setUpdatedAt(Instant.now());
        simulationRepository.save(sim);

        broadcaster.broadcast(sim.getSimulationId(),
                SimulationEvent.clock(sim.getSimulationId(), newClock.toString()));

        List<Vessel> vessels = vesselRepository.findBySimulationId(simulationId);
        for (Vessel vessel : vessels) {
            moveVesselConstantCourse(sim, vessel, hours);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("clock", sim.getClock());
        out.put("particles", new ArrayList<>());
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* Vessel movement                                                    */
    /* ------------------------------------------------------------------ */

    /** User-initiated reposition (Captain controls). */
    @Transactional
    public Map<String, Object> moveVessel(String simulationId, String vesselId, double lat,
                                          double lon, double speed, double heading) {
        Simulation sim = requireSimulation(simulationId);
        Vessel vessel = requireVessel(simulationId, vesselId);

        vessel.setPosition(new GeoPoint(lon, lat));
        vessel.setSpeed(speed);
        vessel.setHeading(heading);
        vessel.setCourse(heading);
        vessel.addTrackPoint(new TrackPoint(sim.getClock(), lat, lon, speed, heading));
        vesselRepository.save(vessel);

        broadcaster.broadcast(sim.getSimulationId(), SimulationEvent.vesselMoved(
                simulationId, vesselId, lat, lon, speed, heading));

        Map<String, Object> out = new HashMap<>();
        Map<String, Object> pos = new HashMap<>();
        pos.put("latitude", lat);
        pos.put("longitude", lon);
        out.put("position", pos);
        out.put("timestamp", sim.getClock());
        return out;
    }

    /** Advance one vessel along its current heading/speed for `hours`. */
    private void moveVesselConstantCourse(Simulation sim, Vessel vessel, int hours) {
        double[] r = Navigate.advance(
                vessel.getPosition().lat(),
                vessel.getPosition().lon(),
                vessel.getSpeed(),
                vessel.getHeading(),
                hours);

        double newLat = r[0];
        double newLon = r[1];
        vessel.setPosition(new GeoPoint(newLon, newLat));
        vessel.addTrackPoint(new TrackPoint(sim.getClock(), newLat, newLon,
                vessel.getSpeed(), vessel.getHeading()));
        vesselRepository.save(vessel);

        broadcaster.broadcast(sim.getSimulationId(), SimulationEvent.vesselMoved(
                sim.getSimulationId(), vessel.getVesselId(),
                newLat, newLon, vessel.getSpeed(), vessel.getHeading()));
    }

    /* ------------------------------------------------------------------ */
    /* Spill                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Releases an application-level spill from a vessel. Creates:
     *  - a spill_event
     *  - an incident record (reference centre, NOT ground truth)
     *  - a hidden ground_truth document (isolated)
     * and broadcasts spill_released.
     *
     * No OpenOil is run here; this is an application event only.
     */
    @Transactional
    public Map<String, Object> releaseSpill(String simulationId, String vesselId,
                                            String type, String oilType, double quantityKg) {
        Simulation sim = requireSimulation(simulationId);
        if (!SimulationStatus.canSpill(sim.getStatus())) {
            throw new SimulationValidationException(
                    "cannot release a spill unless the simulation is simulating (was " + sim.getStatus() + ")");
        }
        Vessel vessel = requireVessel(simulationId, vesselId);

        double lat = vessel.getPosition().lat();
        double lon = vessel.getPosition().lon();

        SpillEvent spill = new SpillEvent();
        spill.setSimulationId(simulationId);
        spill.setVesselId(vessel.getVesselId());
        spill.setLocation(new GeoPoint(lon, lat));
        spill.setTime(sim.getClock());
        spill.setOilType(oilType == null || oilType.isBlank() ? "GENERIC CRUDE" : oilType);
        spill.setQuantityKg(quantityKg > 0 ? quantityKg : 5000);
        spill.setType(type == null || type.isBlank() ? "accidental" : type);
        spill.setGroundTruth(true);
        spill = spillEventRepository.save(spill);

        // Incident record — reference centre for a future investigation.
        Incident incident = new Incident();
        incident.setSimulationId(simulationId);
        incident.setSpillEventId(spill.getSpillEventId());
        incident.setObservedTime(sim.getClock());
        incident.setCentroid(new GeoPoint(lon, lat));
        incident.setStatus("created");
        incident = incidentRepository.save(incident);

        // Hidden ground truth — separate, isolated collection.
        GroundTruth gt = new GroundTruth();
        gt.setSimulationId(simulationId);
        gt.setSpillEventId(spill.getSpillEventId());
        gt.setActualVesselId(vessel.getVesselId());
        gt.setActualOrigin(new GeoPoint(lon, lat));
        gt.setActualSpillTime(sim.getClock());
        gt.setActualOilType(spill.getOilType());
        gt.setActualQuantityKg(spill.getQuantityKg());
        groundTruthRepository.save(gt);

        // Transition simulation to observation once a spill exists.
        sim.setStatus(SimulationStatus.observation);
        sim.setSpillEventId(spill.getSpillEventId());
        sim.setIncidentId(incident.getIncidentId());
        sim.setUpdatedAt(Instant.now());
        simulationRepository.save(sim);

        broadcaster.broadcast(sim.getSimulationId(),
                SimulationEvent.spillReleased(simulationId, spill.getSpillEventId(),
                        vessel.getVesselId(), lat, lon));

        Map<String, Object> out = new HashMap<>();
        out.put("spillEventId", spill.getSpillEventId());
        out.put("incidentId", incident.getIncidentId());
        Map<String, Object> pos = new HashMap<>();
        pos.put("latitude", lat);
        pos.put("longitude", lon);
        out.put("location", pos);
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* Helpers (never return ground truth)                                */
    /* ------------------------------------------------------------------ */

    private Simulation requireSimulation(String simulationId) {
        Optional<Simulation> sim = simulationRepository.findById(simulationId);
        if (sim.isEmpty()) {
            throw new SimulationValidationException(
                    "simulation not found: " + simulationId + " (invalid simulation id)");
        }
        return sim.get();
    }

    private Vessel requireVessel(String simulationId, String vesselId) {
        Optional<Vessel> vessel =
                vesselRepository.findBySimulationIdAndVesselId(simulationId, vesselId);
        if (vessel.isEmpty()) {
            throw new SimulationValidationException(
                    "vessel not found: " + vesselId + " in simulation " + simulationId);
        }
        return vessel.get();
    }

    private List<Map<String, Object>> vesselDtos(String simulationId) {
        List<Vessel> vessels = vesselRepository.findBySimulationId(simulationId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Vessel vessel : vessels) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", vessel.getVesselId());
            dto.put("mmsi", vessel.getMmsi());
            dto.put("name", vessel.getName());
            dto.put("type", vessel.getType());
            Map<String, Object> pos = new HashMap<>();
            pos.put("latitude", vessel.getPosition().lat());
            pos.put("longitude", vessel.getPosition().lon());
            dto.put("position", pos);
            dto.put("speed", vessel.getSpeed());
            dto.put("heading", vessel.getHeading());
            out.add(dto);
        }
        return out;
    }

    private Map<String, Object> spillEventDto(String simulationId) {
        List<SpillEvent> spills = spillEventRepository.findBySimulationId(simulationId);
        if (spills.isEmpty()) {
            return null;
        }
        SpillEvent spill = spills.get(spills.size() - 1);
        Map<String, Object> dto = new HashMap<>();
        dto.put("spillEventId", spill.getSpillEventId());
        dto.put("vesselId", spill.getVesselId());
        dto.put("time", spill.getTime());
        dto.put("oilType", spill.getOilType());
        dto.put("quantityKg", spill.getQuantityKg());
        dto.put("type", spill.getType());
        Map<String, Object> loc = new HashMap<>();
        loc.put("latitude", spill.getLocation().lat());
        loc.put("longitude", spill.getLocation().lon());
        dto.put("location", loc);
        return dto;
    }

    private boolean incidentExists(String simulationId) {
        return incidentRepository.findBySimulationId(simulationId).isPresent();
    }

    /** Dedicated exception so controllers can map it to 400/404. */
    public static class SimulationValidationException extends RuntimeException {
        public SimulationValidationException(String message) {
            super(message);
        }
    }
}