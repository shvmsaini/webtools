/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * REST endpoints for operator-uploaded wallpapers.
 *
 *   GET    /api/v1/wallpapers                 List all
 *   GET    /api/v1/wallpapers/{id}            Get one (JSON metadata)
 *   POST   /api/v1/wallpapers                 Upsert one (JSON)
 *   DELETE /api/v1/wallpapers/{id}            Delete metadata + image
 *   POST   /api/v1/wallpapers/{id}/upload     Multipart image upload
 *   GET    /api/v1/wallpapers/{id}/image      Stream the uploaded image
 */
package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.Wallpaper;
import aero.panasonic.ek.ops.store.InMemoryOpsStore;
import aero.panasonic.ek.ops.store.WallpaperStore;
import jakarta.validation.Valid;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/wallpapers")
public class WallpaperController {

    private static final List<String> ALLOWED_TYPES = List.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );

    private final InMemoryOpsStore store;
    private final WallpaperStore wallpaperStore;

    public WallpaperController(InMemoryOpsStore store, WallpaperStore wallpaperStore) {
        this.store = store;
        this.wallpaperStore = wallpaperStore;
    }

    @GetMapping
    public List<Wallpaper> list() {
        return store.listWallpapers();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Wallpaper> get(@PathVariable String id) {
        return store.getWallpaper(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Wallpaper upsert(@Valid @RequestBody Wallpaper w) {
        return store.saveWallpaper(w);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        boolean removed = store.deleteWallpaper(id);
        wallpaperStore.delete(id);
        return removed
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Wallpaper> upload(@PathVariable String id,
                                            @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            return ResponseEntity.status(415).build();
        }
        // Ensure the metadata row exists so dashboard uploads before
        // saving the form don't 404.
        store.saveWallpaper(new Wallpaper(
                id,
                store.getWallpaper(id).map(Wallpaper::label).orElse(id),
                "",
                true,
                java.time.Instant.now().toString(),
                "upload"
        ));

        Path saved = wallpaperStore.saveImage(id, file.getBytes(), contentType);
        String imageUrl = "/api/v1/wallpapers/" + id + "/image";
        Wallpaper updated = store.saveWallpaper(new Wallpaper(
                id,
                store.getWallpaper(id).map(Wallpaper::label).orElse(id),
                imageUrl,
                true,
                java.time.Instant.now().toString(),
                store.getWallpaper(id).map(Wallpaper::updatedBy).orElse("upload")
        ));
        // Refresh imageUrl in case the row above was just bootstrapped.
        updated = store.saveWallpaper(new Wallpaper(
                id,
                updated.label(),
                imageUrl,
                updated.active(),
                java.time.Instant.now().toString(),
                updated.updatedBy()
        ));
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<Resource> image(@PathVariable String id) {
        Path file = wallpaperStore.imageFor(id);
        if (file == null || !Files.exists(file)) {
            return ResponseEntity.notFound().build();
        }
        String contentType = contentTypeFor(file.getFileName().toString());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getFileName() + "\"")
                .body(new FileSystemResource(file));
    }

    private static String contentTypeFor(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        return "image/jpeg";
    }
}
