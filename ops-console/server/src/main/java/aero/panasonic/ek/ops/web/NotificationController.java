package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.NotificationPayload;
import aero.panasonic.ek.ops.store.InMemoryOpsStore;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST endpoints for push notifications.
 *
 *   POST   /api/v1/notifications          Send a notification
 *   GET    /api/v1/notifications          List recent notifications
 *   GET    /api/v1/notifications/{id}     Get one
 *   DELETE /api/v1/notifications/{id}     Delete one
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final InMemoryOpsStore store;

    public NotificationController(InMemoryOpsStore store) {
        this.store = store;
    }

    @PostMapping
    public ResponseEntity<NotificationPayload> create(@Valid @RequestBody NotificationPayload payload) {
        return ResponseEntity.ok(store.saveNotification(payload));
    }

    @GetMapping
    public List<NotificationPayload> list() {
        return store.listNotifications();
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotificationPayload> get(@PathVariable String id) {
        return store.getNotification(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return store.deleteNotification(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
