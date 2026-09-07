package com.oilspill.app.incident;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface IncidentRepository extends MongoRepository<Incident, String> {

    Optional<Incident> findBySimulationId(String simulationId);
}