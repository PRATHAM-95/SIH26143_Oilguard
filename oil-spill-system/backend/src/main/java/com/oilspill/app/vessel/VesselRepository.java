package com.oilspill.app.vessel;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface VesselRepository extends MongoRepository<Vessel, String> {

    List<Vessel> findBySimulationId(String simulationId);

    Optional<Vessel> findBySimulationIdAndVesselId(String simulationId, String vesselId);
}