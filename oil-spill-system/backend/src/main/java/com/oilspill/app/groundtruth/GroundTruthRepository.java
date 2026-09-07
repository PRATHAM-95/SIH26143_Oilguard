package com.oilspill.app.groundtruth;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface GroundTruthRepository extends MongoRepository<GroundTruth, String> {

    Optional<GroundTruth> findBySimulationId(String simulationId);
}