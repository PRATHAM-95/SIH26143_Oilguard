package com.oilspill.app.simulation;

import com.oilspill.app.groundtruth.GroundTruthRepository;
import com.oilspill.app.incident.IncidentRepository;
import com.oilspill.app.spill.SpillEvent;
import com.oilspill.app.spill.SpillEventRepository;
import com.oilspill.app.vessel.Vessel;
import com.oilspill.app.vessel.VesselRepository;
import com.oilspill.app.websocket.SimulationEvent;
import com.oilspill.app.websocket.SimulationEventBroadcaster;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

class SimulationServiceTest {

    private SimulationRepository simulationRepository;
    private VesselRepository vesselRepository;
    private SpillEventRepository spillEventRepository;
    private IncidentRepository incidentRepository;
    private GroundTruthRepository groundTruthRepository;
    private SimulationEventBroadcaster broadcaster;
    private SimulationService service;

    private Simulation sim;
    private Vessel vessel;

    @BeforeEach
    void setUp() {
        simulationRepository = mock(SimulationRepository.class);
        vesselRepository = mock(VesselRepository.class);
        spillEventRepository = mock(SpillEventRepository.class);
        incidentRepository = mock(IncidentRepository.class);
        groundTruthRepository = mock(GroundTruthRepository.class);
        broadcaster = mock(SimulationEventBroadcaster.class);

        service = new SimulationService(simulationRepository, vesselRepository, spillEventRepository,
                incidentRepository, groundTruthRepository, broadcaster);

        sim = new Simulation();
        sim.setSimulationId("sim1");
        sim.setStatus(SimulationStatus.simulating);
        sim.setClock(Instant.parse("2025-01-15T08:00:00Z"));
        sim.setRegion(new Region(25, -10, 100, 50));

        vessel = new Vessel();
        vessel.setVesselId("v1");
        vessel.setSimulationId("sim1");
        vessel.setName("MV Demo");
        vessel.setSpeed(12.0);
        vessel.setHeading(45.0);
        vessel.setPosition(new com.oilspill.app.vessel.GeoPoint(72.0, 10.0));
    }

    @Test
    void createSimulationPersistsAndReturnsId() {
        CreateSimulationRequest req = new CreateSimulationRequest();
        req.setRegion(new Region(25, -10, 100, 50));
        req.setMode("captain");
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> {
                    Simulation s = inv.getArgument(0);
                    if (s.getSimulationId() == null) s.setSimulationId("generated");
                    return s;
                });
        when(vesselRepository.save(any(Vessel.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.create(req);

        assertEquals("generated", out.get("simulationId"));
        assertEquals("captain_mode", out.get("status"));
        assertNotNull(out.get("clock"));
        verify(simulationRepository).save(any(Simulation.class));
        verify(vesselRepository).save(any(Vessel.class));
    }

    @Test
    void startRequiresCaptainMode() {
        assertThrows(SimulationService.SimulationValidationException.class, () -> service.start("sim1"));
    }

    @Test
    void startTransitionsToSimulatingAndBroadcastsClock() {
        sim.setStatus(SimulationStatus.captain_mode);
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(simulationRepository.save(any(Simulation.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.start("sim1");

        assertEquals("simulating", out.get("status"));
        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster).broadcast(anyString(), event.capture());
        assertEquals("clock_update", event.getValue().getType());
    }

    @Test
    void advanceMovesVesselDeterministicallyAndBroadcasts() {
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(simulationRepository.save(any(Simulation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(vesselRepository.findBySimulationId("sim1")).thenReturn(List.of(vessel));
        when(vesselRepository.save(any(Vessel.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.advance("sim1", 1);

        // T+0 -> T+1
        assertEquals(Instant.parse("2025-01-15T09:00:00Z"), out.get("clock"));

        // 12 knots * 1h = 12 nmi = 0.2 deg of arc along heading 45.
        ArgumentCaptor<Vessel> saved = ArgumentCaptor.forClass(Vessel.class);
        verify(vesselRepository).save(saved.capture());
        Vessel moved = saved.getValue();
        double movedLat = moved.getPosition().lat();
        double movedLon = moved.getPosition().lon();

        // Verify movement happened (heading 45 => both lat and lon increase).
        assertTrue(movedLat > 10.0, "latitude advanced northward");
        assertTrue(movedLon > 72.0, "longitude advanced eastward");

        // Broadcasts: clock_update + vessel_moved
        verify(broadcaster, times(2)).broadcast(anyString(), any(SimulationEvent.class));
    }

    @Test
    void advanceRejectsStoppedSimulation() {
        sim.setStatus(SimulationStatus.observation); // spill already released => no advance
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        assertThrows(SimulationService.SimulationValidationException.class, () -> service.advance("sim1", 1));
    }

    @Test
    void moveVesselRepositionsAndBroadcasts() {
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(vesselRepository.findBySimulationIdAndVesselId("sim1", "v1")).thenReturn(Optional.of(vessel));
        when(vesselRepository.save(any(Vessel.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.moveVessel("sim1", "v1", 10.45, 72.4, 12.0, 90.0);

        @SuppressWarnings("unchecked")
        Map<String, Object> pos = (Map<String, Object>) out.get("position");
        assertEquals(10.45, (double) pos.get("latitude"));
        assertEquals(72.4, (double) pos.get("longitude"));
        ArgumentCaptor<SimulationEvent> event = ArgumentCaptor.forClass(SimulationEvent.class);
        verify(broadcaster).broadcast(anyString(), event.capture());
        assertEquals("vessel_moved", event.getValue().getType());
        assertEquals("v1", event.getValue().getVesselId());
    }

    @Test
    void spillRequiresValidVessel() {
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(vesselRepository.findBySimulationIdAndVesselId("sim1", "missing")).thenReturn(Optional.empty());
        assertThrows(SimulationService.SimulationValidationException.class,
                () -> service.releaseSpill("sim1", "missing", "accidental", "GENERIC CRUDE", 5000));
    }

    @Test
    void spillCreatesEventIncidentGroundTruthAndBroadcasts() {
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(vesselRepository.findBySimulationIdAndVesselId("sim1", "v1")).thenReturn(Optional.of(vessel));
        when(simulationRepository.save(any(Simulation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(spillEventRepository.save(any(SpillEvent.class))).thenAnswer(inv -> {
            SpillEvent s = inv.getArgument(0);
            if (s.getSpillEventId() == null) s.setSpillEventId("spill1");
            return s;
        });
        when(incidentRepository.save(any(com.oilspill.app.incident.Incident.class))).thenAnswer(inv -> {
            com.oilspill.app.incident.Incident i = inv.getArgument(0);
            if (i.getIncidentId() == null) i.setIncidentId("inc1");
            return i;
        });
        when(groundTruthRepository.save(any(com.oilspill.app.groundtruth.GroundTruth.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.releaseSpill("sim1", "v1", "accidental", "GENERIC CRUDE", 5000);

        assertEquals("spill1", out.get("spillEventId"));
        assertEquals("inc1", out.get("incidentId"));
        verify(groundTruthRepository).save(any(com.oilspill.app.groundtruth.GroundTruth.class));
        verify(broadcaster).broadcast(anyString(), any(SimulationEvent.class));

        // Simulation transitions to observation once a spill exists.
        ArgumentCaptor<Simulation> savedSim = ArgumentCaptor.forClass(Simulation.class);
        verify(simulationRepository).save(savedSim.capture());
        assertEquals(SimulationStatus.observation, savedSim.getValue().getStatus());
    }

    @Test
    void spillRejectedWhenNotSimulating() {
        sim.setStatus(SimulationStatus.captain_mode);
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(vesselRepository.findBySimulationIdAndVesselId("sim1", "v1")).thenReturn(Optional.of(vessel));
        assertThrows(SimulationService.SimulationValidationException.class,
                () -> service.releaseSpill("sim1", "v1", "accidental", "GENERIC CRUDE", 5000));
    }

    @Test
    void getSimulationDoesNotExposeGroundTruth() {
        when(simulationRepository.findById("sim1")).thenReturn(Optional.of(sim));
        when(vesselRepository.findBySimulationId("sim1")).thenReturn(List.of(vessel));
        when(spillEventRepository.findBySimulationId("sim1")).thenReturn(List.of());
        when(incidentRepository.findBySimulationId("sim1")).thenReturn(Optional.empty());

        Map<String, Object> out = service.getSimulation("sim1");

        assertTrue(!out.containsKey("actualOrigin"));
        assertTrue(!out.containsKey("actualVesselId"));
        assertTrue(!out.containsKey("actualSpillTime"));
        verify(groundTruthRepository, never()).findBySimulationId(anyString());
    }
}