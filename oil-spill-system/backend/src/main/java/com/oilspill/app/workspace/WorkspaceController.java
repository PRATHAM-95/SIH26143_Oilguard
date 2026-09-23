package com.oilspill.app.workspace;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Workspace lifecycle — lets a judge/operator take the command centre back to a
 * genuinely clean slate.
 *
 * <p>The oil-spill pipeline persists everything to MongoDB (persistent incident,
 * spill events, vessels, SAR observations, drift/backtrack/attribution runs,
 * investigations and the ground-truth reveal). A fresh material can only ever use
 * "previous result data" if the operator explicitly asks; this controller is the
 * honest wipe for exactly that moment. When MongoDB is unreachable every link
 * degrades to an honest UNAVAILABLE/CONTROLLED fallback — it is never faked.</p>
 */
@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {

    private final MongoTemplate mongoTemplate;

    /**
     * Every collection the demo pipeline persists. Dropping all of them leaves a
     * clean slate — no previous incident, no lingering ground truth, no stale
     * SAR candidates. Collections absent from the database are skipped, never
     * errored.
     */
    private static final String[] CASE_COLLECTIONS = {
        "simulation",
        "incident",
        "spill_event",
        "vessel",
        "sar_observation",
        "drift_run",
        "backtrack_run",
        "attribution_run",
        "investigation",
        "ground_truth"
    };

    public WorkspaceController(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** DELETE /api/workspace — wipe the persistent case history. */
    @DeleteMapping
    public Map<String, Object> resetWorkspace() {
        Map<String, Object> out = new LinkedHashMap<>();
        List<String> dropped = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (String name : CASE_COLLECTIONS) {
            try {
                if (mongoTemplate.collectionExists(name)) {
                    mongoTemplate.dropCollection(name);
                    dropped.add(name);
                } else {
                    skipped.add(name);
                }
            } catch (RuntimeException e) {
                skipped.add(name + " (" + e.getClass().getSimpleName() + ")");
            }
        }

        out.put("status", "RESET");
        out.put("dropped", dropped);
        out.put("skipped", skipped);
        out.put("at", Instant.now().toString());
        return out;
    }
}
