package com.oilspill.app.investigation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface InvestigationRepository extends MongoRepository<Investigation, String> {

    List<Investigation> findBySimulationIdOrderByCreatedAtDesc(String simulationId);

    Optional<Investigation> findFirstByIncidentIdOrderByCreatedAtDesc(String incidentId);

    List<Investigation> findByStatus(InvestigationStatus status);

    List<Investigation> findByStatusIn(List<InvestigationStatus> statuses);
}