package com.oilspill.app.investigation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds live WebSocket sessions keyed by investigation id and broadcasts JSON
 * investigation event frames to the subscribers of one investigation topic.
 */
@Service
public class InvestigationEventBroadcaster {

    private final ObjectMapper objectMapper;
    private final Map<String, Map<String, WebSocketSession>> sessionsByInvestigation =
            new ConcurrentHashMap<>();

    public InvestigationEventBroadcaster(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(String investigationId, WebSocketSession session) {
        sessionsByInvestigation
                .computeIfAbsent(investigationId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), session);
    }

    public void unregister(WebSocketSession session) {
        for (Map<String, WebSocketSession> sessions : sessionsByInvestigation.values()) {
            sessions.remove(session.getId());
        }
    }

    public int subscriberCount(String investigationId) {
        Map<String, WebSocketSession> sessions = sessionsByInvestigation.get(investigationId);
        return sessions == null ? 0 : sessions.size();
    }

    public void broadcast(String investigationId, InvestigationEvent event) {
        Map<String, WebSocketSession> sessions = sessionsByInvestigation.get(investigationId);
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
                        sessions.remove(session.getId());
                    }
                } else {
                    sessions.remove(session.getId());
                }
            }
        } catch (IOException e) {
            System.err.println("investigation broadcast serialization failed: " + e.getMessage());
        }
    }
}