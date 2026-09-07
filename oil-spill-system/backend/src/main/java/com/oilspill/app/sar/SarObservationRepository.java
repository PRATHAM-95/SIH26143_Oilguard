package com.oilspill.app.sar;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SarObservationRepository extends MongoRepository<SarObservation, String> {
    List<SarObservation> findBySimulationId(String simulationId);
}
