package com.oilspill.app.attribution;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * STEP 10: historical AIS reconstruction + vessel attribution.
 *
 *   POST /api/attribution/run        run AIS -> filter -> five-factor scoring
 *   GET  /api/attribution/runs       list persisted runs for a simulation (replay)
 *   GET  /api/attribution/runs/{id}  single persisted run (replay)
 *   GET  /api/attribution/providers  honest AIS provider availability
 */
@RestController
@RequestMapping("/api/attribution")
public class AttributionController {

    private final AttributionService attributionService;

    public AttributionController(AttributionService attributionService) {
        this.attributionService = attributionService;
    }

    @PostMapping("/run")
    public Map<String, Object> run(@Valid @RequestBody AttributionRequest request) {
        return attributionService.runAttribution(request.getSimulationId(), request);
    }

    @GetMapping("/runs")
    public List<Map<String, Object>> runs(@RequestParam("simulationId") String simulationId) {
        return attributionService.listRuns(simulationId);
    }

    @GetMapping("/runs/{runId}")
    public Map<String, Object> runById(@PathVariable String runId) {
        return attributionService.getRun(runId);
    }

    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return attributionService.listProviders();
    }

    @ExceptionHandler(AttributionService.SimulationNotFound.class)
    public ResponseEntity<Map<String, Object>> handleSimulationNotFound(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(AttributionService.AttributionNotFound.class)
    public ResponseEntity<Map<String, Object>> handleAttributionNotFound(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }
}