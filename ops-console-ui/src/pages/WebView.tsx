/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * WebView Content page — list + editor for WebView experiences.
 *
 * Covers every field of the wire contract:
 *   - id, title, type, url, iconUrl
 *   - active, autoOpen, schedule (start/end)
 *   - targeting: audience, languages, seatNumbers, minAppVersion
 *   - display: mode, showHeader, showCloseButton, width, height
 *   - metadata: arbitrary key/value pairs
 *   - pinnedToFooter, footerPosition
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import {
    CheckboxField,
    SelectField,
    TextField,
} from '../components/EditorField';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { useToast } from '../lib/toast';
import { defaultDisplay, emptyTargeting, nowIso } from '../lib/utils';
import type {
    Audience,
    DisplayMode,
    WebExperience,
    WebExperienceType,
} from '../types';

const TYPES: ReadonlyArray<{ value: WebExperienceType; label: string }> = [
    { value: 'QUIZ', label: 'Quiz' },
    { value: 'SURVEY', label: 'Survey' },
    { value: 'GAME', label: 'Game' },
    { value: 'CAMPAIGN', label: 'Campaign' },
    { value: 'DESTINATION_INFO', label: 'Destination Info' },
    { value: 'PARTNER', label: 'Partner' },
    { value: 'CUSTOM', label: 'Custom' },
];

const DISPLAY_MODES: ReadonlyArray<{ value: DisplayMode; label: string }> = [
    { value: 'MODAL', label: 'Modal' },
    { value: 'FULL_SCREEN', label: 'Full Screen' },
];

const AUDIENCES: ReadonlyArray<{ value: Audience; label: string }> = [
    { value: 'ALL', label: 'All Seats' },
    { value: 'FIRST', label: 'First Class' },
    { value: 'BUSINESS', label: 'Business' },
    { value: 'ECONOMY', label: 'Economy' },
];

function blankExperience(): WebExperience {
    return {
        id: `exp-${Date.now()}`,
        title: '',
        type: 'QUIZ',
        url: '',
        iconUrl: null,
        active: true,
        autoOpen: true,
        schedule: { start: null, end: null },
        targeting: emptyTargeting(),
        display: defaultDisplay(),
        metadata: {},
        pinnedToFooter: false,
        footerPosition: null,
    };
}

function isoToLocalInput(iso: string | null): string {
    if (!iso) return '';
    return iso.substring(0, 16);
}

function localInputToIso(local: string): string | null {
    if (!local) return null;
    return new Date(local).toISOString();
}

export function WebView() {
    const toast = useToast();
    const [items, setItems] = useState<WebExperience[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<WebExperience | null>(null);
    const [filter, setFilter] = useState('');
    const [metaKey, setMetaKey] = useState('');
    const [metaValue, setMetaValue] = useState('');

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const list = await api.listWebviewExperiences();
            setItems(list);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : String(e);
            setError(msg);
            setItems([]);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = useMemo(() => {
        if (!items) return null;
        const q = filter.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (e) =>
                e.title.toLowerCase().includes(q) ||
                e.id.toLowerCase().includes(q) ||
                e.url.toLowerCase().includes(q)
        );
    }, [items, filter]);

    const select = (id: string) => {
        const found = items?.find((e) => e.id === id);
        if (!found) return;
        setSelectedId(id);
        // Ensure all optional fields have sane defaults so the form is fully populated
        // even for records authored before these fields existed on the wire.
        setDraft({
            ...found,
            type: found.type ?? 'CUSTOM',
            schedule: found.schedule ?? { start: null, end: null },
            targeting: found.targeting ?? emptyTargeting(),
            display: {
                mode: found.display?.mode ?? 'MODAL',
                showHeader: found.display?.showHeader ?? true,
                showCloseButton: found.display?.showCloseButton ?? true,
                width: found.display?.width ?? '80%',
                height: found.display?.height ?? '80%',
            },
            metadata: found.metadata ?? {},
            pinnedToFooter: found.pinnedToFooter ?? false,
            footerPosition: found.footerPosition ?? null,
        });
    };

    const newExperience = () => {
        setSelectedId(null);
        setDraft(blankExperience());
    };

    const save = async () => {
        if (!draft) return;
        const id = draft.id.trim();
        const title = draft.title.trim();
        const url = draft.url.trim();
        if (!id || !title || !url) {
            toast('ID, Title, and URL are required.', 'error');
            return;
        }
        try {
            await api.saveWebviewExperience({ ...draft, id, title, url });
            setSelectedId(id);
            toast('Experience saved.', 'success');
            await refresh();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    };

    const remove = async () => {
        if (!selectedId) return;
        if (!confirm(`Delete experience "${selectedId}"?`)) return;
        try {
            await api.deleteWebviewExperience(selectedId);
            setSelectedId(null);
            setDraft(null);
            toast('Experience deleted.', 'success');
            await refresh();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    };

    const send = async () => {
        if (!draft) {
            toast('Select or create an experience first.', 'error');
            return;
        }
        if (!draft.id.trim() || !draft.title.trim() || !draft.url.trim()) {
            toast('ID, Title, and URL are required before sending.', 'error');
            return;
        }
        if (!draft.active) {
            toast('Experience is INACTIVE — set Active=true before sending.', 'error');
            return;
        }
        try {
            const id = draft.id.trim();
            await api.saveWebviewExperience({
                ...draft,
                id,
                title: draft.title.trim(),
                url: draft.url.trim(),
            });
            await api.createNotification({
                id: `${id}-${Date.now()}`,
                title: draft.title || id,
                body: 'Tap to open the experience.',
                iconUrl: draft.iconUrl || null,
                ctaUrl: `webview:${id}`,
                autoOpen: draft.autoOpen ?? true,
                mandatory: false,
                channel: 'POLL',
                targeting: emptyTargeting(),
                expiresAt: null,
                createdAt: nowIso(),
                createdBy: api.operator,
                category: 'OPERATIONAL',
            });
            setSelectedId(id);
            toast(`Sent "${draft.title}" to fleet — notification posted.`, 'success');
            await refresh();
        } catch (e) {
            toast(`Send failed: ${(e as Error).message}`, 'error');
        }
    };

    const addMetadata = () => {
        if (!draft) return;
        const k = metaKey.trim();
        if (!k) {
            toast('Metadata key is required.', 'error');
            return;
        }
        setDraft({
            ...draft,
            metadata: { ...draft.metadata, [k]: metaValue.trim() },
        });
        setMetaKey('');
        setMetaValue('');
    };

    const removeMetadata = (key: string) => {
        if (!draft) return;
        const { [key]: _, ...rest } = draft.metadata;
        void _;
        setDraft({ ...draft, metadata: rest });
    };

    const langs = draft ? draft.targeting.languages.join(', ') : '';
    const seats = draft ? draft.targeting.seatNumbers.join(', ') : '';

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>WebView Content</h2>
                    <div className="panel-header__sub">
                        Publish in-seat experiences — modal popups, full-screen
                        pages, or pinned footer shortcuts.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <button className="btn btn-primary" onClick={newExperience}>
                        + New Experience
                    </button>
                </div>
            </div>
            <div className="two-col">
                <div className="col-list">
                    <div className="config-toolbar">
                        <input
                            type="search"
                            placeholder="Filter by title / id / url…"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <div className="list-items">
                        {error ? (
                            <ErrorState message={error} />
                        ) : filtered === null ? (
                            <LoadingState />
                        ) : filtered.length === 0 ? (
                            <EmptyState text={filter ? 'No matches.' : 'No experiences yet. Click + New Experience.'} />
                        ) : (
                            filtered.map((e) => (
                                <div
                                    key={e.id}
                                    className={`list-item ${e.id === selectedId ? 'selected' : ''}`}
                                    onClick={() => select(e.id)}
                                >
                                    <div className="list-item-title">
                                        <span className="list-item-title-text">{e.title || <em style={{ color: 'var(--color-text-faint)' }}>(no title)</em>}</span>
                                        <span className={`type-pill ${e.type || 'CUSTOM'}`}>
                                            {(e.type || 'CUSTOM').replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="list-item-meta">
                                        <code>{e.id}</code>
                                        {' · '}
                                        <span className={`badge ${e.active ? 'badge--ok' : 'badge--off'}`}>
                                            {e.active ? 'active' : 'inactive'}
                                        </span>
                                        {e.pinnedToFooter ? (
                                            <>
                                                {' · '}
                                                <span className="badge badge--warn">pinned @ {e.footerPosition ?? '?'}</span>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="col-editor">
                    {!draft ? (
                        <div className="editor-empty">
                            Select an experience to edit, or click{' '}
                            <strong>+ New Experience</strong>.
                        </div>
                    ) : (
                        <form
                            className="editor-form"
                            onSubmit={(ev) => {
                                ev.preventDefault();
                                void save();
                            }}
                        >
                            <div className="form-section">
                                <h3>Basics</h3>
                                <div className="form-grid">
                                    <TextField
                                        label="ID"
                                        hint="required"
                                        value={draft.id}
                                        onChange={(v) => setDraft({ ...draft, id: v })}
                                        required
                                    />
                                    <TextField
                                        label="Title"
                                        hint="required"
                                        value={draft.title}
                                        onChange={(v) => setDraft({ ...draft, title: v })}
                                        required
                                    />
                                    <SelectField
                                        label="Type"
                                        value={draft.type ?? 'CUSTOM'}
                                        onChange={(v) => setDraft({ ...draft, type: v })}
                                        options={TYPES}
                                    />
                                    <SelectField
                                        label="Display mode"
                                        value={draft.display.mode ?? 'MODAL'}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                display: { ...draft.display, mode: v },
                                            })
                                        }
                                        options={DISPLAY_MODES}
                                    />
                                    <TextField
                                        label="URL"
                                        hint="required, https://…"
                                        full
                                        value={draft.url}
                                        onChange={(v) => setDraft({ ...draft, url: v })}
                                        required
                                        type="url"
                                    />
                                    <TextField
                                        label="Icon URL"
                                        hint="optional"
                                        value={draft.iconUrl ?? ''}
                                        onChange={(v) => setDraft({ ...draft, iconUrl: v || null })}
                                        type="url"
                                        placeholder="https://cdn.example.com/icon.png"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Behavior</h3>
                                <div className="form-grid form-grid--three">
                                    <CheckboxField
                                        label="Active"
                                        checked={draft.active}
                                        onChange={(v) => setDraft({ ...draft, active: v })}
                                    />
                                    <CheckboxField
                                        label="Auto-open on notification"
                                        checked={draft.autoOpen ?? true}
                                        onChange={(v) => setDraft({ ...draft, autoOpen: v })}
                                    />
                                    <CheckboxField
                                        label="Pin to bottom-bar footer"
                                        checked={draft.pinnedToFooter ?? false}
                                        onChange={(v) =>
                                            setDraft({ ...draft, pinnedToFooter: v })
                                        }
                                    />
                                    <TextField
                                        label="Footer position (1-5)"
                                        hint="optional; leave blank to append"
                                        value={draft.footerPosition != null ? String(draft.footerPosition) : ''}
                                        onChange={(v) => {
                                            const trimmed = v.trim();
                                            const n = trimmed === '' ? null : Number(trimmed);
                                            setDraft({
                                                ...draft,
                                                footerPosition:
                                                    n === null || Number.isNaN(n) ? null : n,
                                            });
                                        }}
                                        type="number"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Schedule</h3>
                                <div className="form-section__help">
                                    Both bounds optional. When set, the seatback
                                    only honours the experience inside the
                                    window.
                                </div>
                                <div className="form-grid">
                                    <TextField
                                        label="Start (UTC)"
                                        type="datetime-local"
                                        value={isoToLocalInput(draft.schedule?.start ?? null)}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                schedule: {
                                                    start: v ? localInputToIso(v) : null,
                                                    end: draft.schedule?.end ?? null,
                                                },
                                            })
                                        }
                                    />
                                    <TextField
                                        label="End (UTC)"
                                        type="datetime-local"
                                        value={isoToLocalInput(draft.schedule?.end ?? null)}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                schedule: {
                                                    start: draft.schedule?.start ?? null,
                                                    end: v ? localInputToIso(v) : null,
                                                },
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Targeting</h3>
                                <div className="form-grid">
                                    <SelectField
                                        label="Audience"
                                        value={draft.targeting.audience}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                targeting: { ...draft.targeting, audience: v },
                                            })
                                        }
                                        options={AUDIENCES}
                                    />
                                    <TextField
                                        label="Languages (ISO codes)"
                                        hint="comma-separated"
                                        value={langs}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                targeting: {
                                                    ...draft.targeting,
                                                    languages: v.split(',').map((s) => s.trim()).filter(Boolean),
                                                },
                                            })
                                        }
                                        placeholder="en, ar, ja"
                                    />
                                    <TextField
                                        label="Seat numbers"
                                        hint="comma-separated"
                                        full
                                        value={seats}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                targeting: {
                                                    ...draft.targeting,
                                                    seatNumbers: v.split(',').map((s) => s.trim()).filter(Boolean),
                                                },
                                            })
                                        }
                                        placeholder="12A, 12B"
                                    />
                                    <TextField
                                        label="Min app version"
                                        hint="optional"
                                        value={draft.targeting.minAppVersion ?? ''}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                targeting: {
                                                    ...draft.targeting,
                                                    minAppVersion: v.trim() || null,
                                                },
                                            })
                                        }
                                        placeholder="1.2.3"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Display</h3>
                                <div className="form-grid">
                                    <CheckboxField
                                        label="Show header bar"
                                        checked={draft.display.showHeader}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                display: { ...draft.display, showHeader: v },
                                            })
                                        }
                                    />
                                    <CheckboxField
                                        label="Show close button"
                                        checked={draft.display.showCloseButton}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                display: { ...draft.display, showCloseButton: v },
                                            })
                                        }
                                    />
                                    <TextField
                                        label="Width"
                                        hint="MODAL only — % or px"
                                        value={draft.display.width ?? ''}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                display: { ...draft.display, width: v.trim() || '80%' },
                                            })
                                        }
                                        placeholder="80%"
                                    />
                                    <TextField
                                        label="Height"
                                        hint="MODAL only — % or px"
                                        value={draft.display.height ?? ''}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                display: { ...draft.display, height: v.trim() || '80%' },
                                            })
                                        }
                                        placeholder="80%"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Metadata</h3>
                                <div className="form-section__help">
                                    Free-form key/value pairs surfaced to the
                                    webview bridge as window.leanbackMetadata.
                                </div>
                                <div className="config-table-wrap">
                                    <table className="config-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '30%' }}>Key</th>
                                                <th>Value</th>
                                                <th style={{ width: 60 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(draft.metadata).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="list-empty">No metadata.</td>
                                                </tr>
                                            ) : (
                                                Object.entries(draft.metadata).map(([k, v]) => (
                                                    <tr key={k}>
                                                        <td><code>{k}</code></td>
                                                        <td>{v}</td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => removeMetadata(k)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="config-add">
                                    <input
                                        type="text"
                                        placeholder="campaign_id"
                                        value={metaKey}
                                        onChange={(e) => setMetaKey(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="value"
                                        value={metaValue}
                                        onChange={(e) => setMetaValue(e.target.value)}
                                    />
                                    <div /> {/* spacer */}
                                    <button type="button" className="btn btn-primary" onClick={addMetadata}>
                                        + Add
                                    </button>
                                </div>
                            </div>

                            {draft.url.trim() ? (
                                <div className="form-section">
                                    <h3>Preview</h3>
                                    <div className="form-section__help">
                                        Live preview of <code>{draft.url}</code>.
                                        Some sites block iframes (X-Frame-Options).
                                    </div>
                                    <div className="webview-preview">
                                        <div className="webview-preview__header">
                                            <span>{draft.title || draft.id}</span>
                                            <span>{draft.display.mode} · {draft.display.width} × {draft.display.height}</span>
                                        </div>
                                        <iframe
                                            className="webview-preview__frame"
                                            src={draft.url}
                                            sandbox="allow-scripts allow-same-origin allow-forms"
                                            style={{
                                                height: draft.display.mode === 'FULL_SCREEN' ? 420 : 320,
                                            }}
                                            title="WebView preview"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div className="form-actions form-actions--split">
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={remove}
                                        disabled={!selectedId}
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={send}
                                        disabled={!draft}
                                    >
                                        Send to Fleet
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Save Experience
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
