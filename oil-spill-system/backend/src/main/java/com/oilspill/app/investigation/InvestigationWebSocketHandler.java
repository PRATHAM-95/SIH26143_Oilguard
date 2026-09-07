package com.oilspill.app.investigation;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Raw JSON WebSocket handler for /ws/investigation/{investigationId} (STEP 11).
 * The investigation id is parsed from the path and sessions are registered with
 * the investigation broadcaster. Client->server frames are ignored, exactly as
 * on the simulation topic.
 */
@Component
public class InvestigationWebSocketHandler extends TextWebSocketHandler {

    public static final String PATH_PREFIX = "/ws/investigation/";

    private final InvestigationEventBroadcaster broadcaster;
    private final Map<String, String> sessionToInvestigation = new ConcurrentHashMap<>();

    public InvestigationWebSocketHandler(InvestigationEventBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String investigationId = investigationIdFromPath(session.getUri().getPath());
        if (investigationId == null) {
            try {
                session.close(CloseStatus.BAD_DATA);
            } catch (Exception ignored) {
                // best-effort close
            }
            return;
        }
        sessionToInvestigation.put(session.getId(), investigationId);
        broadcaster.register(investigationId, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // push-only topic; client->server frames are intentionally ignored
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionToInvestigation.remove(session.getId());
        broadcaster.unregister(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        broadcaster.unregister(session);
        sessionToInvestigation.remove(session.getId());
    }

    private String investigationIdFromPath(String path) {
        if (path == null || !path.startsWith(PATH_PREFIX)) {
            return null;
        }
        String id = path.substring(PATH_PREFIX.length());
        return id.isEmpty() ? null : id;
    }
}