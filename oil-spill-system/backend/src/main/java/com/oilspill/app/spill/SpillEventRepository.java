package com.oilspill.app.spill;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SpillEventRepository extends MongoRepository<SpillEvent, String> {

    List<SpillEvent> findBySimulationId(String simulationId);

    Optional<SpillEvent> findBySimulationIdAndSpillEventId(String simulationId, String spillEventId);
}