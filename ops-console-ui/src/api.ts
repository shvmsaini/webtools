/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * REST client for the Operations Console backend.
 *
 * The base URL is read from localStorage so operators can point the
 * UI at any backend (local mock, staging, production) without a
 * rebuild.
 */

import type {
    AppSetting,
    FeatureFlagInput,
    FeatureFlagOverride,
    MediaWithdrawal,
    MenuStateReport,
    NotificationInput,
    NotificationPayload,
    OperationsBundle,
    SearchEvent,
    SearchSubtypeSummary,
    ThemePayload,
    WallpaperPayload,
    WebExperience,
} from './types';

const STORAGE_KEY_API = 'leanback_ops_console_api_url';
const STORAGE_KEY_OPERATOR = 'leanback_ops_console_operator';

export class ApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export const api = {
    baseUrl: localStorage.getItem(STORAGE_KEY_API) || '',
    operator: localStorage.getItem(STORAGE_KEY_OPERATOR) || 'console-operator',

    setBaseUrl(url: string): void {
        this.baseUrl = url.replace(/\/+$/, '');
        localStorage.setItem(STORAGE_KEY_API, this.baseUrl);
    },

    setOperator(name: string): void {
        this.operator = name || 'console-operator';
        localStorage.setItem(STORAGE_KEY_OPERATOR, this.operator);
    },

    async _fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = this.baseUrl + path;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Operator': this.operator,
            ...((options.headers as Record<string, string>) || {}),
        };

        let res: Response;
        try {
            res = await fetch(url, { ...options, headers });
        } catch (e) {
            throw new ApiError(`Network error: ${(e as Error).message}`, 0);
        }

        if (res.status === 204) return null as T;
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new ApiError(`HTTP ${res.status}: ${text || res.statusText}`, res.status);
        }
        return res.json() as Promise<T>;
    },

    /* ---------- Notifications ---------- */

    listNotifications(): Promise<NotificationPayload[]> {
        return this._fetch('/api/v1/notifications');
    },

    createNotification(payload: NotificationInput): Promise<NotificationPayload> {
        return this._fetch('/api/v1/notifications', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    deleteNotification(id: string): Promise<void> {
        return this._fetch(`/api/v1/notifications/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- WebView experiences ---------- */

    listWebviewExperiences(): Promise<WebExperience[]> {
        return this._fetch('/api/v1/webview/experiences');
    },

    saveWebviewExperience(exp: WebExperience): Promise<WebExperience> {
        return this._fetch(`/api/v1/webview/experiences/${encodeURIComponent(exp.id)}`, {
            method: 'PUT',
            body: JSON.stringify(exp),
        });
    },

    deleteWebviewExperience(id: string): Promise<void> {
        return this._fetch(`/api/v1/webview/experiences/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Feature flags ---------- */

    listFeatures(): Promise<FeatureFlagOverride[]> {
        return this._fetch('/api/v1/config/features');
    },

    saveFeature(flag: FeatureFlagInput): Promise<FeatureFlagOverride> {
        return this._fetch('/api/v1/config/features', {
            method: 'POST',
            body: JSON.stringify(flag),
        });
    },

    deleteFeature(name: string): Promise<void> {
        return this._fetch(`/api/v1/config/features/${encodeURIComponent(name)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Media withdrawals ---------- */

    listWithdrawals(): Promise<MediaWithdrawal[]> {
        return this._fetch('/api/v1/config/withdrawals');
    },

    saveWithdrawal(w: MediaWithdrawal): Promise<MediaWithdrawal> {
        return this._fetch('/api/v1/config/withdrawals', {
            method: 'POST',
            body: JSON.stringify(w),
        });
    },

    deleteWithdrawal(mediaId: string): Promise<void> {
        return this._fetch(`/api/v1/config/withdrawals/${encodeURIComponent(mediaId)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Settings ---------- */

    listSettings(): Promise<AppSetting[]> {
        return this._fetch('/api/v1/config/settings');
    },

    saveSetting(s: AppSetting): Promise<AppSetting> {
        return this._fetch('/api/v1/config/settings', {
            method: 'POST',
            body: JSON.stringify(s),
        });
    },

    deleteSetting(key: string): Promise<void> {
        return this._fetch(`/api/v1/config/settings/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Themes ---------- */

    listThemes(): Promise<ThemePayload[]> {
        return this._fetch('/api/v1/config/themes');
    },

    saveTheme(t: ThemePayload): Promise<ThemePayload> {
        return this._fetch('/api/v1/config/themes', {
            method: 'POST',
            body: JSON.stringify(t),
        });
    },

    deleteTheme(id: string): Promise<void> {
        return this._fetch(`/api/v1/config/themes/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Wallpapers ---------- */

    listWallpapers(): Promise<WallpaperPayload[]> {
        return this._fetch('/api/v1/wallpapers');
    },

    saveWallpaper(w: WallpaperPayload): Promise<WallpaperPayload> {
        return this._fetch('/api/v1/wallpapers', {
            method: 'POST',
            body: JSON.stringify(w),
        });
    },

    deleteWallpaper(id: string): Promise<void> {
        return this._fetch(`/api/v1/wallpapers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    /* ---------- Menu state (pushed by the seatback) ---------- */

    listMenuStates(): Promise<MenuStateReport[]> {
        return this._fetch('/api/v1/config/menu-state');
    },

    /* ---------- Bundle (primary endpoint) ---------- */

    getBundle(): Promise<OperationsBundle> {
        return this._fetch('/api/v1/config/bundle');
    },

    /* ---------- Search analytics ---------- */

    getSearchSummary(): Promise<SearchSubtypeSummary[]> {
        return this._fetch('/api/v1/search/events/summary');
    },

    /* ---------- Health ---------- */

    async health(): Promise<boolean> {
        try {
            await this.getBundle();
            return true;
        } catch {
            return false;
        }
    },
};
