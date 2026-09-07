package com.oilspill.app.backtrack;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface BacktrackingRepository extends MongoRepository<BacktrackingResult, String> {
    List<BacktrackingResult> findBySimulationId(String simulationId);
}
