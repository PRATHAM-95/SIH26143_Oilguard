package com.oilspill.app.simulation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SimulationRepository extends MongoRepository<Simulation, String> {

    List<Simulation> findByStatus(SimulationStatus status);
}