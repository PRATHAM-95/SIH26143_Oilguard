package com.oilspill.app.investigation;

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
 * STEP 11: persistent investigation orchestration + evidence chain.
 *
 *   POST /api/investigation/{incidentId}/start   start (idempotent)
 *   GET  /api/investigation/{id}                 full state
 *   GET  /api/investigation/{id}/steps           stage list
 *   GET  /api/investigation                      filterable list
 *   POST /api/investigation/{id}/retry           resume failed stages
 *   POST /api/investigation/{id}/cancel          cancel an active investigation
 *   POST /api/investigation/{id}/reveal          ground-truth comparison (COMPLETED only)
 *   GET  /api/investigation/{id}/report          12-section deterministic report
 */
@RestController
@RequestMapping("/api/investigation")
public class InvestigationController {

    private final InvestigationService investigationService;

    public InvestigationController(InvestigationService investigationService) {
        this.investigationService = investigationService;
    }

    @PostMapping("/{incidentId}/start")
    public Map<String, Object> start(@PathVariable String incidentId,
                                     @Valid @RequestBody(required = false) StartInvestigationRequest request) {
        return investigationService.start(incidentId, request);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable String id) {
        return investigationService.get(id);
    }

    @GetMapping("/{id}/steps")
    public List<Map<String, Object>> steps(@PathVariable String id) {
        return investigationService.steps(id);
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String simulationId,
                                          @RequestParam(required = false) String incidentId,
                                          @RequestParam(required = false) String status) {
        return investigationService.list(simulationId, incidentId, status);
    }

    @PostMapping("/{id}/retry")
    public Map<String, Object> retry(@PathVariable String id,
                                     @Valid @RequestBody(required = false) RetryRequest request) {
        return investigationService.retry(id, request);
    }

    @PostMapping("/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable String id) {
        return investigationService.cancel(id);
    }

    @PostMapping("/{id}/reveal")
    public Map<String, Object> reveal(@PathVariable String id) {
        return investigationService.reveal(id);
    }

    @GetMapping("/{id}/report")
    public Map<String, Object> report(@PathVariable String id) {
        return investigationService.report(id);
    }

    @ExceptionHandler(InvestigationService.InvestigationNotFound.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(InvestigationService.ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InvestigationService.ValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}