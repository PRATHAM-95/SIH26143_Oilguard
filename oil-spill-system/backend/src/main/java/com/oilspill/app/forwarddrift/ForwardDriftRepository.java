package com.oilspill.app.forwarddrift;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ForwardDriftRepository extends MongoRepository<ForwardDriftResult, String> {
    List<ForwardDriftResult> findBySimulationId(String simulationId);
}