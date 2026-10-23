package aero.panasonic.ek.ops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Operations Console — mock backend for the IFE seatback.
 *
 * Hosts the same REST surface as the modular-interactive seatback's
 * webtools module so the dashboard UI and the Android consumer can
 * be wired together without modification.
 */
@SpringBootApplication
public class OpsConsoleApplication {
    public static void main(String[] args) {
        SpringApplication.run(OpsConsoleApplication.class, args);
    }
}
