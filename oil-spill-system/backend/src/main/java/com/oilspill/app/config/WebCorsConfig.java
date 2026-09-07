package com.oilspill.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS policy for the browser frontend.
 *
 * The React dev server runs on http://localhost:3000 and the frontend calls
 * the backend at http://localhost:8082 directly (see http.ts VITE_API_URL).
 * Without permissive CORS those calls are blocked by the browser. We allow
 * localhost origins only; adjust in production as needed.
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                        "http://localhost:3000",
                        "http://127.0.0.1:3000",
                        "http://localhost:4173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}