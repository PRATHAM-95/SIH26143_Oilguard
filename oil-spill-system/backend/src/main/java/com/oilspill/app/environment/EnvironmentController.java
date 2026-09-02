package com.oilspill.app.environment;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/environment")
public class EnvironmentController {

    private final EnvironmentService environmentService;
    private final WebClient pythonClient;

    @Value("${python.service.url}")
    private String pythonServiceUrl;

    public EnvironmentController(EnvironmentService environmentService, WebClient pythonWebClient) {
        this.environmentService = environmentService;
        this.pythonClient = pythonWebClient;
    }

    @GetMapping("/ping-python")
    public Map<String, Object> pingPython() {
        Map<String, Object> response = new HashMap<>();
        try {
            ResponseEntity<JsonNode> result = pythonClient.get()
                    .uri("/health")
                    .retrieve()
                    .toEntity(JsonNode.class)
                    .block(Duration.ofSeconds(10));

            if (result != null && result.getBody() != null) {
                response.put("ok", true);
                response.put("pythonStatus", result.getBody().get("status").asText());
                response.put("pythonUrl", pythonServiceUrl);
                return response;
            }
        } catch (Exception e) {
            response.put("ok", false);
            response.put("error", e.getMessage());
            return response;
        }
        response.put("ok", false);
        response.put("error", "No response from Python service");
        return response;
    }
}
