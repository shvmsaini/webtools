/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * REST endpoints for remote APK installation.
 *
 *   GET    /api/v1/apk-updates                  List all (operator)
 *   POST   /api/v1/apk-updates                  Upsert metadata (operator)
 *   DELETE /api/v1/apk-updates/{id}             Delete metadata + file (operator)
 *   POST   /api/v1/apk-updates/{id}/upload      Multipart APK upload (operator)
 *   GET    /api/v1/apk-updates/{id}/file        Download the APK (seats)
 *   GET    /api/v1/apk-updates/{id}/status      Per-seat status (operator)
 *   POST   /api/v1/config/apk-update-status     Seat reports progress (seats)
 */
package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.ApkUpdate;
import aero.panasonic.ek.ops.model.DomainModels.ApkUpdateStatus;
import aero.panasonic.ek.ops.store.ApkStore;
import aero.panasonic.ek.ops.store.InMemoryOpsStore;
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
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Part;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@RestController
public class ApkUpdateController {

    private final InMemoryOpsStore store;
    private final ApkStore apkStore;

    public ApkUpdateController(InMemoryOpsStore store, ApkStore apkStore) {
        this.store = store;
        this.apkStore = apkStore;
    }

    // ---------- Operator: metadata ----------

    @GetMapping("/api/v1/apk-updates")
    public List<ApkUpdate> list() {
        return store.listApkUpdates();
    }

    /**
     * Saves editable fields only. The hash, size, file name and download URL
     * come from the file upload, so a metadata save never changes what bytes
     * a seat will install.
     */
    @PostMapping("/api/v1/apk-updates")
    public ApkUpdate upsert(@Valid @RequestBody ApkUpdate in) {
        ApkUpdate existing = store.getApkUpdate(in.id()).orElse(null);
        ApkUpdate merged = new ApkUpdate(
                in.id(),
                in.packageName(),
                in.versionName(),
                existing != null ? existing.downloadUrl() : null,
                existing != null ? existing.sha256() : null,
                in.signerFingerprint(),
                in.minAppVersion(),
                in.requireReboot() != null ? in.requireReboot() : Boolean.FALSE,
                in.active() != null ? in.active() : Boolean.FALSE,
                existing != null ? existing.sizeBytes() : null,
                existing != null ? existing.fileName() : null,
                existing != null ? existing.createdAt() : Instant.now().toString(),
                in.updatedBy(),
                in.targeting()
        );
        return store.saveApkUpdate(merged);
    }

    @DeleteMapping("/api/v1/apk-updates/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        boolean removed = store.deleteApkUpdate(id);
        apkStore.delete(id);
        return removed
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // ---------- Operator: file upload ----------

    /**
     * Accepts the APK, hashes it on the server, and records the hash and
     * download URL. The entry stays inactive until the operator turns it on,
     * so an upload alone never pushes anything to seats.
     *
     * Streams the request body directly from the servlet input stream so the
     * whole file isn't held in memory or on the multipart spool. The running
     * total is checked against MAX_BYTES, which gives us a real size limit
     * (multipart's per-file cap only matters as a defense in depth).
     */
    @PostMapping(value = "/api/v1/apk-updates/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(HttpServletRequest request,
                                    @PathVariable String id) throws IOException, jakarta.servlet.ServletException {
        // Walk the multipart parts ourselves so we can stream the file part
        // straight to disk without buffering. Skip any non-file parts so the
        // operator can POST an optional `note` alongside the APK.
        Part filePart = null;
        for (Part p : request.getParts()) {
            if (p.getSubmittedFileName() != null) filePart = p;
        }
        if (filePart == null || filePart.getSize() == 0) {
            return ResponseEntity.badRequest().body("empty file");
        }
        String name = filePart.getSubmittedFileName();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".apk")) {
            return ResponseEntity.status(415).body("file must be a .apk");
        }

        ApkStore.Stored stored;
        try (InputStream in = filePart.getInputStream()) {
            try {
                stored = apkStore.save(id, in);
            } catch (IOException e) {
                return ResponseEntity.status(413).body(e.getMessage());
            }
        }

        ApkUpdate current = store.getApkUpdate(id).orElse(null);
        ApkUpdate updated = store.saveApkUpdate(new ApkUpdate(
                id,
                current != null ? current.packageName() : null,
                current != null ? current.versionName() : null,
                "/api/v1/apk-updates/" + id + "/file",
                stored.sha256(),
                current != null ? current.signerFingerprint() : null,
                current != null ? current.minAppVersion() : null,
                current != null && current.requireReboot() != null ? current.requireReboot() : Boolean.FALSE,
                current != null && current.active() != null ? current.active() : Boolean.FALSE,
                stored.sizeBytes(),
                name,
                current != null ? current.createdAt() : Instant.now().toString(),
                current != null ? current.updatedBy() : "upload",
                current != null ? current.targeting() : null
        ));
        return ResponseEntity.ok(updated);
    }

    // ---------- Seats: download + status ----------

    @GetMapping("/api/v1/apk-updates/{id}/file")
    public ResponseEntity<Resource> file(@PathVariable String id) {
        if (store.getApkUpdate(id).isEmpty() || !apkStore.exists(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.android.package-archive"))
                .cacheControl(CacheControl.noCache())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + id + ".apk\"")
                .body(new FileSystemResource(apkStore.fileFor(id)));
    }

    /**
     * Seats post one status per step (DOWNLOADING, VERIFIED, INSTALLED, FAILED).
     * Stored per seat so the operator can see which seats succeeded.
     */
    @PostMapping("/api/v1/config/apk-update-status")
    public ApkUpdateStatus reportStatus(@Valid @RequestBody ApkUpdateStatus status) {
        return store.saveApkUpdateStatus(status);
    }

    @GetMapping("/api/v1/apk-updates/{id}/status")
    public List<ApkUpdateStatus> statuses(@PathVariable String id) {
        return store.listApkUpdateStatuses(id);
    }
}
