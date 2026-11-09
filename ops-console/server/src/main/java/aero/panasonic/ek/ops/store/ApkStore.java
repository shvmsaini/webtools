/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * On-disk storage for operator-uploaded APK files.
 *
 * Files live under {@code dir} (system property {@code ops.console.apk.dir},
 * default {@code ./data/apks}) as {@code <id>.apk}. The SHA-256 is computed
 * here at upload time so the seat always verifies against bytes the server
 * actually stored, not against a value an operator typed in.
 */
package aero.panasonic.ek.ops.store;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Component
public class ApkStore {

    private static final Logger log = LoggerFactory.getLogger(ApkStore.class);

    /** Hard cap matching the seat-side limit in ApkUpdateBridge. */
    public static final long MAX_BYTES = 200L * 1024 * 1024;

    private final Path dir;

    public ApkStore() {
        this(System.getProperty("ops.console.apk.dir", "./data/apks"));
    }

    public ApkStore(String dir) {
        this.dir = Paths.get(dir).toAbsolutePath();
        try {
            Files.createDirectories(this.dir);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create APK dir: " + this.dir, e);
        }
    }

    /** Result of writing an uploaded APK to disk. */
    public record Stored(String sha256, long sizeBytes) {}

    /**
     * Streams the upload to {@code <id>.apk} while hashing it. Writes to a
     * temp file first so a failed or oversized upload never replaces a good
     * APK that seats may still be downloading.
     */
    public Stored save(String id, InputStream in) throws IOException {
        Path tmp = dir.resolve(id + ".apk.tmp");
        MessageDigest digest = newDigest();
        long total = 0;
        try (InputStream src = in) {
            Files.deleteIfExists(tmp);
            try (var out = Files.newOutputStream(tmp)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = src.read(buf)) != -1) {
                    total += n;
                    if (total > MAX_BYTES) {
                        throw new IOException("APK exceeds " + MAX_BYTES + " bytes");
                    }
                    digest.update(buf, 0, n);
                    out.write(buf, 0, n);
                }
            }
        } catch (IOException e) {
            Files.deleteIfExists(tmp);
            throw e;
        }
        Files.move(tmp, fileFor(id), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        String sha = toHex(digest.digest());
        log.info("saved APK id={} size={} sha256={}", id, total, sha);
        return new Stored(sha, total);
    }

    /** Returns the stored APK file, or null if none has been uploaded. */
    public Path fileFor(String id) {
        return dir.resolve(id + ".apk");
    }

    public boolean exists(String id) {
        return Files.exists(fileFor(id));
    }

    public void delete(String id) {
        try {
            Files.deleteIfExists(fileFor(id));
        } catch (IOException e) {
            log.warn("delete APK {} failed: {}", id, e.getMessage());
        }
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
