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
                Boolean.TRUE,  // active by default so the seatback picks it up
                Instant.now().toString(),
                "system",
                null  // broadcast — default applies to every seat
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
                    "system",
                    null  // broadcast — defaults apply to every seat
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
        FeatureFlagOverride stamped = new FeatureFlagOverride(
                f.name(),
                f.enabled(),
                f.expiresAt(),
                f.reason(),
                Instant.now().toString(),
                f.updatedBy(),
                f.targeting()
        );
        featureFlags.put(f.name(), stamped);
        return stamped;
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
                        "system",
                        null  // broadcast — defaults apply to every seat
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
        MediaWithdrawal stamped = new MediaWithdrawal(
                w.mediaId(),
                w.reason(),
                w.expiresAt(),
                Instant.now().toString(),
                w.targeting()
        );
        withdrawnMedia.put(w.mediaId(), stamped);
        return stamped;
    }

    public boolean deleteWithdrawal(String mediaId) {
        return withdrawnMedia.remove(mediaId) != null;
    }

    public List<MediaWithdrawal> listWithdrawals() {
        return sortedById(withdrawnMedia);
    }

    // ---------- App settings ----------

    public AppSetting saveSetting(AppSetting s) {
        AppSetting stamped = new AppSetting(
                s.key(),
                s.value(),
                Instant.now().toString(),
                s.updatedBy(),
                s.targeting()
        );
        settings.put(s.key(), stamped);
        return stamped;
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
        // Preserve active flag if the client omitted it (e.g. a save before
        // the operator has picked this theme as active). Otherwise honour
        // whatever the dashboard sent.
        Boolean active = t.active();
        ThemePayload stamped = new ThemePayload(
                t.id(),
                t.label(),
                t.description(),
                t.colorTokens(),
                active,
                Instant.now().toString(),
                t.updatedBy(),
                t.targeting()
        );
        themes.put(t.id(), stamped);
        return stamped;
    }

    public boolean deleteTheme(String id) {
        boolean removed = themes.remove(id) != null;
        // If we deleted the active theme, fall back to the default so the
        // seatback never sees an empty bundle.
        if (removed && !themes.values().stream().anyMatch(th -> Boolean.TRUE.equals(th.active()))) {
            themes.values().stream().findFirst().ifPresent(th ->
                    themes.put(th.id(), new ThemePayload(
                            th.id(), th.label(), th.description(), th.colorTokens(),
                            Boolean.TRUE, Instant.now().toString(), "system", th.targeting())));
        }
        return removed;
    }

    /**
     * Marks the chosen theme as active and every other theme as inactive.
     * The bundle returned to the seatback lists the active theme last so
     * the seatback's `lastOrNull()` picks it up.
     */
    public Optional<ThemePayload> setThemeActive(String id) {
        ThemePayload chosen = themes.get(id);
        if (chosen == null) return Optional.empty();

        Instant now = Instant.now();
        // Clear active flag on every other theme, set it on the chosen one.
        for (Map.Entry<String, ThemePayload> e : themes.entrySet()) {
            boolean shouldBeActive = e.getKey().equals(id);
            ThemePayload t = e.getValue();
            if (Boolean.TRUE.equals(t.active()) == shouldBeActive) continue;
            themes.put(e.getKey(), new ThemePayload(
                    t.id(), t.label(), t.description(), t.colorTokens(),
                    shouldBeActive, now.toString(), t.updatedBy(), t.targeting()
            ));
        }
        return Optional.of(themes.get(id));
    }

    public Optional<ThemePayload> getTheme(String id) {
        return Optional.ofNullable(themes.get(id));
    }

    public List<ThemePayload> listThemes() {
        // Sort: inactive themes first (insertion order), active theme LAST
        // so the seatback picks the active theme via `lastOrNull()`.
        // We break ties by updatedAt so the most-recently-edited theme wins
        // when multiple happen to be active (defensive).
        return themes.values().stream()
                .sorted((a, b) -> {
                    boolean aActive = Boolean.TRUE.equals(a.active());
                    boolean bActive = Boolean.TRUE.equals(b.active());
                    if (aActive != bActive) return aActive ? 1 : -1;
                    return a.updatedAt().compareTo(b.updatedAt());
                })
                .collect(Collectors.toCollection(ArrayList::new));
    }

    // ---------- Wallpapers ----------

    public Wallpaper saveWallpaper(Wallpaper w) {
        Wallpaper stamped = new Wallpaper(
                w.id(),
                w.label(),
                w.imageUrl(),
                w.active() != null ? w.active() : Boolean.TRUE,
                Instant.now().toString(),
                w.updatedBy(),
                w.targeting()
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
