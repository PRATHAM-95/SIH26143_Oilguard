package com.oilspill.app.config;

import com.oilspill.app.attribution.AttributionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Global structured-error boundary for domain exceptions thrown before a
 * scientific run's transaction starts (so they surface as clean 4xx JSON
 * instead of an unhandled 500).
 *
 * Controllers that already declare their own {@link ExceptionHandler}s keep
 * precedence for their own types; this advice covers only the attribution
 * anchor-resolution path that previously escaped as an opaque 500.
 */
@RestControllerAdvice
public class ApiExceptionAdvice {

    @ExceptionHandler(AttributionService.AnchorNotResolved.class)
    public ResponseEntity<Map<String, Object>> handleAnchorNotResolved(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(AttributionService.BacktrackAnchorNotFound.class)
    public ResponseEntity<Map<String, Object>> handleBacktrackAnchorNotFound(RuntimeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }
}