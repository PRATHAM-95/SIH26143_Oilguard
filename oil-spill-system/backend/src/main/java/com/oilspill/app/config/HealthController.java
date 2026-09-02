package com.oilspill.app.config;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final MongoTemplate mongoTemplate;

    public HealthController(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "oil-spill-backend");
        response.put("version", "0.1.0");

        try {
            mongoTemplate.executeCommand("{ ping: 1 }");
            response.put("mongodb", "UP");
        } catch (Exception e) {
            response.put("mongodb", "DOWN");
            response.put("mongodbError", e.getMessage());
        }
        return response;
    }
}