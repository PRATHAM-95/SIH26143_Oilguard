package com.oilspill.app;

import com.oilspill.app.config.DotenvLoader;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class OilSpillApplication {
    public static void main(String[] args) {
        // Load oil-spill-system/.env (e.g. MONGODB_URI) before Spring resolves
        // ${MONGODB_URI:...} placeholders. Real OS env vars take precedence.
        DotenvLoader.load();
        SpringApplication.run(OilSpillApplication.class, args);
    }
}
