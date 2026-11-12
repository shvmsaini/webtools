/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Remote Config page — simplified feature flags only.
 * Shows toggles for both feature flags and menu items reported by the
 * seatback. No tables, no separate "live menu state" section.
 * Toggle any item off and it's removed from the seatback's sidebar +
 * content area.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { TargetingSection } from '../components/TargetingSection';
import { useToast } from '../lib/toast';
import { emptyTargeting, nowIso } from '../lib/utils';
import type {
    AppSetting,
    FeatureFlagOverride,
    MediaWithdrawal,
    MenuStateItem,
    MenuStateReport,
    Targeting,
} from '../types';

interface ToggleRow {
    name: string;
    title: string;
    cidType: string;
    enabled: boolean;
    source: 'flag' | 'menu';
    flag?: FeatureFlagOverride;
    menuItem?: MenuStateItem;
}

/**
 * True if [t] actually narrows the audience — i.e. has a non-default
 * audience, languages, or seat numbers. Used by add-form save paths to
 * decide whether to send the targeting block with the payload (null when
 * "broadcast to everyone" is the intent).
 */
function isTargetingMeaningful(t: Targeting | null | undefined): boolean {
    if (!t) return false;
    if (t.audience && t.audience !== 'ALL') return true;
    if (t.languages && t.languages.length > 0) return true;
    if (t.seatNumbers && t.seatNumbers.length > 0) return true;
    return false;
}

/**
 * Short human-readable description of a targeting block. Used as a
 * tooltip on the "🎯 Targeted" badge so operators can see at a glance
 * which seats are in scope without clicking into the editor.
 */
function describeTargeting(t: Targeting | null | undefined): string {
    if (!t || !isTargetingMeaningful(t)) return 'Broadcast — every seat';
    const parts: string[] = [];
    if (t.audience && t.audience !== 'ALL') parts.push(`audience=${t.audience}`);
    if (t.languages?.length) parts.push(`languages=${t.languages.join(',')}`);
    if (t.seatNumbers?.length) parts.push(`seats=${t.seatNumbers.join(',')}`);
    return parts.join(' · ');
}

export function Config() {
    const toast = useToast();
    const [flags, setFlags] = useState<FeatureFlagOverride[] | null>(null);
    const [flagsErr, setFlagsErr] = useState<string | null>(null);
    const [withdrawals, setWithdrawals] = useState<MediaWithdrawal[] | null>(null);
    const [withdrawalsErr, setWithdrawalsErr] = useState<string | null>(null);
    const [settings, setSettings] = useState<AppSetting[] | null>(null);
    const [settingsErr, setSettingsErr] = useState<string | null>(null);
    const [menuState, setMenuState] = useState<MenuStateReport[] | null>(null);
    const [filter, setFilter] = useState('');

    const [wdId, setWdId] = useState('');
    const [wdReason, setWdReason] = useState('');
    const [wdExpires, setWdExpires] = useState<string>('');
    const [wdTargeting, setWdTargeting] = useState<Targeting>(emptyTargeting());
    const [setKey, setSetKey] = useState('');
    const [setValue, setSetValue] = useState('');
    const [setTargeting, setSetTargeting] = useState<Targeting>(emptyTargeting());

    const refreshAll = useCallback(async () => {
        await Promise.all([
            refreshFlags(),
            refreshWithdrawals(),
            refreshSettings(),
            refreshMenuState(),
        ]);
    }, []);

    async function refreshFlags() {
        setFlagsErr(null);
        try {
            setFlags(await api.listFeatures());
        } catch (e) {
            setFlagsErr((e as ApiError).message);
            setFlags([]);
        }
    }

    async function refreshWithdrawals() {
        setWithdrawalsErr(null);
        try {
            setWithdrawals(await api.listWithdrawals());
        } catch (e) {
            setWithdrawalsErr((e as ApiError).message);
            setWithdrawals([]);
        }
    }

    async function refreshSettings() {
        setSettingsErr(null);
        try {
            setSettings(await api.listSettings());
        } catch (e) {
            setSettingsErr((e as ApiError).message);
            setSettings([]);
        }
    }

    async function refreshMenuState() {
        try {
            setMenuState(await api.listMenuStates());
        } catch (e) {
            setMenuState([]);
        }
    }

    useEffect(() => {
        void refreshAll();
    }, [refreshAll]);

    /**
     * Build a unified list of toggles: feature flags + menu items reported
     * by the seatback. Each toggle shows the state in the UI and toggles
     * either an existing flag or creates one bound to the menu item.
     */
    const toggleRows: ToggleRow[] = useMemo(() => {
        const rows: ToggleRow[] = [];
        const seen = new Set<string>();

        // First: feature flags from backend
        for (const flag of flags ?? []) {
            rows.push({
                name: flag.name,
                title: flag.name,
                cidType: '',
                enabled: flag.enabled,
                source: 'flag',
                flag,
            });
            seen.add(flag.name);
        }

        // Second: menu items reported by seatback that aren't in flags yet
        for (const report of menuState ?? []) {
            for (const item of report.items) {
                // Map menu item to a flag name
                const flagName =
                    item.mappedFeatureFlag ||
                    item.cidType?.toUpperCase() ||
                    item.title.toUpperCase().replace(/\s+/g, '_');
                if (seen.has(flagName)) continue;
                seen.add(flagName);

                rows.push({
                    name: flagName,
                    title: item.title || flagName,
                    cidType: item.cidType || '',
                    enabled: item.currentlyVisible,
                    source: 'menu',
                    menuItem: item,
                });
            }
        }

        return rows;
    }, [flags, menuState]);

    const filteredRows = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return toggleRows;
        return toggleRows.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.title.toLowerCase().includes(q) ||
                r.cidType.toLowerCase().includes(q),
        );
    }, [toggleRows, filter]);

    /**
     * Toggle a row. If it's a known flag, just flip the flag. If it's a
     * menu item not yet in flags, create a new flag (defaulting to the
     * current visible state) and immediately toggle.
     */
    async function toggleRow(row: ToggleRow) {
        try {
            if (row.flag) {
                await api.saveFeature({
                    ...row.flag,
                    enabled: !row.flag.enabled,
                    updatedAt: nowIso(),
                    updatedBy: api.operator,
                });
                toast(
                    `${row.flag.name}: ${!row.flag.enabled ? 'ON' : 'OFF'}`,
                    'success',
                );
            } else if (row.menuItem) {
                // Create a new feature flag for this menu item
                const newFlag: FeatureFlagOverride = {
                    name: row.name,
                    enabled: !row.menuItem.currentlyVisible,
                    reason: null,
                    expiresAt: null,
                    updatedAt: nowIso(),
                    updatedBy: api.operator,
                };
                await api.saveFeature(newFlag);
                toast(
                    `${row.name}: ${newFlag.enabled ? 'ON' : 'OFF'} (new flag)`,
                    'success',
                );
            }
            await refreshAll();
        } catch (e) {
            toast(`Toggle failed: ${(e as Error).message}`, 'error');
        }
    }

    async function addWithdrawal() {
        const mediaId = wdId.trim();
        if (!mediaId) {
            toast('Media ID is required.', 'error');
            return;
        }
        try {
            await api.saveWithdrawal({
                mediaId,
                reason: wdReason.trim() || null,
                expiresAt: wdExpires.trim() ? new Date(wdExpires).toISOString() : null,
                withdrawnAt: nowIso(),
                targeting: isTargetingMeaningful(wdTargeting) ? wdTargeting : null,
            });
            toast(`Withdrew ${mediaId}.`, 'success');
            setWdId('');
            setWdReason('');
            setWdExpires('');
            setWdTargeting(emptyTargeting());
            await refreshWithdrawals();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    }

    async function deleteWithdrawal(mediaId: string) {
        try {
            await api.deleteWithdrawal(mediaId);
            toast('Withdrawal deleted.', 'success');
            await refreshWithdrawals();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    }

    async function addSetting() {
        const key = setKey.trim();
        const raw = setValue.trim();
        if (!key || !raw) {
            toast('Key and value are required.', 'error');
            return;
        }
        let value: string | number | boolean;
        try {
            value = JSON.parse(raw);
        } catch {
            value = raw;
        }
        try {
            await api.saveSetting({
                key,
                value,
                updatedAt: nowIso(),
                updatedBy: api.operator,
                targeting: isTargetingMeaningful(setTargeting) ? setTargeting : null,
            });
            toast(`Saved ${key}.`, 'success');
            setSetKey('');
            setSetValue('');
            setSetTargeting(emptyTargeting());
            await refreshSettings();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    }

    async function deleteSetting(key: string) {
        try {
            await api.deleteSetting(key);
            toast('Setting deleted.', 'success');
            await refreshSettings();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    }

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>Remote Configuration</h2>
                    <div className="panel-header__sub">
                        Toggle menu items and features on/off at runtime.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refreshAll}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="config-toolbar">
                <input
                    type="search"
                    placeholder="Filter by name…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>

            {/* ===== Feature Flags + Menu Items (combined toggles) ===== */}
            <div className="config-card">
                <h3>Feature Flags & Menu Items</h3>
                <p className="config-help">
                    Toggle any item off and it disappears from the seatback's
                    sidebar and content area. Items reported by the seatback
                    but not yet in the flag store are shown as "menu".
                </p>
                {flagsErr && (
                    <div className="list-empty list-empty--error">
                        Failed to load flags: {flagsErr}
                    </div>
                )}
                {flags === null ? (
                    <div className="list-empty">Loading…</div>
                ) : filteredRows.length === 0 ? (
                    <div className="list-empty">
                        No flags or menu items yet. Connect a seatback or save
                        one below.
                    </div>
                ) : (
                    <div className="flag-toggle-grid">
                        {filteredRows.map((row) => (
                            <button
                                key={row.name}
                                type="button"
                                className={`flag-toggle ${row.enabled ? 'flag-toggle--on' : 'flag-toggle--off'} ${
                                    !row.flag ? 'flag-toggle--unset' : ''
                                }`}
                                onClick={() => void toggleRow(row)}
                                title={
                                    isTargetingMeaningful(row.flag?.targeting)
                                        ? `${row.enabled ? 'ON' : 'OFF'} — ${describeTargeting(row.flag?.targeting)} — click to ${row.enabled ? 'disable' : 'enable'}`
                                        : row.cidType
                                        ? `cidType=${row.cidType}`
                                        : `${row.enabled ? 'ON' : 'OFF'} — click to ${
                                              row.enabled ? 'disable' : 'enable'
                                          }`
                                }
                            >
                                <span className="flag-toggle__name">
                                    {row.title}
                                </span>
                                <span className="flag-toggle__state">
                                    {row.enabled ? 'ON' : 'OFF'}
                                </span>
                                <span className="flag-toggle__source">
                                    {row.source === 'flag'
                                        ? row.flag?.updatedBy || 'flag'
                                        : 'menu'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ===== Media Withdrawals ===== */}
            <div className="config-grid config-grid--two">
                <div className="config-card">
                    <h3>Media Withdrawals</h3>
                    <p className="config-help">
                        Hide specific media items from passenger catalog.
                        Watch seatback logs for "OPS_MediaWithdrawal: Media ID"
                        to find IDs.
                    </p>
                    {withdrawalsErr && (
                        <div className="list-empty list-empty--error">
                            Failed to load: {withdrawalsErr}
                        </div>
                    )}
                    {withdrawals === null ? (
                        <div className="list-empty">Loading…</div>
                    ) : withdrawals.length === 0 ? (
                        <div className="list-empty">No withdrawals.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {withdrawals.map((w) => (
                                <div
                                    key={w.mediaId}
                                    className="list-item"
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <div>
                                        <code>{w.mediaId}</code>
                                        {isTargetingMeaningful(w.targeting) && (
                                            <span
                                                className="list-item__badge"
                                                style={{
                                                    marginLeft: '8px',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'var(--color-warning-bg, #fef3c7)',
                                                    color: 'var(--color-warning-text, #92400e)',
                                                    fontSize: '11px',
                                                }}
                                                title={describeTargeting(w.targeting)}
                                            >
                                                🎯 Targeted
                                            </span>
                                        )}
                                        {w.reason && (
                                            <div
                                                style={{
                                                    fontSize: '11px',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {w.reason}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => void deleteWithdrawal(w.mediaId)}
                                    >
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="config-add">
                        <input
                            type="text"
                            placeholder="media-id"
                            value={wdId}
                            onChange={(e) => setWdId(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={wdReason}
                            onChange={(e) => setWdReason(e.target.value)}
                        />
                        <div />
                        <button className="btn btn-primary" onClick={() => void addWithdrawal()}>
                            Withdraw
                        </button>
                    </div>
                    <details style={{ marginTop: '8px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Targeting (optional — leave collapsed to broadcast)
                        </summary>
                        <div style={{ marginTop: '8px' }}>
                            <TargetingSection
                                value={wdTargeting}
                                onChange={setWdTargeting}
                                heading=""
                                helpText="Scope this withdrawal to specific seats / languages / cabin. Leave blank to broadcast to the whole fleet."
                            />
                        </div>
                    </details>
                </div>

                {/* ===== App Settings ===== */}
                <div className="config-card">
                    <h3>App Settings</h3>
                    <p className="config-help">
                        Runtime-tunable values. Auto-parsed to string/number/boolean.
                    </p>
                    {settingsErr && (
                        <div className="list-empty list-empty--error">
                            Failed to load: {settingsErr}
                        </div>
                    )}
                    {settings === null ? (
                        <div className="list-empty">Loading…</div>
                    ) : settings.length === 0 ? (
                        <div className="list-empty">No settings.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {settings.map((s) => (
                                <div
                                    key={s.key}
                                    className="list-item"
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <div>
                                        <code>{s.key}</code>
                                        <span style={{ marginLeft: '8px', color: 'var(--color-text-muted)' }}>
                                            {JSON.stringify(s.value)}
                                        </span>
                                        {isTargetingMeaningful(s.targeting) && (
                                            <span
                                                className="list-item__badge"
                                                style={{
                                                    marginLeft: '8px',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'var(--color-warning-bg, #fef3c7)',
                                                    color: 'var(--color-warning-text, #92400e)',
                                                    fontSize: '11px',
                                                }}
                                                title={describeTargeting(s.targeting)}
                                            >
                                                🎯 Targeted
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => void deleteSetting(s.key)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="config-add">
                        <input
                            type="text"
                            placeholder="setting_key"
                            value={setKey}
                            onChange={(e) => setSetKey(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder='value (60, "hi", true)'
                            value={setValue}
                            onChange={(e) => setSetValue(e.target.value)}
                        />
                        <div />
                        <button className="btn btn-primary" onClick={() => void addSetting()}>
                            Save
                        </button>
                    </div>
                    <details style={{ marginTop: '8px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Targeting (optional — leave collapsed to broadcast)
                        </summary>
                        <div style={{ marginTop: '8px' }}>
                            <TargetingSection
                                value={setTargeting}
                                onChange={setSetTargeting}
                                heading=""
                                helpText="Scope this setting to specific seats / languages / cabin. Leave blank to broadcast to the whole fleet."
                            />
                        </div>
                    </details>
                </div>
            </div>
        </section>
    );
}
