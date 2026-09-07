package com.oilspill.app.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds live WebSocket sessions keyed by simulation id and broadcasts
 * JSON event frames to all subscribers of a simulation.
 */
@Service
public class SimulationEventBroadcaster {

    private final ObjectMapper objectMapper;
    private final Map<String, Map<String, WebSocketSession>> sessionsBySimulation =
            new ConcurrentHashMap<>();

    public SimulationEventBroadcaster(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(String simulationId, WebSocketSession session) {
        sessionsBySimulation
                .computeIfAbsent(simulationId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), session);
    }

    public void unregister(WebSocketSession session) {
        for (Map<String, WebSocketSession> sessions : sessionsBySimulation.values()) {
            sessions.remove(session.getId());
        }
    }

    public int subscriberCount(String simulationId) {
        Map<String, WebSocketSession> sessions = sessionsBySimulation.get(simulationId);
        return sessions == null ? 0 : sessions.size();
    }

    public void broadcast(String simulationId, SimulationEvent event) {
        Map<String, WebSocketSession> sessions = sessionsBySimulation.get(simulationId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        try {
            String payload = objectMapper.writeValueAsString(event);
            TextMessage message = new TextMessage(payload);
            for (WebSocketSession session : sessions.values()) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(message);
                    } catch (IOException e) {
                        // a failing subscriber must not break the broadcast loop
                        sessions.remove(session.getId());
                    }
                } else {
                    sessions.remove(session.getId());
                }
            }
        } catch (IOException e) {
            // serialisation failure — log and drop
            System.err.println("broadcast serialisation failed: " + e.getMessage());
        }
    }
}