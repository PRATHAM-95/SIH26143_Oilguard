package com.oilspill.app.attribution;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AttributionRepository extends MongoRepository<AttributionRun, String> {
    List<AttributionRun> findBySimulationId(String simulationId);
}