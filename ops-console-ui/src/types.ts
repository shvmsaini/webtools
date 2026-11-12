/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * TypeScript types mirroring the JSON contract the seatback expects.
 */

// ---------- Enums ----------

export type DeliveryChannel = 'POLL' | 'MQTT_PUSH' | 'WEBHOOK';

export type Category =
    | 'OPERATIONAL'
    | 'GATE_CHANGE'
    | 'WEATHER'
    | 'ADVISORY'
    | 'ANNOUNCEMENT'
    | 'PROMOTION'
    | 'CHAIRMAN_MESSAGE';

export type WebExperienceType =
    | 'QUIZ'
    | 'SURVEY'
    | 'GAME'
    | 'CAMPAIGN'
    | 'DESTINATION_INFO'
    | 'PARTNER'
    | 'CUSTOM';

export type DisplayMode = 'MODAL' | 'FULL_SCREEN';

export type Audience = 'ALL' | 'FIRST' | 'BUSINESS' | 'ECONOMY';

// ---------- Shared sub-records ----------

export interface Targeting {
    audience: Audience;
    languages: string[];
    seatNumbers: string[];
    minAppVersion: string | null;
}

export interface Schedule {
    start: string | null;
    end: string | null;
}

export interface Display {
    mode: DisplayMode;
    showHeader: boolean;
    showCloseButton: boolean;
    width: string;
    height: string;
}

// ---------- Top-level resources ----------

export interface NotificationPayload {
    id: string;
    title: string;
    body?: string;
    iconUrl?: string | null;
    ctaUrl?: string | null;
    autoOpen: boolean;
    mandatory: boolean;
    channel: DeliveryChannel;
    targeting: Targeting;
    expiresAt?: string | null;
    createdAt: string;
    createdBy?: string;
    category: Category;
}

export interface WebExperience {
    id: string;
    title: string;
    type: WebExperienceType;
    url: string;
    iconUrl?: string | null;
    active: boolean;
    autoOpen?: boolean;
    schedule?: Schedule | null;
    targeting: Targeting;
    display: Display;
    metadata: Record<string, string>;
    pinnedToFooter?: boolean | null;
    footerPosition?: number | null;
}

export interface FeatureFlagOverride {
    name: string;
    enabled: boolean;
    expiresAt?: string | null;
    reason?: string | null;
    updatedAt: string;
    updatedBy?: string | null;
    /**
     * When null/omitted, this flag applies to every seat (broadcast).
     * When set, only seats matching the targeting filter see the override;
     * other seats fall back to the previous (default) value. Operators can
     * push a per-seat override on top of a fleet broadcast without
     * rebuilding the bundle.
     */
    targeting?: Targeting | null;
}

export interface MediaWithdrawal {
    mediaId: string;
    reason?: string | null;
    expiresAt?: string | null;
    withdrawnAt: string;
    /**
     * Per-seat override. Null/missing = broadcast withdrawal applied to
     * every seat. Set = the withdrawal only hides the media item on seats
     * matching the filter; other seats continue to show it.
     */
    targeting?: Targeting | null;
}

export interface AppSetting {
    key: string;
    value: string | number | boolean;
    updatedAt: string;
    updatedBy?: string | null;
    /**
     * Per-seat override. Null/missing = broadcast to every seat. Set = the
     * setting only updates the matching seats; other seats keep the
     * previous value.
     */
    targeting?: Targeting | null;
}

export interface OperationsBundle {
    version: string;
    fetchedAt: string;
    featureFlags: FeatureFlagOverride[];
    withdrawnMedia: MediaWithdrawal[];
    settings: AppSetting[];
    webviewExperiences: WebExperience[];
    notifications: NotificationPayload[];
    themes: ThemePayload[];
    wallpapers: WallpaperPayload[];
    apkUpdates: ApkUpdate[];
}

/**
 * An APK pushed to seats for remote installation. Hash, size and download
 * URL are set by the server when a file is uploaded; the operator edits the
 * remaining fields only.
 */
export interface ApkUpdate {
    id: string;
    packageName: string;
    versionName?: string | null;
    downloadUrl?: string | null;
    sha256?: string | null;
    signerFingerprint?: string | null;
    minAppVersion?: string | null;
    requireReboot: boolean;
    active: boolean;
    sizeBytes?: number | null;
    fileName?: string | null;
    createdAt: string;
    updatedBy?: string | null;
    targeting?: Targeting | null;
}

export interface ApkUpdateStatus {
    updateId: string;
    deviceId?: string | null;
    packageName?: string | null;
    status: string;
    errorMessage?: string | null;
    errorCode?: string | null;
    reportedAt?: number | null;
    durationMs?: number | null;
}

export interface ThemePayload {
    id: string;
    label: string;
    description?: string | null;
    colorTokens: Record<string, string>;
    /**
     * When true, this is the theme the seatback applies. The dashboard
     * ensures exactly one theme has active=true at a time. Older payloads
     * without this field are treated as inactive.
     */
    active?: boolean | null;
    updatedAt: string;
    updatedBy?: string;
    /**
     * When null/omitted, this theme is broadcast to every seat (the
     * normal fleet-wide rollout). When set, only seats matching the
     * targeting filter consider this theme; other seats fall back to
     * whatever they had applied previously.
     */
    targeting?: Targeting | null;
}

export interface WallpaperPayload {
    id: string;
    label: string;
    imageUrl: string;
    active: boolean;
    updatedAt: string;
    updatedBy?: string;
    /**
     * When null/omitted, the wallpaper is broadcast to every seat. When
     * set, only seats matching the targeting filter render it; other seats
     * see the broadcast wallpaper instead (or the bundled default if no
     * broadcast wallpaper exists).
     */
    targeting?: Targeting | null;
}

// ---------- Request payloads ----------

export type NotificationInput = Omit<NotificationPayload, 'createdAt' | 'autoOpen'> & {
    createdAt?: string;
    autoOpen?: boolean;
};

export type FeatureFlagInput = Omit<FeatureFlagOverride, 'updatedAt'> & {
    updatedAt?: string;
};

// ---------- Search analytics ----------

export interface SearchEvent {
    subtype: string;
    query: string;
    resultCount: number;
    occurredAt: string;
    /**
     * Seat number this search originated from (e.g. "12A"). Null if
     * the seatback didn't know its seat at the moment the event was
     * posted (early-boot window before LruConfig loads).
     */
    seatNumber?: string | null;
    /** UI language on the seatback at the time of search. */
    language?: string | null;
    /** Cabin class (FIRST/BUSINESS/ECONOMY). Null if the seatback doesn't track it. */
    audience?: string | null;
    /** Stable seatback identifier so the dashboard can group events before the seat number loads. */
    deviceId?: string | null;
}

export interface SearchSubtypeSummary {
    subtype: string;
    queries: number;
    zeroResults: number;
    totalResults: number;
    recent: SearchEvent[];
}

// ---------- Menu state (pushed by the seatback) ----------

export interface MenuStateItem {
    id: string;
    cidType: string;
    title: string;
    serviceCode: string;
    currentlyVisible: boolean;
    featureFlagControlled: boolean;
    mappedFeatureFlag?: string | null;
    orderIndex?: number | null;
}

export interface MenuStateReport {
    deviceId: string;
    airlineCode?: string | null;
    appVersion?: string | null;
    reportedAt: number;
    items: MenuStateItem[];
}
