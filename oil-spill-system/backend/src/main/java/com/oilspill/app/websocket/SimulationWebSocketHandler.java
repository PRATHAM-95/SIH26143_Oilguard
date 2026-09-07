package com.oilspill.app.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Raw JSON WebSocket handler for /ws/simulation/{id} (SYSTEM_SPEC §15.3).
 *
 * The simulation id is parsed from the URI path. Sessions are registered with
 * the broadcaster so that clock/vessel/spill events reach the correct
 * audience. Client->server frames are accepted but unused in Captain Mode
 * (all simulation actions happen over REST); unsolicited input is ignored,
 * not echoed.
 */
@Component
public class SimulationWebSocketHandler extends TextWebSocketHandler {

    public static final String PATH_PREFIX = "/ws/simulation/";

    private final SimulationEventBroadcaster broadcaster;
    private final Map<String, String> sessionToSimulation = new ConcurrentHashMap<>();

    public SimulationWebSocketHandler(SimulationEventBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String simulationId = simulationIdFromPath(session.getUri().getPath());
        if (simulationId == null) {
            try {
                session.close(CloseStatus.BAD_DATA);
            } catch (Exception ignored) {
                // best-effort close
            }
            return;
        }
        sessionToSimulation.put(session.getId(), simulationId);
        broadcaster.register(simulationId, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Captain mode is push-only from the server; client->server frames are
        // intentionally ignored (not echoed) to avoid a competing control path.
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionToSimulation.remove(session.getId());
        broadcaster.unregister(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        broadcaster.unregister(session);
        sessionToSimulation.remove(session.getId());
    }

    private String simulationIdFromPath(String path) {
        if (path == null || !path.startsWith(PATH_PREFIX)) {
            return null;
        }
        String id = path.substring(PATH_PREFIX.length());
        return id.isEmpty() ? null : id;
    }
}