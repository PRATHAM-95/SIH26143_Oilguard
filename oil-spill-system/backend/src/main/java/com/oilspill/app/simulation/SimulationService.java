package com.oilspill.app.simulation;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class SimulationService {

    public Map<String, Object> getSimulation(String id) {
        Map<String, Object> response = new HashMap<>();
        response.put("simulationId", id);
        response.put("status", "pending");
        return response;
    }
}
