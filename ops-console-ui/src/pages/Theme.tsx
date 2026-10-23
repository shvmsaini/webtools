/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Theme page — list + editor for visual themes.
 *
 * Covers every field of the wire contract:
 *   - id, label, description, colorTokens
 *   - updatedAt, updatedBy
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { useToast } from '../lib/toast';
import { TextField, TextareaField } from '../components/EditorField';
import { nowIso } from '../lib/utils';
import type { ThemePayload } from '../types';

const DEFAULT_TOKENS: Record<string, string> = {
    primary: '#d71921',
    primaryDark: '#b91419',
    primaryLight: '#fef2f3',
    background: '#0a001a',
    backgroundImage: '',
    surface: '#1e293b',
    textPrimary: '#f5f5f9',
    textMuted: '#bcb7c8',
    footerBackground: '#0a001a',
    footerItem: '#d71921',
    sidebarBackground: '#0a001a',
    globalNavBackground: '#4b0e12',
    sidebarItemHighlight: '#4dffffff',
    sidebarItemFocused: '#4dffffff',
    sidebarItemSelected: '#99ffffff',
    sidebarDivder: '#80ffffff',
    borderDefault: '#2A3447',
};

const TOKEN_LABELS: Record<keyof typeof DEFAULT_TOKENS, string> = {
    primary: 'Primary Button',
    primaryDark: 'Primary Dark',
    primaryLight: 'Primary Surface',
    background: 'Window Background',
    backgroundImage: 'Background Image URL',
    surface: 'Card Surface',
    textPrimary: 'Text Primary',
    textMuted: 'Text Muted',
    footerBackground: 'Footer Background',
    footerItem: 'Footer Icon Active',
    sidebarBackground: 'Sidebar Background (left menu)',
    globalNavBackground: 'Global Nav Background (Home/Brightness sidebar)',
    sidebarItemHighlight: 'Sidebar Item Highlight',
    sidebarItemFocused: 'Sidebar Item Focused',
    sidebarItemSelected: 'Sidebar Item Selected',
    sidebarDivder: 'Sidebar Divider Color',
    borderDefault: 'Default Border Color',
};

/**
 * Pre-built themes for seasonal/campaign rollouts.
 *
 * Operators pick one to populate the draft; they can tweak any token
 * afterwards. backgroundImage stays empty unless the template includes a URL.
 */
const THEME_TEMPLATES: Array<{ name: string; tokens: Record<string, string> }> = [
    {
        name: '🎄 Christmas',
        tokens: {
            primary: '#c41e3a',
            primaryDark: '#8b0000',
            primaryLight: '#fff5f5',
            background: '#0d3b1f',
            backgroundImage: '',
            surface: '#1a5c33',
            textPrimary: '#ffffff',
            textMuted: '#d4e8d4',
            footerBackground: '#0d3b1f',
            footerItem: '#ff6b35',
            sidebarBackground: '#8b0000',
            globalNavBackground: '#c41e3a',
            sidebarItemHighlight: '#ffff0050',
            sidebarItemFocused: '#ffff0099',
            sidebarItemSelected: '#ffff00cc',
            sidebarDivder: '#ffffff80',
            borderDefault: '#2d6b3e',
        },
    },
    {
        name: '🪔 Diwali',
        tokens: {
            primary: '#ff9933',
            primaryDark: '#cc6600',
            primaryLight: '#fff8e7',
            background: '#1a0a1f',
            backgroundImage: '',
            surface: '#3d1f4d',
            textPrimary: '#fff8e7',
            textMuted: '#e6c89c',
            footerBackground: '#1a0a1f',
            footerItem: '#ffd700',
            sidebarBackground: '#4d1f5c',
            globalNavBackground: '#ff9933',
            sidebarItemHighlight: '#ffd70050',
            sidebarItemFocused: '#ffd70099',
            sidebarItemSelected: '#ffd700cc',
            sidebarDivder: '#ffd70080',
            borderDefault: '#5d2f6c',
        },
    },
    {
        name: '⚽ FIFA',
        tokens: {
            primary: '#1e88e5',
            primaryDark: '#0d47a1',
            primaryLight: '#e3f2fd',
            background: '#0a3d62',
            backgroundImage: '',
            surface: '#1e5c8a',
            textPrimary: '#ffffff',
            textMuted: '#b3d9ff',
            footerBackground: '#0a3d62',
            footerItem: '#4caf50',
            sidebarBackground: '#0d47a1',
            globalNavBackground: '#1e88e5',
            sidebarItemHighlight: '#4caf5050',
            sidebarItemFocused: '#4caf5099',
            sidebarItemSelected: '#4caf50cc',
            sidebarDivder: '#ffffff80',
            borderDefault: '#2e6ca0',
        },
    },
    {
        name: '🎃 Halloween',
        tokens: {
            primary: '#ff7518',
            primaryDark: '#cc5500',
            primaryLight: '#fff0e0',
            background: '#1a0a00',
            backgroundImage: '',
            surface: '#3d1f0a',
            textPrimary: '#ff7518',
            textMuted: '#cc6600',
            footerBackground: '#1a0a00',
            footerItem: '#9933ff',
            sidebarBackground: '#2d0a4d',
            globalNavBackground: '#ff7518',
            sidebarItemHighlight: '#9933ff50',
            sidebarItemFocused: '#9933ff99',
            sidebarItemSelected: '#9933ffcc',
            sidebarDivder: '#ff751880',
            borderDefault: '#5d2f0a',
        },
    },
    {
        name: '💖 Valentine',
        tokens: {
            primary: '#ff1744',
            primaryDark: '#cc0033',
            primaryLight: '#ffe6ec',
            background: '#1a0011',
            backgroundImage: '',
            surface: '#3d0a22',
            textPrimary: '#ffe6ec',
            textMuted: '#ffb3c8',
            footerBackground: '#1a0011',
            footerItem: '#ff4081',
            sidebarBackground: '#660022',
            globalNavBackground: '#ff1744',
            sidebarItemHighlight: '#ff408150',
            sidebarItemFocused: '#ff408199',
            sidebarItemSelected: '#ff4081cc',
            sidebarDivder: '#ffe6ec80',
            borderDefault: '#5d0a33',
        },
    },
    {
        name: '🌸 Spring',
        tokens: {
            primary: '#ec407a',
            primaryDark: '#c2185b',
            primaryLight: '#fce4ec',
            background: '#1a3d1a',
            backgroundImage: '',
            surface: '#3d6b3d',
            textPrimary: '#ffffff',
            textMuted: '#c8e6c9',
            footerBackground: '#1a3d1a',
            footerItem: '#66bb6a',
            sidebarBackground: '#2e5c2e',
            globalNavBackground: '#ec407a',
            sidebarItemHighlight: '#66bb6a50',
            sidebarItemFocused: '#66bb6a99',
            sidebarItemSelected: '#66bb6acc',
            sidebarDivder: '#ffffff80',
            borderDefault: '#5d8f5d',
        },
    },
];

function blankTheme(): ThemePayload {
    return {
        id: `theme-${Date.now()}`,
        label: '',
        description: null,
        colorTokens: { ...DEFAULT_TOKENS },
        updatedAt: nowIso(),
        updatedBy: api.operator,
    };
}

export function Theme() {
    const toast = useToast();
    const [items, setItems] = useState<ThemePayload[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<ThemePayload | null>(null);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const list = await api._fetch<ThemePayload[]>('/api/v1/config/themes');
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

    const select = (id: string) => {
        const found = items?.find((t) => t.id === id);
        if (!found) return;
        setDraft({
            ...found,
            colorTokens: {
                ...DEFAULT_TOKENS,
                ...found.colorTokens,
            },
        });
    };

    const newTheme = () => setDraft(blankTheme());

    /**
     * Populate the draft with a pre-built theme (Christmas, Diwali, etc.).
     * Preserves the draft's id/label so repeated clicks don't churn ids.
     */
    const applyTemplate = (templateTokens: Record<string, string>) => {
        if (!draft) {
            setDraft({ ...blankTheme(), colorTokens: { ...DEFAULT_TOKENS, ...templateTokens } });
            return;
        }
        setDraft({
            ...draft,
            colorTokens: { ...DEFAULT_TOKENS, ...templateTokens },
        });
        toast('Template applied — review and save.', 'success');
    };

    const save = async () => {
        if (!draft) return;
        try {
            await api._fetch<ThemePayload>('/api/v1/config/themes', {
                method: 'POST',
                body: JSON.stringify(draft),
            });
            toast('Theme saved.', 'success');
            await refresh();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    };

    /**
     * Set the theme as active (move it to the end of the list so all
     * devices will pull it from the bundle).
     */
    const setActive = async () => {
        if (!draft) return;
        try {
            await api._fetch(`/api/v1/config/themes/${encodeURIComponent(draft.id)}/set-active`, {
                method: 'POST',
            });
            toast(`"${draft.label || draft.id}" is now active.`, 'success');
            await refresh();
        } catch (e) {
            toast(`Set active failed: ${(e as Error).message}`, 'error');
        }
    };

    const remove = async () => {
        if (!draft) return;
        if (!confirm(`Delete theme "${draft.label || draft.id}"?`)) return;
        try {
            await api._fetch('/api/v1/config/themes/' + encodeURIComponent(draft.id), {
                method: 'DELETE',
            });
            toast('Theme deleted.', 'success');
            setDraft(null);
            await refresh();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    };

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>Themes</h2>
                    <div className="panel-header__sub">
                        Define color tokens the seatback applies.
                        The last theme in the bundle is applied globally.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <select
                        className="btn btn-ghost"
                        onChange={(e) => {
                            const idx = parseInt(e.target.value, 10);
                            if (!isNaN(idx) && THEME_TEMPLATES[idx]) {
                                applyTemplate(THEME_TEMPLATES[idx].tokens);
                            }
                            e.target.value = '';
                        }}
                        defaultValue=""
                        title="Apply a pre-built theme"
                        style={{ paddingRight: '24px' }}
                    >
                        <option value="" disabled>📋 Templates…</option>
                        {THEME_TEMPLATES.map((t, i) => (
                            <option key={t.name} value={i}>{t.name}</option>
                        ))}
                    </select>
                    <button className="btn btn-primary" onClick={newTheme}>
                        + New Theme
                    </button>
                </div>
            </div>
            <div className="two-col">
                <div className="col-list">
                    <div className="list-items">
                        {error ? (
                            <ErrorState message={error} />
                        ) : items === null ? (
                            <LoadingState />
                        ) : items.length === 0 ? (
                            <EmptyState text="No themes yet. Click + New Theme." />
                        ) : (
                            items.map((t) => (
                                <div
                                    key={t.id}
                                    className={`list-item ${t.id === draft?.id ? 'selected' : ''}`}
                                    onClick={() => select(t.id)}
                                >
                                    <div className="list-item-title">
                                        <span className="list-item-title-text">{t.label}</span>
                                    </div>
                                    <div className="list-item-meta">
                                        <code>{t.id}</code>
                                        {t.description ? `
                                        — ${t.description}` : ''}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="col-editor">
                    {!draft ? (
                        <div className="editor-empty">
                            Select a theme to edit, or click <strong>+ New Theme</strong>.
                        </div>
                    ) : (
                        <form
                            className="editor-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void save();
                            }}
                        >
                            <div className="form-section">
                                <h3>Basics</h3>
                                <div className="form-grid">
                                    <TextField
                                        label="ID"
                                        hint="required, lowercase"
                                        value={draft.id}
                                        onChange={(v) => setDraft({ ...draft, id: v })}
                                        required
                                    />
                                    <TextField
                                        label="Label"
                                        value={draft.label}
                                        onChange={(v) => setDraft({ ...draft, label: v })}
                                        required
                                    />
                                    <TextareaField
                                        label="Description (optional)"
                                        full
                                        value={draft.description || ''}
                                        onChange={(v) => setDraft({ ...draft, description: v.trim() || null })}
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Color Tokens</h3>
                                <div className="token-grid">
                                    {(Object.keys(DEFAULT_TOKENS) as Array<keyof typeof DEFAULT_TOKENS>).map((token) => {
                                        const isUrl = token === 'backgroundImage';
                                        return (
                                            <div key={token} className="token-row">
                                                <label className="token-row__name">
                                                    {TOKEN_LABELS[token]}
                                                    <code className="token-row__key">{token}</code>
                                                </label>
                                                <div className="token-row__controls">
                                                    {!isUrl && (
                                                        <input
                                                            type="color"
                                                            className="token-row__swatch"
                                                            value={draft.colorTokens[token]}
                                                            onChange={(e) =>
                                                                setDraft({
                                                                    ...draft,
                                                                    colorTokens: {
                                                                        ...draft.colorTokens,
                                                                        [token]: e.target.value,
                                                                    },
                                                                })
                                                            }
                                                        />
                                                    )}
                                                    <input
                                                        type={isUrl ? 'url' : 'text'}
                                                        className="token-row__hex"
                                                        value={draft.colorTokens[token]}
                                                        placeholder={isUrl ? 'https://example.com/bg.jpg' : ''}
                                                        onChange={(e) =>
                                                            setDraft({
                                                                ...draft,
                                                                colorTokens: {
                                                                    ...draft.colorTokens,
                                                                    [token]: e.target.value,
                                                                },
                                                            })
                                                    }
                                                />
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Theme preview using draft tokens */}
                            <div className="form-section">
                                <h3>Preview (seatback screen layout)</h3>
                                <div className="theme-preview" style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                    {/* Global Nav Sidebar (Home/Brightness/Back) */}
                                    <div
                                        style={{
                                            width: '60px',
                                            background: draft.colorTokens.globalNavBackground,
                                            color: draft.colorTokens.textPrimary,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            padding: '16px 6px',
                                            alignItems: 'center',
                                        }}
                                    >
                                        {['🏠', '←', '🔊', '☀️'].map((icon, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    background: 'transparent',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '20px',
                                                }}
                                            >
                                                {icon}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Main Sidebar (Movies/TV Shows) */}
                                    <div
                                        style={{
                                            width: '160px',
                                            background: draft.colorTokens.sidebarBackground,
                                            color: draft.colorTokens.textPrimary,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '20px 12px',
                                        }}
                                    >
                                        {['Movies', 'TV Shows', 'Shopping', 'Internet', 'My Flight', 'Information', 'Live TV'].map((label, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    background: i === 0 ? `rgba(${parseInt(draft.colorTokens.sidebarItemHighlight.slice(1, 3), 16)}, ${parseInt(draft.colorTokens.sidebarItemHighlight.slice(3, 5), 16)}, ${parseInt(draft.colorTokens.sidebarItemHighlight.slice(5, 7), 16)}, 0.3)` : 'transparent',
                                                    color: i === 0 ? draft.colorTokens.textPrimary : draft.colorTokens.textMuted,
                                                }}
                                            >
                                                {label}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Main Content Area */}
                                    <div
                                        style={{
                                            flex: 1,
                                            background: draft.colorTokens.backgroundImage
                                                ? `url(${draft.colorTokens.backgroundImage}) center/cover no-repeat, ${draft.colorTokens.background}`
                                                : draft.colorTokens.background,
                                            color: draft.colorTokens.textPrimary,
                                            padding: '20px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Movies</div>
                                            <div style={{ fontSize: '12px', color: draft.colorTokens.textMuted }}>MIAT Airlines</div>
                                        </div>

                                        {/* Content Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                            {['Browse Movies', 'TV Shows', 'Continue Watching', 'Top Rated'].map((label, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        background: draft.colorTokens.surface,
                                                        border: `1px solid ${draft.colorTokens.borderDefault}`,
                                                        borderRadius: '6px',
                                                        padding: '20px',
                                                        minHeight: '80px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '14px',
                                                        color: draft.colorTokens.textMuted,
                                                    }}
                                                >
                                                    {label}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Footer Menu */}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: `1px solid ${draft.colorTokens.borderDefault}`, paddingTop: '12px' }}>
                                            {['Home', 'Shop', 'Info', 'Flight'].map((item, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        textAlign: 'center',
                                                        fontSize: '12px',
                                                        background: i === 0 ? draft.colorTokens.primary : 'transparent',
                                                        color: i === 0 ? '#fff' : draft.colorTokens.textMuted,
                                                        borderRadius: '4px',
                                                    }}
                                                >
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div>
                                        <strong>Main sidebar (Movies/TV Shows):</strong> <code>sidebarBackground</code> = <code>{draft.colorTokens.sidebarBackground}</code>
                                    </div>
                                    <div>
                                        <strong>Global nav (Home/Brightness/Back):</strong> <code>globalNavBackground</code> = <code>{draft.colorTokens.globalNavBackground}</code>
                                    </div>
                                    <div>
                                        <strong>Background image:</strong> <code>backgroundImage</code>{draft.colorTokens.backgroundImage ? ` = ${draft.colorTokens.backgroundImage}` : ' (none — using solid background)'}
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={remove}
                                >
                                    Delete Theme
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={setActive}
                                    title="Activate this theme for all devices in the fleet"
                                >
                                    ✓ Set as Active
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Theme
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
