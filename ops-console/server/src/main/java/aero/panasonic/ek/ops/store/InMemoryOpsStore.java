package aero.panasonic.ek.ops.store;

import aero.panasonic.ek.ops.model.DomainModels.AppSetting;
import aero.panasonic.ek.ops.model.DomainModels.FeatureFlagOverride;
import aero.panasonic.ek.ops.model.DomainModels.MediaWithdrawal;
import aero.panasonic.ek.ops.model.DomainModels.MenuStateReport;
import aero.panasonic.ek.ops.model.DomainModels.NotificationPayload;
import aero.panasonic.ek.ops.model.DomainModels.OperationsBundle;
import aero.panasonic.ek.ops.model.DomainModels.ThemePayload;
import aero.panasonic.ek.ops.model.DomainModels.Wallpaper;
import aero.panasonic.ek.ops.model.DomainModels.WebExperience;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory store for the Operations Console mock backend.
 *
 * Thread-safe via {@link ConcurrentHashMap}. Data is lost on restart
 * — production replaces this with a real database.
 *
 * Records are kept in insertion order so listings are deterministic.
 */
@Component
public class InMemoryOpsStore {

    private final ConcurrentHashMap<String, NotificationPayload> notifications = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, WebExperience> webviewExperiences = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, FeatureFlagOverride> featureFlags = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, MediaWithdrawal> withdrawnMedia = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AppSetting> settings = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ThemePayload> themes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Wallpaper> wallpapers = new ConcurrentHashMap<>();
    // deviceId -> most recent MenuStateReport from that seatback
    private final ConcurrentHashMap<String, MenuStateReport> menuStateReports = new ConcurrentHashMap<>();

    public InMemoryOpsStore() {
        // Themes ship with a default palette so the seatback has a baseline
        // before an operator pushes one. Feature flags and notifications start empty
        // — operators populate them through the dashboard.
        themes.put("leanback-default", new ThemePayload(
                "leanback-default",
                "Leanback Default",
                "Default Panasonic theme palette.",
                leanbackDefaultTokens(),
                Instant.now().toString(),
                "system"
        ));

        // Initialize default feature flags so the seatback always has
        // a known set of features to toggle on/off. All default to enabled=true
        // so the operator can disable any they don't want.
        initializeDefaultFeatureFlags();
    }

    private void initializeDefaultFeatureFlags() {
        String[] defaultFlagNames = {"MOVIES", "SHOWS", "LIVE_TV", "MY_FLIGHT", "INFORMATION", "INTERNET"};
        for (String name : defaultFlagNames) {
            FeatureFlagOverride flag = new FeatureFlagOverride(
                    name,
                    true,  // enabled by default
                    null,  // no expiration
                    "Default from seatback",
                    Instant.now().toString(),
                    "system"
            );
            featureFlags.put(name, flag);
        }
    }

    private static Map<String, String> leanbackDefaultTokens() {
        Map<String, String> t = new LinkedHashMap<>();
        t.put("primary", "#d71921");
        t.put("primaryDark", "#b91419");
        t.put("primaryLight", "#fef2f3");
        t.put("background", "#0a001a");
        t.put("surface", "#1e293b");
        t.put("textPrimary", "#f5f5f9");
        t.put("textMuted", "#bcb7c8");
        t.put("footerBackground", "#0a001a");
        t.put("footerItem", "#d71921");
        return t;
    }

    // ---------- Notifications ----------

    public NotificationPayload saveNotification(NotificationPayload n) {
        NotificationPayload stamped = new NotificationPayload(
                n.id(),
                n.title(),
                n.body(),
                n.iconUrl(),
                n.ctaUrl(),
                n.autoOpen(),
                n.mandatory(),
                n.channel(),
                n.targeting(),
                n.expiresAt(),
                Instant.now().toString(),
                n.createdBy(),
                n.category()
        );
        notifications.put(n.id(), stamped);
        return stamped;
    }

    public Optional<NotificationPayload> getNotification(String id) {
        return Optional.ofNullable(notifications.get(id));
    }

    public List<NotificationPayload> listNotifications() {
        return sortedById(notifications);
    }

    public boolean deleteNotification(String id) {
        return notifications.remove(id) != null;
    }

    // ---------- WebView experiences ----------

    public WebExperience saveWebviewExperience(WebExperience e) {
        webviewExperiences.put(e.id(), e);
        return e;
    }

    public Optional<WebExperience> getWebviewExperience(String id) {
        return Optional.ofNullable(webviewExperiences.get(id));
    }

    public List<WebExperience> listWebviewExperiences() {
        return sortedById(webviewExperiences);
    }

    public boolean deleteWebviewExperience(String id) {
        return webviewExperiences.remove(id) != null;
    }

    // ---------- Feature flags ----------

    public FeatureFlagOverride saveFeatureFlag(FeatureFlagOverride f) {
        featureFlags.put(f.name(), f);
        return f;
    }

    public Optional<FeatureFlagOverride> getFeatureFlag(String name) {
        return Optional.ofNullable(featureFlags.get(name));
    }

    public boolean deleteFeatureFlag(String name) {
        featureFlags.remove(name);
        // Ensure defaults always exist: restore if we just deleted a default flag
        ensureDefaultFlagsExist();
        return true;
    }

    private void ensureDefaultFlagsExist() {
        String[] defaultFlagNames = {"MOVIES", "SHOWS", "LIVE_TV", "MY_FLIGHT", "INFORMATION", "INTERNET"};
        for (String name : defaultFlagNames) {
            if (!featureFlags.containsKey(name)) {
                FeatureFlagOverride flag = new FeatureFlagOverride(
                        name,
                        true,  // re-enable when restored
                        null,
                        "Default from seatback",
                        Instant.now().toString(),
                        "system"
                );
                featureFlags.put(name, flag);
            }
        }
    }

    public List<FeatureFlagOverride> listFeatureFlags() {
        // Ensure all 6 defaults are always present
        ensureDefaultFlagsExist();
        return sortedById(featureFlags);
    }

    // ---------- Media withdrawals ----------

    public MediaWithdrawal saveWithdrawal(MediaWithdrawal w) {
        withdrawnMedia.put(w.mediaId(), w);
        return w;
    }

    public boolean deleteWithdrawal(String mediaId) {
        return withdrawnMedia.remove(mediaId) != null;
    }

    public List<MediaWithdrawal> listWithdrawals() {
        return sortedById(withdrawnMedia);
    }

    // ---------- App settings ----------

    public AppSetting saveSetting(AppSetting s) {
        settings.put(s.key(), s);
        return s;
    }

    public boolean deleteSetting(String key) {
        return settings.remove(key) != null;
    }

    public Optional<AppSetting> getSetting(String key) {
        return Optional.ofNullable(settings.get(key));
    }

    public List<AppSetting> listSettings() {
        return sortedById(settings);
    }

    // ---------- Themes ----------

    public ThemePayload saveTheme(ThemePayload t) {
        ThemePayload stamped = new ThemePayload(
                t.id(),
                t.label(),
                t.description(),
                t.colorTokens(),
                Instant.now().toString(),
                t.updatedBy()
        );
        themes.put(t.id(), stamped);
        return stamped;
    }

    public boolean deleteTheme(String id) {
        return themes.remove(id) != null;
    }

    /**
     * Move a theme to the end of the list so it becomes the active theme
     * (the app applies the last theme in the bundle).
     */
    public Optional<ThemePayload> setThemeActive(String id) {
        ThemePayload theme = themes.get(id);
        if (theme == null) return Optional.empty();

        // Remove and re-add to move to end
        themes.remove(id);
        themes.put(id, theme);
        return Optional.of(theme);
    }

    public Optional<ThemePayload> getTheme(String id) {
        return Optional.ofNullable(themes.get(id));
    }

    public List<ThemePayload> listThemes() {
        return sortedById(themes);
    }

    // ---------- Wallpapers ----------

    public Wallpaper saveWallpaper(Wallpaper w) {
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

    public boolean deleteWallpaper(String id) {
        return wallpapers.remove(id) != null;
    }

    public Optional<Wallpaper> getWallpaper(String id) {
        return Optional.ofNullable(wallpapers.get(id));
    }

    public List<Wallpaper> listWallpapers() {
        return sortedById(wallpapers);
    }

    // ---------- Menu state reports ----------
    /**
     * Persist the most recent menu state from a seatback. Older reports
     * for the same device are overwritten so the dashboard always sees the
     * latest sidebar layout the seatback actually rendered.
     */
    public MenuStateReport saveMenuStateReport(MenuStateReport report) {
        if (report == null || report.deviceId() == null || report.deviceId().isBlank()) {
            throw new IllegalArgumentException("deviceId is required");
        }
        menuStateReports.put(report.deviceId(), report);
        return report;
    }

    public Optional<MenuStateReport> getMenuStateReport(String deviceId) {
        return Optional.ofNullable(menuStateReports.get(deviceId));
    }

    public List<MenuStateReport> listMenuStateReports() {
        return sortedById(menuStateReports);
    }

    // ---------- Bundle ----------

    public OperationsBundle toBundle() {
        return new OperationsBundle(
                "1.0",
                Instant.now().toString(),
                listFeatureFlags(),
                listWithdrawals(),
                listSettings(),
                listWebviewExperiences(),
                listNotifications(),
                listThemes(),
                listWallpapers()
        );
    }

    // ---------- Helpers ----------

    @SuppressWarnings("unchecked")
    private static <T> List<T> sortedById(ConcurrentHashMap<String, T> map) {
        return map.values().stream()
                .sorted(Comparator.comparing((T o) -> o.getClass().getSimpleName() + ":" + o.toString()))
                .collect(Collectors.toCollection(ArrayList::new));
    }
}
