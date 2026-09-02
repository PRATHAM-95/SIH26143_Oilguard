package com.oilspill.app.simulation;

import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping
    public Map<String, Object> createSimulation() {
        Map<String, Object> response = new HashMap<>();
        response.put("simulationId", UUID.randomUUID().toString());
        response.put("status", "created");
        return response;
    }

    @GetMapping("/{id}")
    public Map<String, Object> getSimulation(@PathVariable String id) {
        return simulationService.getSimulation(id);
    }
}
