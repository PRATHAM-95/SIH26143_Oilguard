package com.oilspill.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class PythonClientConfig {

    @Value("${python.service.url}")
    private String pythonServiceUrl;

    @Bean
    public WebClient pythonWebClient() {
        return WebClient.builder()
                .baseUrl(pythonServiceUrl)
                .build();
    }
}
