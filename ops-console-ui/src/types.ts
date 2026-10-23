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
    updatedBy?: string;
}

export interface MediaWithdrawal {
    mediaId: string;
    reason?: string | null;
    expiresAt?: string | null;
    withdrawnAt: string;
}

export interface AppSetting {
    key: string;
    value: string | number | boolean;
    updatedAt: string;
    updatedBy?: string;
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
}

export interface ThemePayload {
    id: string;
    label: string;
    description?: string | null;
    colorTokens: Record<string, string>;
    updatedAt: string;
    updatedBy?: string;
}

export interface WallpaperPayload {
    id: string;
    label: string;
    imageUrl: string;
    active: boolean;
    updatedAt: string;
    updatedBy?: string;
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
