package com.oilspill.app.websocket;

import com.oilspill.app.investigation.InvestigationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Raw JSON WebSocket endpoints (SYSTEM_SPEC §15.3). A single handler serves
 * every /ws/simulation/{id}; the simulation id is parsed from the path.
 * STEP 11 adds the investigation topic /ws/investigation/{investigationId}
 * served by its own handler.
 *
 * Protocol choice: plain JSON WebSocket (not STOMP/SockJS). The Step 03
 * frontend SocketClient already speaks raw JSON frames shaped exactly like the
 * §15.3 event contract, so keeping one JSON protocol avoids a translation
 * layer and a second competing protocol. Documented in Step 04 report.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SimulationWebSocketHandler simulationHandler;
    private final InvestigationWebSocketHandler investigationHandler;

    public WebSocketConfig(SimulationWebSocketHandler simulationHandler,
                           InvestigationWebSocketHandler investigationHandler) {
        this.simulationHandler = simulationHandler;
        this.investigationHandler = investigationHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(simulationHandler, "/ws/simulation/{simulationId}")
                .setAllowedOriginPatterns("*");
        registry.addHandler(investigationHandler, "/ws/investigation/{investigationId}")
                .setAllowedOriginPatterns("*");
    }
}