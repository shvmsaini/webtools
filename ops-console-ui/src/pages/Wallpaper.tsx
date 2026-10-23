/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * Wallpapers page — list + editor for background images shown on the
 * seatback's welcome and language-selection screens.
 *
 * Wire contract: { id, label, imageUrl, active, updatedAt, updatedBy }
 *
 * imageUrl is an absolute (http/https) URL — the seatback downloads it
 * directly. No upload, no server-side image hosting.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import {
    CheckboxField,
    TextField,
} from '../components/EditorField';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { useToast } from '../lib/toast';
import { nowIso } from '../lib/utils';
import type { WallpaperPayload } from '../types';

function blankWallpaper(): WallpaperPayload {
    return {
        id: `wp-${Date.now()}`,
        label: '',
        imageUrl: '',
        active: true,
        updatedAt: nowIso(),
        updatedBy: api.operator,
    };
}

export function Wallpaper() {
    const toast = useToast();
    const [items, setItems] = useState<WallpaperPayload[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<WallpaperPayload | null>(null);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const list = await api.listWallpapers();
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
        const found = items?.find((w) => w.id === id);
        if (!found) return;
        setDraft({ ...found, active: found.active ?? true });
    };

    const newWallpaper = () => setDraft(blankWallpaper());

    const save = async () => {
        if (!draft) return;
        try {
            await api.saveWallpaper(draft);
            toast('Wallpaper saved.', 'success');
            await refresh();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    };

    const remove = async () => {
        if (!draft) return;
        if (!confirm(`Delete wallpaper "${draft.label || draft.id}"?`)) return;
        try {
            await api.deleteWallpaper(draft.id);
            toast('Wallpaper deleted.', 'success');
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
                    <h2>Wallpapers</h2>
                    <div className="panel-header__sub">
                        Paste image URLs for the welcome and language-selection screens.
                        The last active wallpaper in the list is applied.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <button className="btn btn-primary" onClick={newWallpaper}>
                        + New Wallpaper
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
                            <EmptyState text="No wallpapers yet. Click + New Wallpaper." />
                        ) : (
                            items.map((w) => (
                                <div
                                    key={w.id}
                                    className={`list-item ${w.id === draft?.id ? 'selected' : ''}`}
                                    onClick={() => select(w.id)}
                                >
                                    <div className="list-item-title">
                                        <span className="list-item-title-text">{w.label}</span>
                                        {w.active && (
                                            <span className="badge badge-success" style={{ marginLeft: '8px' }}>
                                                active
                                            </span>
                                        )}
                                    </div>
                                    <div className="list-item-meta">
                                        <code>{w.id}</code>
                                        {w.imageUrl ? (
                                            <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                                image loaded
                                            </span>
                                        ) : (
                                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-warning)' }}>
                                                no image
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="col-editor">
                    {!draft ? (
                        <div className="editor-empty">
                            Select a wallpaper to edit, or click <strong>+ New Wallpaper</strong>.
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
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Image URL</h3>
                                <div className="form-grid">
                                    <TextField
                                        label="Image URL"
                                        hint="Absolute URL (http/https) to the wallpaper image"
                                        value={draft.imageUrl}
                                        onChange={(v) => setDraft({ ...draft, imageUrl: v })}
                                        placeholder="https://example.com/wallpaper.jpg"
                                    />
                                    <div className="editor-field editor-field--full">
                                        <span className="editor-field__label">Preview</span>
                                        {draft.imageUrl ? (
                                            <div style={{ marginTop: '8px' }}>
                                                <img
                                                    src={draft.imageUrl}
                                                    alt="Wallpaper preview"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '200px',
                                                        borderRadius: '6px',
                                                        objectFit: 'cover',
                                                        border: '1px solid var(--color-border)',
                                                    }}
                                                    onError={() => {
                                                        toast('Failed to load image from URL', 'error');
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ marginTop: '8px', padding: '16px', textAlign: 'center', background: 'var(--color-bg-elev)', borderRadius: '6px', border: '1px dashed var(--color-border)' }}>
                                                No URL provided yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="form-grid">
                                    <CheckboxField
                                        label="Active"
                                        checked={draft.active}
                                        onChange={(v) => setDraft({ ...draft, active: v })}
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={remove}
                                >
                                    Delete Wallpaper
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Wallpaper
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
