package com.oilspill.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class PythonClientConfig {

    @Value("${python.service.url}")
    private String pythonServiceUrl;

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
                .build();
    }
}
