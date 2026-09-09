package com.oilspill.app.config;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

/**
 * Lightweight scientific-service call metrics (Micrometer + Prometheus).
 *
 * Each call is timed with a dedicated {@link Timer} (name
 * {@code scientific_service_call_duration_seconds}, tag {@code endpoint}) and
 * the outcome is counted on {@code scientific_service_calls_total}
 * (tags {@code endpoint}, {@code outcome}=success/error). The registry is
 * auto-provided by spring-boot-starter-actuator + micrometer-registry-prometheus,
 * so the timers surface on {@code /actuator/prometheus}.
 */
@Component
public class ScienceMetrics {

    private final MeterRegistry meterRegistry;
    private final ConcurrentMap<String, Timer> timers = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, io.micrometer.core.instrument.Counter> counters = new ConcurrentHashMap<>();

    public ScienceMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    /** Run a blocking supplier, timing it and counting success/error outcomes. */
    public <T> T time(String endpoint, Supplier<T> op) {
        Timer timer = timers.computeIfAbsent(endpoint, e ->
                Timer.builder("scientific_service_call_duration_seconds")
                        .tag("endpoint", e)
                        .publishPercentiles(0.5, 0.95, 0.99)
                        .register(meterRegistry));
        long start = System.nanoTime();
        try {
            T result = op.get();
            count(endpoint, "success");
            return result;
        } catch (RuntimeException e) {
            count(endpoint, "error");
            throw e;
        } finally {
            timer.record(Duration.ofNanos(System.nanoTime() - start));
        }
    }

    private void count(String endpoint, String outcome) {
        String key = endpoint + "|" + outcome;
        counters.computeIfAbsent(key, k ->
                io.micrometer.core.instrument.Counter.builder("scientific_service_calls_total")
                        .tag("endpoint", endpoint)
                        .tag("outcome", outcome)
                        .register(meterRegistry)).increment();
    }

    // Keep Callable available for tests that may want checked-exception signatures.
    public <T> T timeCallable(String endpoint, Callable<T> op) throws Exception {
        return time(endpoint, () -> {
            try {
                return op.call();
            } catch (RuntimeException e) {
                throw e;
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }
}
