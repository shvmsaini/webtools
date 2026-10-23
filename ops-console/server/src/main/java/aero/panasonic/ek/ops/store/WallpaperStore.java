/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * In-memory store for operator-uploaded wallpaper images.
 *
 * Thread-safe via ConcurrentHashMap. Image bytes live on disk under
 * {@code dir} (configurable via the {@code ops.console.wallpaper.dir}
 * system property; defaults to {@code ./data/wallpapers}). The store
 * owns the file lifecycle: deleting a wallpaper also removes its file.
 *
 * The list returned to callers is deterministic (insertion order).
 */
package aero.panasonic.ek.ops.store;

import aero.panasonic.ek.ops.model.DomainModels.Wallpaper;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
public class WallpaperStore {

    private static final org.slf4j.Logger log = LoggerFactory.getLogger(WallpaperStore.class);

    private final Path dir;
    private final ConcurrentHashMap<String, Wallpaper> wallpapers = new ConcurrentHashMap<>();

    public WallpaperStore() {
        this(System.getProperty("ops.console.wallpaper.dir", "./data/wallpapers"));
    }

    public WallpaperStore(String dir) {
        this.dir = Paths.get(dir).toAbsolutePath();
        try {
            Files.createDirectories(this.dir);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create wallpaper dir: " + this.dir, e);
        }
    }

    public Path dir() {
        return dir;
    }

    public Wallpaper save(Wallpaper w) {
        Wallpaper stamped = new Wallpaper(
                w.id(),
                w.label(),
                w.imageUrl(),
                w.active() != null ? w.active() : Boolean.TRUE,
                Instant.now().toString(),
                w.updatedBy()
        );
        wallpapers.put(w.id(), stamped);
        return stamped;
    }

    public Optional<Wallpaper> get(String id) {
        return Optional.ofNullable(wallpapers.get(id));
    }

    public List<Wallpaper> list() {
        return wallpapers.values().stream()
                .sorted(Comparator.comparing(Wallpaper::id))
                .collect(Collectors.toList());
    }

    /**
     * Delete the row and its associated image file. Returns true if the
     * row existed; the file may or may not have existed.
     */
    public boolean delete(String id) {
        Wallpaper removed = wallpapers.remove(id);
        if (removed == null) return false;
        deleteFileFor(id);
        return true;
    }

    /**
     * Resolve the on-disk image for a wallpaper id, or null if no file
     * has been uploaded yet. Image extension is preserved so browsers
     * and the seatback decode with the right MIME hint.
     */
    public Path imageFor(String id) {
        if (wallpapers.get(id) == null) return null;
        try (Stream<Path> stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.getFileName().toString().startsWith(id + "."))
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            log.warn("imageFor: list failed for {}: {}", dir, e.getMessage());
            return null;
        }
    }

    /**
     * Save raw image bytes for a wallpaper id. {@code contentType} is
     * one of {@code image/jpeg}, {@code image/png}, {@code image/webp}.
     * Returns the resolved on-disk path.
     */
    public Path saveImage(String id, byte[] bytes, String contentType) throws IOException {
        String ext = extensionFor(contentType);
        Path target = dir.resolve(id + ext);
        Files.write(target, bytes);
        return target;
    }

    private void deleteFileFor(String id) {
        try (Stream<Path> stream = Files.list(dir)) {
            stream
                    .filter(p -> p.getFileName().toString().startsWith(id + "."))
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); }
                        catch (IOException e) { log.warn("delete failed {}: {}", p, e.getMessage()); }
                    });
        } catch (IOException e) {
            log.warn("deleteFileFor: list failed for {}: {}", dir, e.getMessage());
        }
    }

    private static String extensionFor(String contentType) {
        if (contentType == null) return ".jpg";
        return switch (contentType.toLowerCase()) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }
}
