package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.AppSetting;
import aero.panasonic.ek.ops.model.DomainModels.FeatureFlagOverride;
import aero.panasonic.ek.ops.model.DomainModels.MediaWithdrawal;
import aero.panasonic.ek.ops.model.DomainModels.MenuStateReport;
import aero.panasonic.ek.ops.model.DomainModels.ThemePayload;
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
 * REST endpoints for remote configuration: feature flags, media
 * withdrawals, runtime app settings, and visual themes.
 */
@RestController
@RequestMapping("/api/v1/config")
public class ConfigController {

    private final InMemoryOpsStore store;

    public ConfigController(InMemoryOpsStore store) {
        this.store = store;
    }

    // ---------- Feature flags ----------

    @GetMapping("/features")
    public List<FeatureFlagOverride> listFeatures() {
        return store.listFeatureFlags();
    }

    @PostMapping("/features")
    public FeatureFlagOverride upsertFeature(@Valid @RequestBody FeatureFlagOverride flag) {
        return store.saveFeatureFlag(flag);
    }

    @DeleteMapping("/features/{name}")
    public ResponseEntity<Void> deleteFeature(@PathVariable String name) {
        return store.deleteFeatureFlag(name)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // ---------- Media withdrawals ----------

    @GetMapping("/withdrawals")
    public List<MediaWithdrawal> listWithdrawals() {
        return store.listWithdrawals();
    }

    @PostMapping("/withdrawals")
    public MediaWithdrawal upsertWithdrawal(@Valid @RequestBody MediaWithdrawal w) {
        return store.saveWithdrawal(w);
    }

    @DeleteMapping("/withdrawals/{mediaId}")
    public ResponseEntity<Void> deleteWithdrawal(@PathVariable String mediaId) {
        return store.deleteWithdrawal(mediaId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // ---------- App settings ----------

    @GetMapping("/settings")
    public List<AppSetting> listSettings() {
        return store.listSettings();
    }

    @GetMapping("/settings/{key}")
    public ResponseEntity<AppSetting> getSetting(@PathVariable String key) {
        return store.getSetting(key)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/settings")
    public AppSetting upsertSetting(@Valid @RequestBody AppSetting setting) {
        return store.saveSetting(setting);
    }

    @DeleteMapping("/settings/{key}")
    public ResponseEntity<Void> deleteSetting(@PathVariable String key) {
        return store.deleteSetting(key)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // ---------- Themes ----------

    @GetMapping("/themes")
    public List<ThemePayload> listThemes() {
        return store.listThemes();
    }

    @GetMapping("/themes/{id}")
    public ResponseEntity<ThemePayload> getTheme(@PathVariable String id) {
        return store.getTheme(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/themes")
    public ThemePayload upsertTheme(@Valid @RequestBody ThemePayload theme) {
        return store.saveTheme(theme);
    }

    @DeleteMapping("/themes/{id}")
    public ResponseEntity<Void> deleteTheme(@PathVariable String id) {
        return store.deleteTheme(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PostMapping("/themes/{id}/set-active")
    public ResponseEntity<ThemePayload> setThemeActive(@PathVariable String id) {
        return store.setThemeActive(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ---------- Bundle ----------

    @GetMapping("/bundle")
    public aero.panasonic.ek.ops.model.DomainModels.OperationsBundle bundle() {
        return store.toBundle();
    }

    // ---------- Menu state reports (pushed by the seatback) ----------

    /**
     * Seatback calls this whenever its sidebar menu changes (initial
     * load, feature flag toggle, kids-mode swap, etc.). The dashboard
     * uses the report to filter the feature flag list to only flags
     * that correspond to menu items the seatback actually has.
     */
    @PostMapping("/menu-state")
    public MenuStateReport upsertMenuState(@Valid @RequestBody MenuStateReport report) {
        return store.saveMenuStateReport(report);
    }

    @GetMapping("/menu-state")
    public List<MenuStateReport> listMenuStates() {
        return store.listMenuStateReports();
    }

    @GetMapping("/menu-state/{deviceId}")
    public ResponseEntity<MenuStateReport> getMenuState(@PathVariable String deviceId) {
        return store.getMenuStateReport(deviceId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
