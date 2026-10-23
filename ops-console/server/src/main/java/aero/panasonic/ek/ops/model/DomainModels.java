package aero.panasonic.ek.ops.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

/**
 * Domain models for the Operations Console mock backend.
 *
 * These are Java {@code records} so they serialize naturally to/from
 * JSON without extra annotations. Field names match {@code schema.json}
 * in the parent directory — that's the source of truth for the wire
 * contract shared with the admin panel and the Android IFE app.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class DomainModels {

    private DomainModels() {}

    /** Delivery channel for a notification. */
    public enum DeliveryChannel {
        POLL, MQTT_PUSH, WEBHOOK
    }

    /** Notification category — drives icon + colour in the intrusive overlay. */
    public enum Category {
        OPERATIONAL, GATE_CHANGE, WEATHER, ADVISORY, ANNOUNCEMENT, PROMOTION, CHAIRMAN_MESSAGE
    }

    public enum WebExperienceType {
        QUIZ, SURVEY, GAME, CAMPAIGN, DESTINATION_INFO, PARTNER, CUSTOM
    }

    public enum DisplayMode {
        MODAL, FULL_SCREEN
    }

    /** Targeting constraints — all optional; missing = no constraint. */
    public record Targeting(
            String audience,
            List<String> languages,
            List<String> seatNumbers,
            String minAppVersion
    ) {}

    /** Schedule window for a WebView experience. */
    public record Schedule(String start, String end) {}

    /** Display config for a WebView experience. */
    public record Display(
            DisplayMode mode,
            Boolean showHeader,
            Boolean showCloseButton,
            String width,
            String height
    ) {}

    /**
     * A push notification destined for one or more seats.
     */
    public record NotificationPayload(
            @NotBlank String id,
            @NotBlank String title,
            String body,
            String iconUrl,
            String ctaUrl,
            Boolean autoOpen,
            Boolean mandatory,
            @NotNull DeliveryChannel channel,
            Targeting targeting,
            String expiresAt,
            @NotNull String createdAt,
            String createdBy,
            Category category
    ) {}

    /**
     * A WebView dynamic experience (rendered inside the IFE app).
     */
    public record WebExperience(
            @NotBlank String id,
            @NotBlank String title,
            WebExperienceType type,
            @NotBlank String url,
            String iconUrl,
            Boolean active,
            Boolean autoOpen,
            Schedule schedule,
            Targeting targeting,
            Display display,
            Map<String, String> metadata,
            Boolean pinnedToFooter,
            @Min(1) Integer footerPosition
    ) {}

    /**
     * Toggle an Interactive feature (e.g. GAMES, MAPS) on or off at runtime.
     */
    public record FeatureFlagOverride(
            @NotBlank String name,
            @NotNull Boolean enabled,
            String expiresAt,
            String reason,
            @NotNull String updatedAt,
            String updatedBy
    ) {}

    /** Withdraw a single media item from the catalogue. */
    public record MediaWithdrawal(
            @NotBlank String mediaId,
            String reason,
            String expiresAt,
            @NotNull String withdrawnAt
    ) {}

    public record AppSetting(
            @NotBlank String key,
            @NotNull Object value,
            @NotNull String updatedAt,
            String updatedBy
    ) {}

    public record ThemePayload(
            @NotBlank String id,
            @NotBlank String label,
            String description,
            @NotNull Map<String, String> colorTokens,
            @NotNull String updatedAt,
            String updatedBy
    ) {}

    /**
     * Operator-uploaded wallpaper shown on the seatback's welcome /
     * language-selection screens.
     *
     * `imageUrl` is served by the Ops Console backend
     * (e.g. `/api/v1/wallpapers/{id}/image`).
     */
    public record Wallpaper(
            @NotBlank String id,
            @NotBlank String label,
            @NotBlank String imageUrl,
            @NotNull Boolean active,
            @NotNull String updatedAt,
            String updatedBy
    ) {}

    public record OperationsBundle(
            String version,
            String fetchedAt,
            List<FeatureFlagOverride> featureFlags,
            List<MediaWithdrawal> withdrawnMedia,
            List<AppSetting> settings,
            List<WebExperience> webviewExperiences,
            List<NotificationPayload> notifications,
            List<ThemePayload> themes,
            List<Wallpaper> wallpapers
    ) {}

    /**
     * Report of active menu items currently visible on the seatback sidebar.
     * The seatback pushes this up so the operator dashboard can show which
     * features are actually installed and offering an entry point. The
     * dashboard uses this to filter / contextualize feature flags.
     */
    public record MenuStateReport(
            String deviceId,
            String airlineCode,
            String appVersion,
            long reportedAt,
            List<MenuStateItem> items
    ) {}

    public record MenuStateItem(
            String id,
            String cidType,
            String title,
            String serviceCode,
            boolean currentlyVisible,
            boolean featureFlagControlled,
            String mappedFeatureFlag,
            Integer orderIndex
    ) {}
}
