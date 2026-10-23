/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Remote Config page — feature flags, media withdrawals, runtime
 * app settings. All fields wired to the wire contract.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { useToast } from '../lib/toast';
import { nowIso } from '../lib/utils';
import type {
    AppSetting,
    FeatureFlagOverride,
    MediaWithdrawal,
    MenuStateReport,
} from '../types';

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
    const [setKey, setSetKey] = useState('');
    const [setValue, setSetValue] = useState('');

    const refreshAll = useCallback(async () => {
        await Promise.all([refreshFlags(), refreshWithdrawals(), refreshSettings(), refreshMenuState()]);
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
            // Non-fatal — just fall back to hardcoded list
            setMenuState([]);
        }
    }

    useEffect(() => {
        void refreshAll();
    }, [refreshAll]);

    /**
     * Build a unified list of feature flags + menu items the seatback
     * reports. Items already exist in the flags table appear as toggles;
     * menu items reported by the seatback that aren't yet in the flags
     * list appear as "needs setup" — operator can still toggle them.
     */
    const knownFlagNames = useMemo(() => {
        const fromFlags = (flags ?? []).map((f) => f.name);
        // Map menu items → flag names via mappedFeatureFlag, fallback to cidType
        const fromMenu = (menuState ?? []).flatMap((r) => r.items).map((item) =>
            item.mappedFeatureFlag || item.cidType?.toUpperCase() || item.title.toUpperCase().replace(/\s+/g, '_')
        );
        // Merge & dedupe
        return Array.from(new Set([...fromFlags, ...fromMenu])).sort();
    }, [flags, menuState]);

    const filteredFlags = useMemo(() => {
        if (!flags) return null;
        const q = filter.trim().toLowerCase();
        if (!q) return flags;
        return flags.filter(f => f.name.toLowerCase().includes(q) || (f.reason || '').toLowerCase().includes(q));
    }, [flags, filter]);

    const filteredWithdrawals = useMemo(() => {
        if (!withdrawals) return null;
        const q = filter.trim().toLowerCase();
        if (!q) return withdrawals;
        return withdrawals.filter(w => w.mediaId.toLowerCase().includes(q) || (w.reason || '').toLowerCase().includes(q));
    }, [withdrawals, filter]);

    async function toggleFlag(name: string) {
        try {
            const cur = (flags ?? []).find((f) => f.name === name);
            if (!cur) return;
            await api.saveFeature({
                ...cur,
                enabled: !cur.enabled,
                updatedAt: nowIso(),
                updatedBy: api.operator,
            });
            toast(`Toggled ${name}.`, 'success');
            await refreshFlags();
        } catch (e) {
            toast(`Toggle failed: ${(e as Error).message}`, 'error');
        }
    }

    /**
     * Toggle a known feature flag on/off directly from the toggle grid.
     * Always flips the enabled state (like toggleFlag does).
     */
    async function toggleKnown(name: string) {
        try {
            const cur = (flags ?? []).find((f) => f.name === name);
            if (!cur) return;
            await api.saveFeature({
                ...cur,
                enabled: !cur.enabled,
                updatedAt: nowIso(),
                updatedBy: api.operator,
            });
            toast(`${name}: ${!cur.enabled ? 'ON' : 'OFF'}.`, 'success');
            await refreshFlags();
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
            });
            toast(`Withdrew ${mediaId}.`, 'success');
            setWdId('');
            setWdReason('');
            setWdExpires('');
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
            });
            toast(`Saved ${key}.`, 'success');
            setSetKey('');
            setSetValue('');
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
                <h2>Remote Configuration</h2>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refreshAll}>Refresh</button>
                </div>
            </div>
            <div className="config-toolbar">
                <input
                    type="search"
                    placeholder="Filter by name / ID…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            <div className="config-grid config-grid--two">
                <div className="config-card">
                    <h3>Feature Flags</h3>
                    <p className="config-help">
                        Toggle seatback features on/off at runtime. Click row to archive.
                    </p>
                    <table className="config-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>State</th>
                                <th>Expires</th>
                                <th>Reason</th>
                                <th>Updated</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {flagsErr ? (
                                <tr>
                                    <td colSpan={6} className="list-empty">Failed to load: {flagsErr}</td>
                                </tr>
                            ) : filteredFlags === null ? (
                                <tr>
                                    <td colSpan={6} className="list-empty">Loading…</td>
                                </tr>
                            ) : filteredFlags.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="list-empty">No feature flags set.</td>
                                </tr>
                            ) : (
                                filteredFlags.map((f) => (
                                    <tr key={f.name}>
                                        <td><code>{f.name}</code></td>
                                        <td className={f.enabled ? 'flag-on' : 'flag-off'}>{
                                            f.enabled ? 'ON' : 'OFF'
                                        }</td>
                                        <td>
                                            {f.expiresAt ? (
                                                <span className="badge badge--warn">
                                                    {new Date(f.expiresAt).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td>{f.reason ?? ''}</td>
                                        <td>{f.updatedAt ? new Date(f.updatedAt).toLocaleString() : ''}</td>
                                        <td>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => void toggleFlag(f.name)}
                                                style={{ fontSize: '11px' }}
                                            >
                                                Toggle
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div className="flag-toggle-grid">
                        {knownFlagNames.length > 0 ? (
                            knownFlagNames.map((name) => {
                                const flag = (flags ?? []).find((f) => f.name === name);
                                const menuItem = (menuState ?? [])
                                    .flatMap((r) => r.items)
                                    .find((item) =>
                                        item.mappedFeatureFlag === name ||
                                        item.cidType?.toUpperCase() === name ||
                                        item.title.toUpperCase().replace(/\s+/g, '_') === name
                                    );
                                const enabled = flag?.enabled ?? true;  // default ON if no flag override
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        className={`flag-toggle ${enabled ? 'flag-toggle--on' : 'flag-toggle--off'} ${!flag ? 'flag-toggle--unset' : ''}`}
                                        onClick={() => void toggleKnown(name)}
                                        title={menuItem ? `Linked to menu item "${menuItem.title}" (cidType=${menuItem.cidType})` : `${enabled ? 'ON' : 'OFF'} — click to ${enabled ? 'disable' : 'enable'}`}
                                    >
                                        <span className="flag-toggle__name">{name}</span>
                                        <span className="flag-toggle__state">
                                            {enabled ? 'ON' : 'OFF'}
                                        </span>
                                        <span className="flag-toggle__source">
                                            {flag
                                                ? (flag.updatedBy === 'system' || !flag.updatedBy ? 'default' : flag.updatedBy)
                                                : (menuItem ? `menu:${menuItem.title}` : 'not in backend')}
                                        </span>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="config-help" style={{ gridColumn: '1 / -1' }}>
                                No flags or menu items yet. Connect a seatback or save one in the table above.
                            </div>
                        )}
                    </div>
                    <div className="config-help" style={{ marginTop: 'var(--sp-2)', gridColumn: '1 / -1' }}>
                        Default flags (from seatback) show "default". Operator-created flags show "console-operator".
                    </div>
                </div>

                <div className="config-card">
                    <h3>Media Withdrawals</h3>
                    <p className="config-help">
                        Hide specific media items from passenger catalog. Click row to restore.
                    </p>
                    <table className="config-table">
                        <thead>
                            <tr>
                                <th>Media ID</th>
                                <th>Expires</th>
                                <th>Reason</th>
                                <th>Withdrawn</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {withdrawalsErr ? (
                                <tr>
                                    <td colSpan={5} className="list-empty">Failed to load: {withdrawalsErr}</td>
                                </tr>
                            ) : filteredWithdrawals === null ? (
                                <tr>
                                    <td colSpan={5} className="list-empty">Loading…</td>
                                </tr>
                            ) : filteredWithdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="list-empty">No withdrawals.</td>
                                </tr>
                            ) : (
                                filteredWithdrawals.map((w) => (
                                    <tr key={w.mediaId}>
                                        <td><code>{w.mediaId}</code></td>
                                        <td>
                                            {w.expiresAt ? (
                                                <span className="badge badge--warn">
                                                    {new Date(w.expiresAt).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td>{w.reason ?? ''}</td>
                                        <td>{w.withdrawnAt ? new Date(w.withdrawnAt).toLocaleString() : ''}</td>
                                        <td>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => void deleteWithdrawal(w.mediaId)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div className="config-add">
                        <input
                            type="text"
                            placeholder="media-id"
                            value={wdId}
                            onChange={(e) => setWdId(e.target.value)}
                        />
                        <input
                            type="datetime-local"
                            placeholder="Expires"
                            value={wdExpires}
                            onChange={(e) => setWdExpires(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Reason"
                            value={wdReason}
                            onChange={(e) => setWdReason(e.target.value)}
                        />
                        <div /> {/* spacer */}
                        <button className="btn btn-primary" onClick={() => void addWithdrawal()}>Add Withdrawal</button>
                    </div>
                </div>

                <div className="config-card">
                    <h3>App Settings</h3>
                    <p className="config-help">
                        Runtime-tunable values. Auto-parsed to string/number/boolean.
                    </p>
                    <table className="config-table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th>Updated</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {settingsErr ? (
                                <tr>
                                    <td colSpan={4} className="list-empty">Failed to load: {settingsErr}</td>
                                </tr>
                            ) : settings === null ? (
                                <tr>
                                    <td colSpan={4} className="list-empty">Loading…</td>
                                </tr>
                            ) : settings.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="list-empty">No settings.</td>
                                </tr>
                            ) : (
                                settings.map((s) => (
                                    <tr key={s.key}>
                                        <td><code>{s.key}</code></td>
                                        <td><code>{JSON.stringify(s.value)}</code></td>
                                        <td>{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}</td>
                                        <td>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => void deleteSetting(s.key)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
                        <button className="btn btn-primary" onClick={() => void addSetting()}>Add / Update</button>
                    </div>
                </div>

                <div className="config-card">
                    <h3>Live Menu State <small style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(reported by seatback)</small></h3>
                    <p className="config-help">
                        Items the seatback actually pushed up. Each row shows the menu item's cidtype / title / service code.
                        Items with <code>mappedFeatureFlag</code> are wired to feature flags above.
                    </p>
                    {!menuState || menuState.length === 0 ? (
                        <div className="list-empty">No menu state pushed yet. Connect a seatback.</div>
                    ) : (
                        <table className="config-table">
                            <thead>
                                <tr>
                                    <th>Device</th>
                                    <th>Reported</th>
                                    <th>Items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {menuState.map((r) => (
                                    <tr key={r.deviceId}>
                                        <td>
                                            <code>{r.deviceId}</code>
                                            {r.airlineCode && <small style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>({r.airlineCode})</small>}
                                        </td>
                                        <td>{r.reportedAt ? new Date(r.reportedAt).toLocaleString() : ''}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {r.items.map((item) => (
                                                    <span
                                                        key={item.id}
                                                        className={`badge ${item.currentlyVisible ? 'badge--ok' : 'badge--off'}`}
                                                        title={`cidType=${item.cidType} • serviceCode=${item.serviceCode} • mappedFlag=${item.mappedFeatureFlag ?? '(none)'}`}
                                                        style={{ cursor: 'help' }}
                                                    >
                                                        {item.title}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </section>
    );
}
