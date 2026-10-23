package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.AppSetting;
import aero.panasonic.ek.ops.model.DomainModels.FeatureFlagOverride;
import aero.panasonic.ek.ops.model.DomainModels.MediaWithdrawal;
import aero.panasonic.ek.ops.model.DomainModels.ThemePayload;
import aero.panasonic.ek.ops.model.DomainModels.WebExperience;
import aero.panasonic.ek.ops.store.InMemoryOpsStore;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST endpoints for WebView experiences.
 *
 *   GET    /api/v1/webview/experiences       List all experiences
 *   GET    /api/v1/webview/experiences/{id}  Get one
 *   PUT    /api/v1/webview/experiences/{id}  Upsert one
 *   DELETE /api/v1/webview/experiences/{id}  Delete one
 */
@RestController
@RequestMapping("/api/v1/webview")
public class WebViewController {

    private final InMemoryOpsStore store;

    public WebViewController(InMemoryOpsStore store) {
        this.store = store;
    }

    @GetMapping("/experiences")
    public List<WebExperience> list() {
        return store.listWebviewExperiences();
    }

    @GetMapping("/experiences/{id}")
    public ResponseEntity<WebExperience> get(@PathVariable String id) {
        return store.getWebviewExperience(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/experiences/{id}")
    public WebExperience upsert(@PathVariable String id, @Valid @RequestBody WebExperience exp) {
        WebExperience normalized = new WebExperience(
                id,
                exp.title(),
                exp.type(),
                exp.url(),
                exp.iconUrl(),
                exp.active(),
                exp.autoOpen(),
                exp.schedule(),
                exp.targeting(),
                exp.display(),
                exp.metadata(),
                exp.pinnedToFooter(),
                exp.footerPosition()
        );
        return store.saveWebviewExperience(normalized);
    }

    @DeleteMapping("/experiences/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return store.deleteWebviewExperience(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
