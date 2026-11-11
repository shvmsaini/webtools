/*
 * Copyright (c) 2026 Panasonic Avionics
 *
 * APK updates page — upload an APK, set the target package and targeting,
 * then activate it to push the install to seats. Shows each seat's
 * progress as it reports back.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { CheckboxField, TextField } from '../components/EditorField';
import { TargetingSection } from '../components/TargetingSection';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { useToast } from '../lib/toast';
import { emptyTargeting, nowIso } from '../lib/utils';
import type { ApkUpdate, ApkUpdateStatus } from '../types';

function blankApk(): ApkUpdate {
    return {
        id: `apk-${Date.now()}`,
        packageName: '',
        versionName: '',
        signerFingerprint: '',
        requireReboot: false,
        // Inactive until the operator uploads a file. The server flips this
        // to true the moment the upload completes — there is no separate
        // "push" toggle. Saving metadata alone never reaches seats.
        active: false,
        createdAt: nowIso(),
        updatedBy: api.operator,
        targeting: emptyTargeting(),
    };
}

function formatBytes(n?: number | null): string {
    if (!n) return '';
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ApkUpdates() {
    const toast = useToast();
    const [items, setItems] = useState<ApkUpdate[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<ApkUpdate | null>(null);
    const [statuses, setStatuses] = useState<ApkUpdateStatus[]>([]);
    const [uploading, setUploading] = useState(false);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            setItems(await api.listApkUpdates());
        } catch (e) {
            setError(e instanceof ApiError ? e.message : String(e));
            setItems([]);
        }
    }, []);

    const loadStatuses = useCallback(async (id: string) => {
        try {
            setStatuses(await api.listApkUpdateStatuses(id));
        } catch {
            setStatuses([]);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Seats report progress over time, so refresh the status panel while an
    // update is open.
    useEffect(() => {
        if (!draft || !items?.some((a) => a.id === draft.id)) {
            setStatuses([]);
            return;
        }
        void loadStatuses(draft.id);
        const t = setInterval(() => void loadStatuses(draft.id), 5_000);
        return () => clearInterval(t);
    }, [draft?.id, items, loadStatuses]);

    const select = (id: string) => {
        const found = items?.find((a) => a.id === id);
        if (!found) return;
        setDraft({ ...found, targeting: found.targeting ?? emptyTargeting() });
    };

    const save = async () => {
        if (!draft) return;
        try {
            const saved = await api.saveApkUpdate(draft);
            setDraft({ ...saved, targeting: saved.targeting ?? emptyTargeting() });
            toast('APK update saved.', 'success');
            await refresh();
        } catch (e) {
            toast(`Save failed: ${(e as Error).message}`, 'error');
        }
    };

    const upload = async (file: File | undefined) => {
        if (!draft || !file) return;
        if (!file.name.toLowerCase().endsWith('.apk')) {
            toast('Pick a .apk file.', 'error');
            return;
        }
        setUploading(true);
        try {
            // Save metadata first so the upload attaches to a stored entry.
            await api.saveApkUpdate(draft);
            const updated = await api.uploadApkFile(draft.id, file);
            setDraft({ ...updated, targeting: updated.targeting ?? emptyTargeting() });
            toast(`Uploaded ${file.name}. Pushing to seats.`, 'success');
            await refresh();
        } catch (e) {
            toast(`Upload failed: ${(e as Error).message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    const remove = async () => {
        if (!draft) return;
        if (!confirm(`Delete APK update "${draft.id}" and its file?`)) return;
        try {
            await api.deleteApkUpdate(draft.id);
            toast('APK update deleted.', 'success');
            setDraft(null);
            await refresh();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    };

    const isSaved = !!draft && !!items?.some((a) => a.id === draft.id);
    const hasFile = !!draft?.sha256;

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>APK Updates</h2>
                    <div className="panel-header__sub">
                        Upload an APK and it's automatically pushed to every seat on the next poll —
                        seats download it, verify the SHA-256, and install it via PackageInstaller.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setDraft(blankApk())}
                    >
                        + New APK Update
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
                            <EmptyState text="No APK updates yet. Click + New APK Update." />
                        ) : (
                            items.map((a) => (
                                <div
                                    key={a.id}
                                    className={`list-item ${a.id === draft?.id ? 'selected' : ''}`}
                                    onClick={() => select(a.id)}
                                >
                                    <div className="list-item-title">
                                        <span className="list-item-title-text">
                                            {a.packageName || a.id}
                                        </span>
                                        {a.active && (
                                            <span className="badge badge-success" style={{ marginLeft: '8px' }}>
                                                active
                                            </span>
                                        )}
                                    </div>
                                    <div className="list-item-meta">
                                        <code>{a.id}</code>
                                        {a.versionName && (
                                            <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                                v{a.versionName}
                                            </span>
                                        )}
                                        {a.sha256 ? (
                                            <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                                {formatBytes(a.sizeBytes)}
                                            </span>
                                        ) : (
                                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-warning)' }}>
                                                no file
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
                            Select an APK update to edit, or click <strong>+ New APK Update</strong>.
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
                                <h3>Package</h3>
                                <div className="form-grid">
                                    <TextField
                                        label="ID"
                                        hint="required, unique"
                                        value={draft.id}
                                        onChange={(v) => setDraft({ ...draft, id: v })}
                                        required
                                    />
                                </div>
                                <div
                                    className="editor-field editor-field--full"
                                    style={{ fontSize: '12px', marginTop: '8px', padding: '12px', background: 'var(--color-bg-elev)', borderRadius: '6px' }}
                                >
                                    <div>
                                        <strong>Package name:</strong>{' '}
                                        {draft.packageName ? (
                                            <code>{draft.packageName}</code>
                                        ) : (
                                            <em style={{ color: 'var(--color-warning)' }}>
                                                not yet known — read from APK on upload
                                            </em>
                                        )}
                                    </div>
                                    <div>
                                        <strong>Version:</strong>{' '}
                                        {draft.versionName ? (
                                            <code>v{draft.versionName}</code>
                                        ) : (
                                            <em style={{ color: 'var(--color-warning)' }}>
                                                not yet known — read from APK on upload
                                            </em>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>APK file</h3>
                                <div className="form-grid">
                                    <div className="editor-field editor-field--full">
                                        <span className="editor-field__label">
                                            Upload .apk
                                            <small className="editor-field__hint">
                                                {' '}Drop a .apk file. The package name and version are read from the manifest and pushed to seats as soon as the upload finishes.
                                            </small>
                                        </span>
                                        <input
                                            type="file"
                                            accept=".apk,application/vnd.android.package-archive"
                                            disabled={uploading}
                                            onChange={(e) => {
                                                void upload(e.target.files?.[0]);
                                                e.target.value = '';
                                            }}
                                        />
                                        {uploading && <div style={{ marginTop: '6px' }}>Uploading…</div>}
                                    </div>
                                    {hasFile ? (
                                        <div className="editor-field editor-field--full" style={{ fontSize: '12px' }}>
                                            <div><strong>File:</strong> {draft.fileName} ({formatBytes(draft.sizeBytes)})</div>
                                            <div style={{ wordBreak: 'break-all' }}>
                                                <strong>SHA-256:</strong> <code>{draft.sha256}</code>
                                            </div>
                                            <div style={{ wordBreak: 'break-all' }}>
                                                <strong>Download:</strong> <code>{draft.downloadUrl}</code>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="editor-field editor-field--full"
                                            style={{ padding: '16px', textAlign: 'center', background: 'var(--color-bg-elev)', borderRadius: '6px', border: '1px dashed var(--color-border)' }}
                                        >
                                            No APK uploaded yet.
                                        </div>
                                    )}
                                    <TextField
                                        label="Signer certificate SHA-256"
                                        hint="optional, lowercase hex; seat rejects the APK if it is signed by another key"
                                        value={draft.signerFingerprint ?? ''}
                                        onChange={(v) => setDraft({ ...draft, signerFingerprint: v })}
                                        full
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="form-grid">
                                    <CheckboxField
                                        label="Reboot seat after install"
                                        checked={draft.requireReboot}
                                        onChange={(v) => setDraft({ ...draft, requireReboot: v })}
                                    />
                                </div>
                            </div>

                            <TargetingSection
                                value={draft.targeting ?? emptyTargeting()}
                                onChange={(next) => setDraft({ ...draft, targeting: next })}
                                heading="Targeting"
                                helpText="Leave blank to install on every seat. Set seat numbers to limit the install to specific seats."
                            />

                            {isSaved && (
                                <div className="form-section">
                                    <h3>Seat progress</h3>
                                    {statuses.length === 0 ? (
                                        <div className="list-empty">No seat has reported yet.</div>
                                    ) : (
                                        <table style={{ width: '100%', fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th align="left">Seat / device</th>
                                                    <th align="left">Status</th>
                                                    <th align="left">Detail</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {statuses.map((s) => (
                                                    <tr key={`${s.updateId}|${s.deviceId}`}>
                                                        <td><code>{s.deviceId ?? 'unknown'}</code></td>
                                                        <td>{s.status}</td>
                                                        <td>{s.errorMessage ?? (s.reportedAt ? new Date(s.reportedAt).toLocaleString() : '')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            <div className="form-actions">
                                {isSaved && (
                                    <button type="button" className="btn btn-danger" onClick={remove}>
                                        Delete APK Update
                                    </button>
                                )}
                                <button type="submit" className="btn btn-primary">
                                    Save APK Update
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
