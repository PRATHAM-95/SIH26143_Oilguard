package com.oilspill.app.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Minimal {@code .env} loader so local development needs no shell magic.
 *
 * <p>Convention: the file lives at {@code <repo root>/oil-spill-system/.env}
 * next to the three services. The loader walks up from the current working
 * directory looking for {@code oil-spill-system/.env} (falling back to a plain
 * {@code .env} in the working directory) and exposes each {@code KEY=VALUE}
 * line as a system property.</p>
 *
 * <p>Rules:
 * <ul>
 *   <li>Genuine OS environment variables always win — a key already exported
 *       in the process environment is never overridden by the file.</li>
 *   <li>{@code #} comments and blank lines are ignored; inline values after
 *       an unquoted {@code #} are kept verbatim (no shell-style splitting).</li>
 *   <li>Empty values are skipped, letting Spring's
 *       {@code ${MONGODB_URI:mongodb://localhost:27017}} defaults apply.</li>
 *   <li>Failures are logged at debug level and never abort startup.</li>
 * </ul>
 */
public final class DotenvLoader {

    private DotenvLoader() {
    }

    public static void load() {
        Path envFile = findEnvFile();
        if (envFile == null) {
            return;
        }
        Map<String, String> entries = new LinkedHashMap<>();
        try {
            for (String raw : Files.readAllLines(envFile, StandardCharsets.UTF_8)) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#") || line.startsWith("export ")) {
                    continue;
                }
                int eq = line.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();
                if (!key.isEmpty() && !value.isEmpty() && !System.getenv().containsKey(key)) {
                    entries.put(key, value);
                }
            }
        } catch (IOException e) {
            System.out.println("[dotenv] could not read " + envFile + ": " + e.getMessage());
            return;
        }
        for (Map.Entry<String, String> e : entries.entrySet()) {
            System.setProperty(e.getKey(), e.getValue());
        }
        System.out.println("[dotenv] loaded " + entries.size() + " variable(s) from " + envFile);
    }

    private static Path findEnvFile() {
        Path cwd = Paths.get("").toAbsolutePath().normalize();
        Path candidate = cwd.resolve("oil-spill-system/.env");
        if (Files.isRegularFile(candidate)) {
            return candidate;
        }
        Path current = cwd;
        for (int depth = 0; depth < 6 && current != null; depth++) {
            Path oilspill = current.resolve("oil-spill-system/.env");
            if (Files.isRegularFile(oilspill)) {
                return oilspill;
            }
            Path plain = current.resolve(".env");
            if (Files.isRegularFile(plain)) {
                return plain;
            }
            current = current.getParent();
        }
        return null;
    }
}