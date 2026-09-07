package com.oilspill.app.simulation;

import com.oilspill.app.forwarddrift.ForwardDriftRequest;
import com.oilspill.app.forwarddrift.ForwardDriftService;
import com.oilspill.app.backtrack.BacktrackingRequest;
import com.oilspill.app.backtrack.BacktrackingService;
import com.oilspill.app.sar.SarDetectRequest;
import com.oilspill.app.sar.SarService;
import com.oilspill.app.simulation.SimulationService.SimulationValidationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SimulationController.class)
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SimulationService simulationService;

    @MockBean
    private ForwardDriftService forwardDriftService;

    @MockBean
    private SarService sarService;

    @MockBean
    private BacktrackingService backtrackingService;

    @Test
    void createSimulationReturns201Contract() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("simulationId", "abc123");
        body.put("status", "captain_mode");
        body.put("clock", "2025-01-15T08:00:00Z");
        when(simulationService.create(any(CreateSimulationRequest.class))).thenReturn(body);

        mockMvc.perform(post("/api/simulation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"region\":{\"north\":25,\"south\":-10,\"east\":100,\"west\":50},\"mode\":\"captain\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.simulationId").value("abc123"))
                .andExpect(jsonPath("$.status").value("captain_mode"));
    }

    @Test
    void getSimulationReturnsAggregate() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "simulating");
        body.put("clock", "2025-01-15T09:00:00Z");
        body.put("vessels", new Object[]{});
        when(simulationService.getSimulation("abc")).thenReturn(body);

        mockMvc.perform(get("/api/simulation/abc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("simulating"))
                .andExpect(jsonPath("$.vessels").isArray());
    }

    @Test
    void startSimulationEndpoint() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "simulating");
        when(simulationService.start("abc")).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("simulating"));
    }

    @Test
    void advanceValidatesHours() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("clock", "2025-01-15T15:00:00Z");
        when(simulationService.advance(anyString(), anyInt())).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/advance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":6}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clock").value("2025-01-15T15:00:00Z"));
    }

    @Test
    void moveVesselReturnsPosition() throws Exception {
        Map<String, Object> pos = new HashMap<>();
        pos.put("latitude", 10.45);
        pos.put("longitude", 72.4);
        Map<String, Object> body = new HashMap<>();
        body.put("position", pos);
        when(simulationService.moveVessel(anyString(), anyString(), anyDouble(), anyDouble(),
                anyDouble(), anyDouble())).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/vessels/v1/move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":10.45,\"longitude\":72.4,\"speed\":12,\"heading\":45}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.position.latitude").value(10.45));
    }

    @Test
    void spillReturnsEvent() throws Exception {
        Map<String, Object> loc = new HashMap<>();
        loc.put("latitude", 10.45);
        loc.put("longitude", 72.4);
        Map<String, Object> body = new HashMap<>();
        body.put("spillEventId", "spill1");
        body.put("incidentId", "inc1");
        body.put("location", loc);
        when(simulationService.releaseSpill(anyString(), anyString(), anyString(), anyString(),
                anyDouble())).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/vessels/v1/spill")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"accidental\",\"oilType\":\"GENERIC CRUDE\",\"quantityKg\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spillEventId").value("spill1"))
                .andExpect(jsonPath("$.location.latitude").value(10.45));
    }

    @Test
    void spillWithoutVesselReturnsNotFound() throws Exception {
        when(simulationService.releaseSpill(anyString(), anyString(), anyString(), anyString(),
                anyDouble()))
                .thenThrow(new SimulationValidationException("vessel not found: vX in simulation abc"));

        mockMvc.perform(post("/api/simulation/abc/vessels/vX/spill")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"accidental\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void invalidSimulationIdReturnsNotFound() throws Exception {
        when(simulationService.getSimulation("nope"))
                .thenThrow(new SimulationValidationException("simulation not found: nope (invalid simulation id)"));

        mockMvc.perform(get("/api/simulation/nope"))
                .andExpect(status().isNotFound());
    }

    @Test
    void forwardDriftReturnsScientificResult() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("driftRunId", "drift-1");
        body.put("environment_source", "CONTROLLED");
        when(forwardDriftService.runForwardDrift(anyString(), any(ForwardDriftRequest.class))).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/forward-drift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationHours\":6,\"oilType\":\"GENERIC CRUDE\",\"particleCount\":500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftRunId").value("drift-1"));
    }

    @Test
    void forwardDriftWithoutSpillReturnsBadRequest() throws Exception {
        when(forwardDriftService.runForwardDrift(anyString(), any(ForwardDriftRequest.class)))
                .thenThrow(new ForwardDriftService.NoSpillYet("abc"));

        mockMvc.perform(post("/api/simulation/abc/forward-drift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void sarDetectDelegatesToService() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("observationId", "sar-1");
        body.put("status", "completed");
        body.put("source_state", "LOCAL_FIXTURE");
        when(sarService.runSarDetect(anyString(), any(SarDetectRequest.class))).thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/sar/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"LOCAL_FIXTURE\",\"detector\":\"CLASSICAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.observationId").value("sar-1"))
                .andExpect(jsonPath("$.status").value("completed"));
    }

    @Test
    void sarDetectWithoutSimulationReturnsNotFound() throws Exception {
        when(sarService.runSarDetect(anyString(), any(SarDetectRequest.class)))
                .thenThrow(new SarService.SimulationNotFound("abc"));

        mockMvc.perform(post("/api/simulation/abc/sar/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void sarObservationsDelegatesToService() throws Exception {
        when(sarService.listObservations("abc")).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/simulation/abc/sar/observations"))
                .andExpect(status().isOk());
    }

    @Test
    void backtrackDelegatesToService() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("backtrackRunId", "bt-123");
        body.put("status", "completed");
        body.put("origin_estimate", Map.of("lon", 71.9, "lat", 18.6));
        when(backtrackingService.runBacktrack(anyString(), any(BacktrackingRequest.class)))
                .thenReturn(body);

        mockMvc.perform(post("/api/simulation/abc/backtrack")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ensembleSize\":6,\"durationHours\":6.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.backtrackRunId").value("bt-123"))
                .andExpect(jsonPath("$.status").value("completed"));
    }

    @Test
    void backtrackWithoutSimulationReturnsNotFound() throws Exception {
        when(backtrackingService.runBacktrack(anyString(), any(BacktrackingRequest.class)))
                .thenThrow(new BacktrackingService.SimulationNotFound("abc"));

        mockMvc.perform(post("/api/simulation/abc/backtrack")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void backtrackRunsDelegatesToService() throws Exception {
        when(backtrackingService.listBacktrackRuns("abc")).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/simulation/abc/backtrack/runs"))
                .andExpect(status().isOk());
    }
}