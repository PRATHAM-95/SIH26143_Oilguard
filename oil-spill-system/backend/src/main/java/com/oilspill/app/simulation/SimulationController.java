package com.oilspill.app.simulation;

import com.oilspill.app.backtrack.BacktrackingRequest;
import com.oilspill.app.backtrack.BacktrackingService;
import com.oilspill.app.forwarddrift.ForwardDriftRequest;
import com.oilspill.app.forwarddrift.ForwardDriftService;
import com.oilspill.app.sar.SarDetectRequest;
import com.oilspill.app.sar.SarService;
import com.oilspill.app.spill.SpillRequest;
import com.oilspill.app.vessel.MoveVesselRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Simulation REST API, frozen in SYSTEM_SPEC §15.1.
 *
 * Endpoints implemented:
 *   POST /api/simulation
 *   GET  /api/simulation/{id}
 *   POST /api/simulation/{id}/start
 *   POST /api/simulation/{id}/advance
 *   GET  /api/simulation/{id}/vessels
 *   POST /api/simulation/{id}/vessels/{vesselId}/move
 *   POST /api/simulation/{id}/vessels/{vesselId}/spill
 *   POST /api/simulation/{id}/forward-drift      (Step 05, orchestrates FastAPI)
 *
 * NOTE: the spill action lives on the vessel path per SYSTEM_SPEC §15.1
 * (POST /api/simulation/{id}/vessels/{vesselId}/spill), not on the bare
 * simulation path, so a spill is always bound to a vessel.
 */
@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final SimulationService simulationService;
    private final ForwardDriftService forwardDriftService;
    private final SarService sarService;
    private final BacktrackingService backtrackingService;

    public SimulationController(SimulationService simulationService,
                                ForwardDriftService forwardDriftService,
                                SarService sarService,
                                BacktrackingService backtrackingService) {
        this.simulationService = simulationService;
        this.forwardDriftService = forwardDriftService;
        this.sarService = sarService;
        this.backtrackingService = backtrackingService;
    }

    @PostMapping
    public Map<String, Object> createSimulation(@Valid @RequestBody(required = false) CreateSimulationRequest request) {
        if (request == null) {
            request = new CreateSimulationRequest();
        }
        return simulationService.create(request);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getSimulation(@PathVariable String id) {
        return simulationService.getSimulation(id);
    }

    @PostMapping("/{id}/start")
    public Map<String, Object> startSimulation(@PathVariable String id) {
        return simulationService.start(id);
    }

    @PostMapping("/{id}/advance")
    public Map<String, Object> advanceSimulation(@PathVariable String id,
                                                 @Valid @RequestBody AdvanceTimeRequest request) {
        if (request == null || request.getHours() == null) {
            throw new SimulationService.SimulationValidationException("hours is required");
        }
        return simulationService.advance(id, request.getHours());
    }

    @GetMapping("/{id}/vessels")
    public Map<String, Object> listVessels(@PathVariable String id) {
        return simulationService.listVessels(id);
    }

    @PostMapping("/{id}/vessels/{vesselId}/move")
    public Map<String, Object> moveVessel(@PathVariable String id,
                                          @PathVariable String vesselId,
                                          @Valid @RequestBody MoveVesselRequest request) {
        return simulationService.moveVessel(id, vesselId,
                request.getLatitude(), request.getLongitude(),
                request.getSpeed(), request.getHeading());
    }

    @PostMapping("/{id}/vessels/{vesselId}/spill")
    public Map<String, Object> releaseSpill(@PathVariable String id,
                                            @PathVariable String vesselId,
                                            @Valid @RequestBody(required = false) SpillRequest request) {
        SpillRequest r = request == null ? new SpillRequest() : request;
        return simulationService.releaseSpill(id, vesselId,
                r.getType(), r.getOilType(), r.getQuantityKg());
    }

    /** Step 05: run forward oil drift by orchestrating the scientific service. */
    @PostMapping("/{id}/forward-drift")
    public Map<String, Object> forwardDrift(@PathVariable String id,
                                            @Valid @RequestBody(required = false) ForwardDriftRequest request) {
        return forwardDriftService.runForwardDrift(id,
                request == null ? new ForwardDriftRequest() : request);
    }

    /** Step 07: run a SAR oil-spill observation by orchestrating the scientific service. */
    @PostMapping("/{id}/sar/detect")
    public Map<String, Object> sarDetect(@PathVariable String id,
                                         @Valid @RequestBody(required = false) SarDetectRequest request) {
        return sarService.runSarDetect(id,
                request == null ? new SarDetectRequest() : request);
    }

    /** Step 07: list persisted SAR observations for a simulation (replay state). */
    @GetMapping("/{id}/sar/observations")
    public Object sarObservations(@PathVariable String id) {
        return sarService.listObservations(id);
    }

    /** Step 09: run ensemble backtracking to estimate probable source region. */
    @PostMapping("/{id}/backtrack")
    public Map<String, Object> backtrack(@PathVariable String id,
                                         @Valid @RequestBody(required = false) BacktrackingRequest request) {
        return backtrackingService.runBacktrack(id,
                request == null ? new BacktrackingRequest() : request);
    }

    /** Step 09: list persisted backtracking runs for a simulation (replay). */
    @GetMapping("/{id}/backtrack/runs")
    public Object backtrackRuns(@PathVariable String id) {
        return backtrackingService.listBacktrackRuns(id);
    }

    @ExceptionHandler(SimulationService.SimulationValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(SimulationService.SimulationValidationException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        boolean notFound = ex.getMessage() != null && ex.getMessage().contains("not found");
        return ResponseEntity.status(notFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler({ForwardDriftService.SimulationNotFound.class,
            ForwardDriftService.NoSpillYet.class, SarService.SimulationNotFound.class,
            BacktrackingService.SimulationNotFound.class})
    public ResponseEntity<Map<String, Object>> handleForwardDrift(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        boolean notFound = ex.getMessage() != null && ex.getMessage().contains("not found");
        return ResponseEntity.status(notFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST).body(body);
    }
}