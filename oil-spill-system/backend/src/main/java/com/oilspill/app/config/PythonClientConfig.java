package com.oilspill.app.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.client.reactive.ClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
public class PythonClientConfig {

    @Value("${python.service.url}")
    private String pythonServiceUrl;

    @Value("${python.service.connect-timeout-seconds:5}")
    private int connectTimeoutSeconds = 5;

    @Value("${python.service.response-timeout-seconds:300}")
    private int responseTimeoutSeconds = 300;

    @Value("${python.service.max-connections:200}")
    private int maxConnections = 200;

    @Value("${python.service.max-idle-time-seconds:60}")
    private int maxIdleSeconds = 60;

    @Value("${python.service.max-life-seconds:300}")
    private int maxLifeSeconds = 300;

    @Bean
    public ClientHttpConnector pythonClientHttpConnector() {
        // Connection-pooled, keep-alive HTTP client to the scientific service.
        // Reusing pooled + idle-timeout connections avoids TCP+TLS handshakes on
        // every science call and keeps the backend from exhausting ephemeral
        // ports under concurrent investigation load.
        ConnectionProvider provider = ConnectionProvider.builder("python-sci")
                .maxConnections(maxConnections)
                .maxIdleTime(Duration.ofSeconds(maxIdleSeconds))
                .maxLifeTime(Duration.ofSeconds(maxLifeSeconds))
                .pendingAcquireTimeout(Duration.ofSeconds(30))
                .build();

        HttpClient httpClient = HttpClient.create(provider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectTimeoutSeconds * 1000)
                .responseTimeout(Duration.ofSeconds(responseTimeoutSeconds))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(responseTimeoutSeconds, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(responseTimeoutSeconds, TimeUnit.SECONDS)));

        return new ReactorClientHttpConnector(httpClient);
    }

    @Bean
    public WebClient pythonWebClient() {
        // AIS track payloads (full message series per candidate) can exceed the
        // 256 KB default in-memory buffer; 8 MB keeps large query responses safe.
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024))
                .build();
        return WebClient.builder()
                .baseUrl(pythonServiceUrl)
                .exchangeStrategies(strategies)
                .clientConnector(pythonClientHttpConnector())
                .build();
    }
}
