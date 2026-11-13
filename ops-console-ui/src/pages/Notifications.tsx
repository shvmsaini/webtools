/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Notifications page — list + editor for push notifications.
 *
 * Covers every field of the wire contract:
 *   - id, title, body, iconUrl, ctaUrl
 *   - category, channel, mandatory, autoOpen, expiresAt
 *   - targeting: audience, languages, seatNumbers
 *   - createdBy, createdAt (auto-stamped on send)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import {
    CheckboxField,
    SelectField,
    TextareaField,
    TextField,
} from '../components/EditorField';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { useToast } from '../lib/toast';
import { emptyTargeting, nowIso } from '../lib/utils';
import type {
    Audience,
    Category,
    DeliveryChannel,
    NotificationInput,
    NotificationPayload,
    NotificationTemplate,
    QuizOption,
    QuizType,
} from '../types';

// Quiz/yes-no response template
const YES_NO_OPTIONS: QuizOption[] = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' }
];

const QUICK_QUIZ_OPTIONS: QuizOption[] = [
    { id: 'excellent', label: 'Excellent' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Fair' },
    { id: 'poor', label: 'Poor' }
];

const CATEGORIES: ReadonlyArray<{ value: Category; label: string }> = [
    { value: 'OPERATIONAL', label: 'Operational' },
    { value: 'GATE_CHANGE', label: 'Gate Change' },
    { value: 'WEATHER', label: 'Weather' },
    { value: 'ADVISORY', label: 'Advisory' },
    { value: 'ANNOUNCEMENT', label: 'Announcement' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'CHAIRMAN_MESSAGE', label: 'Chairman Message' },
    { value: 'QUIZ', label: 'Quiz' },
    { value: 'SURVEY', label: 'Survey' },
    { value: 'POLLERT', label: 'Poll/Simple Question' },
];

const CHANNELS: ReadonlyArray<{ value: DeliveryChannel; label: string }> = [
    { value: 'POLL', label: 'Polling (REST)' },
    { value: 'MQTT_PUSH', label: 'MQTT Push (UMB)' },
    { value: 'WEBHOOK', label: 'Webhook' },
];

const AUDIENCES: ReadonlyArray<{ value: Audience; label: string }> = [
    { value: 'ALL', label: 'All Seats' },
    { value: 'FIRST', label: 'First Class' },
    { value: 'BUSINESS', label: 'Business' },
    { value: 'ECONOMY', label: 'Economy' },
];

function blankNotification(): NotificationInput {
    return {
        id: `notif-${Date.now()}`,
        title: '',
        body: '',
        iconUrl: null,
        ctaUrl: null,
        autoOpen: true,
        mandatory: false,
        channel: 'POLL',
        targeting: emptyTargeting(),
        expiresAt: null,
        category: 'ANNOUNCEMENT',
        createdBy: api.operator,
        createdAt: nowIso(),
    };
}

function isoToLocalInput(iso: string | null): string {
    if (!iso) return '';
    // datetime-local wants YYYY-MM-DDTHH:mm — strip the seconds and tz
    return iso.substring(0, 16);
}

function localInputToIso(local: string): string | null {
    if (!local) return null;
    // Append seconds + Z so the backend receives a full ISO-8601 UTC
    return new Date(local).toISOString();
}

const QUIZ_TYPES: ReadonlyArray<{ value: QuizType; label: string }> = [
    { value: 'YES_NO', label: 'Yes/No' },
    { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
    { value: 'RATING', label: 'Rating (1-5)' },
    { value: 'FREE_TEXT', label: 'Free Text' }
];

/** Predefined templates for quick notification creation */
const TEMPLATES: NotificationTemplate[] = [
    {
        id: 'gateway-change',
        label: '🛫 Gate Change Notification',
        category: 'GATE_CHANGE',
        icon: '📍',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: true,
            mandatory: false,
            channel: 'POLL',
            targeting: emptyTargeting(),
            expiresAt: null,
            collectResponses: false,
        }
    },
    {
        id: 'weather-delay',
        label: '⛈ Weather Advisory',
        category: 'WEATHER',
        icon: '⛈',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: false,
            mandatory: true,
            channel: 'POLL',
            targeting: emptyTargeting(),
            expiresAt: null,
            collectResponses: false,
        }
    },
    {
        id: 'chairman-message',
        label: '🎙 Chairman Message',
        category: 'CHAIRMAN_MESSAGE',
        icon: '🎙',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: false,
            mandatory: true,
            channel: 'POLL',
            targeting: { audience: 'ALL', languages: [], seatNumbers: [], minAppVersion: null },
            expiresAt: null,
            collectResponses: false,
        }
    },
    {
        id: 'yes-no-quick',
        label: '✅ Yes/No Question',
        category: 'POLLERT',
        icon: '❓',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: true,
            mandatory: false,
            channel: 'POLL',
            targeting: emptyTargeting(),
            expiresAt: null,
            collectResponses: true,
            quiz: {
                type: 'YES_NO',
                question: 'Your question here',
                options: YES_NO_OPTIONS,
                allowMultiple: false,
                requireResponse: false,
                responseTimeoutSeconds: 60
            }
        }
    },
    {
        id: 'quick-survey',
        label: '📊 Quick Satisfaction Survey',
        category: 'SURVEY',
        icon: '📊',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: true,
            mandatory: false,
            channel: 'POLL',
            targeting: emptyTargeting(),
            expiresAt: null,
            collectResponses: true,
            quiz: {
                type: 'MULTIPLE_CHOICE',
                question: 'How satisfied are you with the service?',
                options: QUICK_QUIZ_OPTIONS,
                allowMultiple: false,
                requireResponse: false,
                responseTimeoutSeconds: 60
            }
        }
    },
    {
        id: 'rating-prompt',
        label: '⭐ Rating Prompt',
        category: 'QUIZ',
        icon: '⭐',
        payload: {
            iconUrl: null,
            ctaUrl: null,
            autoOpen: true,
            mandatory: false,
            channel: 'POLL',
            targeting: emptyTargeting(),
            expiresAt: null,
            collectResponses: true,
            quiz: {
                type: 'RATING',
                question: 'Rate our new feature (1-5)',
                options: null,
                minRating: 1,
                maxRating: 5,
                allowMultiple: false,
                requireResponse: false,
                responseTimeoutSeconds: 60
            }
        }
    }
];

export function Notifications() {
    const toast = useToast();
    const [items, setItems] = useState<NotificationPayload[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<NotificationInput | null>(null);
    const [filter, setFilter] = useState('');

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const list = await api.listNotifications();
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
            (n) =>
                n.title.toLowerCase().includes(q) ||
                n.id.toLowerCase().includes(q) ||
                (n.body ?? '').toLowerCase().includes(q)
        );
    }, [items, filter]);

    const save = async () => {
        if (!draft) return;
        if (!draft.id.trim() || !draft.title.trim()) {
            toast('ID and Title are required.', 'error');
            return;
        }
        try {
            await api.createNotification({ ...draft, createdAt: nowIso() });
            setSelectedId(draft.id);
            toast('Notification sent.', 'success');
            await refresh();
        } catch (e) {
            toast(`Send failed: ${(e as Error).message}`, 'error');
        }
    };

    const remove = async () => {
        if (!selectedId) return;
        if (!confirm(`Delete notification "${selectedId}"?`)) return;
        try {
            await api.deleteNotification(selectedId);
            setSelectedId(null);
            setDraft(null);
            toast('Notification deleted.', 'success');
            await refresh();
        } catch (e) {
            toast(`Delete failed: ${(e as Error).message}`, 'error');
        }
    };

    const select = (id: string) => {
        const found = items?.find((n) => n.id === id);
        if (!found) return;
        setSelectedId(id);
        const { createdAt: _createdAt, ...rest } = found;
        void _createdAt;
        // Backfill any missing optional fields so the editor form doesn't
        // crash on records authored before the field was added.
        setDraft({
            ...rest,
            targeting: found.targeting ?? emptyTargeting(),
            createdAt: nowIso(),
        });
    };

    const newNotification = () => {
        setSelectedId(null);
        setDraft(blankNotification());
    };

    const duplicate = () => {
        if (!draft) return;
        const copy = { ...draft, id: `${draft.id}-copy-${Date.now()}` };
        setSelectedId(null);
        setDraft(copy);
        toast('Duplicated. Update the ID and Send.', 'success');
    };

    const langs = draft ? draft.targeting.languages.join(', ') : '';
    const seats = draft ? draft.targeting.seatNumbers.join(', ') : '';

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>Push Notifications</h2>
                    <div className="panel-header__sub">
                        Send messages to seatback screens. The seatback polls
                        /api/v1/config/bundle every 5s and surfaces new items
                        via NotificationBridge.
                    </div>
                </div>
                <div className="panel-actions">
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <button className="btn btn-primary" onClick={newNotification}>
                        + New Notification
                    </button>
                </div>
            </div>
            <div className="two-col">
                <div className="col-list">
                    <div className="config-toolbar">
                        <input
                            type="search"
                            placeholder="Filter by title / id / body…"
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
                            <EmptyState text={filter ? 'No matches.' : 'No notifications yet. Click + New Notification.'} />
                        ) : (
                            filtered.map((n) => (
                                <div
                                    key={n.id}
                                    className={`list-item ${n.id === selectedId ? 'selected' : ''}`}
                                    onClick={() => select(n.id)}
                                >
                                    <div className="list-item-title">
                                        <span className="list-item-title-text">{n.title || <em style={{ color: 'var(--color-text-faint)' }}>(no title)</em>}</span>
                                        <span className={`cat-pill ${n.category || 'ANNOUNCEMENT'}`}>
                                            {(n.category || '').replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="list-item-meta">
                                        <code>{n.id}</code> · {n.channel}
                                        {n.mandatory ? (
                                            <>
                                                {' · '}
                                                <span className="badge badge--danger">mandatory</span>
                                            </>
                                        ) : null}
                                        {n.expiresAt ? (
                                            <>
                                                {' · '}
                                                <span className="badge badge--warn">expires</span>
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
                            Select a notification to edit, or click{' '}
                            <strong>+ New Notification</strong>.
                            <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius)' }}>
                                <h4 style={{ marginBottom: 'var(--sp-2)' }}>📋 Quick Templates</h4>
                                <select
                                    className="input"
                                    value=""
                                    onChange={(e) => {
                                        const templateId = e.target.value;
                                        if (!templateId) return;
                                        e.target.value = '';
                                        const tmpl = TEMPLATES.find(t => t.id === templateId);
                                        if (!tmpl) return;
                                        const newDraft: NotificationInput = {
                                            ...tmpl.payload,
                                            id: `notif-${Date.now()}`,
                                            title: '',
                                            body: '',
                                            category: tmpl.category,
                                            createdBy: api.operator,
                                            createdAt: nowIso(),
                                            targeting: tmpl.payload.targeting,
                                        };
                                        setDraft(newDraft);
                                        toast(`Created from template: ${tmpl.label}`, 'success');
                                    }}
                                    style={{ minWidth: '240px' }}
                                >
                                    <option value="">— Choose a template —</option>
                                    {TEMPLATES.map(t => (
                                        <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                    ))}
                                </select>
                                <p style={{ marginTop: 'var(--sp-1)', fontSize: '12px', color: 'var(--color-text-faint)' }}>
                                    Quick-start with predefined message types and quizzes
                                </p>
                            </div>
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
                                <h3>Content</h3>
                                <div className="form-grid">
                                    <TextField
                                        label="ID"
                                        hint="required, lowercase"
                                        value={draft.id}
                                        onChange={(v) => setDraft({ ...draft, id: v })}
                                        required
                                    />
                                    <SelectField
                                        label="Category"
                                        value={draft.category}
                                        onChange={(v) => setDraft({ ...draft, category: v })}
                                        options={CATEGORIES}
                                    />
                                    <TextField
                                        label="Title"
                                        hint="required, max 120"
                                        full
                                        value={draft.title}
                                        onChange={(v) => setDraft({ ...draft, title: v })}
                                        required
                                        maxLength={120}
                                    />
                                    <TextareaField
                                        label="Body"
                                        full
                                        value={draft.body ?? ''}
                                        onChange={(v) => setDraft({ ...draft, body: v })}
                                        maxLength={500}
                                    />
                                    <TextField
                                        label="Icon URL"
                                        hint="optional"
                                        value={draft.iconUrl ?? ''}
                                        onChange={(v) => setDraft({ ...draft, iconUrl: v || null })}
                                        type="url"
                                        placeholder="https://cdn.example.com/icon.png"
                                    />
                                    <TextField
                                        label="CTA URL"
                                        hint="webview:<id> or http(s)://…"
                                        value={draft.ctaUrl ?? ''}
                                        onChange={(v) => setDraft({ ...draft, ctaUrl: v || null })}
                                        type="url"
                                        placeholder="webview:my-experience"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Delivery</h3>
                                <div className="form-section__help">
                                    Channels other than POLL are sent immediately;
                                    POLL is delivered on the seatback's next 5s
                                    poll cycle.
                                </div>
                                <div className="form-grid">
                                    <SelectField
                                        label="Channel"
                                        value={draft.channel}
                                        onChange={(v) => setDraft({ ...draft, channel: v })}
                                        options={CHANNELS}
                                    />
                                    <TextField
                                        label="Expires at"
                                        hint="optional, ISO-8601 UTC"
                                        type="datetime-local"
                                        value={isoToLocalInput(draft.expiresAt ?? null)}
                                        onChange={(v) =>
                                            setDraft({
                                                ...draft,
                                                expiresAt: v ? localInputToIso(v) : null,
                                            })
                                        }
                                    />
                                    <CheckboxField
                                        label="Mandatory — blocks screen, no auto-dismiss"
                                        checked={draft.mandatory}
                                        onChange={(v) => setDraft({ ...draft, mandatory: v })}
                                    />
                                    <CheckboxField
                                        label="Auto-open CTA — skip popup, open webview directly"
                                        checked={draft.autoOpen ?? true}
                                        onChange={(v) => setDraft({ ...draft, autoOpen: v })}
                                    />
                                </div>
                            </div>

                            {/* Quiz/Survey Configuration */}
                            {['QUIZ', 'SURVEY', 'POLLERT'].includes(draft.category) && (
                                <div className="form-section">
                                    <h3>Quiz / Survey Configuration</h3>
                                    <div className="form-section__help">
                                        Enable response collection and configure the question type.
                                    </div>
                                    <div className="form-grid">
                                        <CheckboxField
                                            label="Collect responses from passengers"
                                            checked={draft.collectResponses ?? false}
                                            onChange={(v) => setDraft({ ...draft, collectResponses: v })}
                                        />
                                        <SelectField
                                            label="Quiz Type"
                                            value={draft.quiz?.type ?? 'YES_NO'}
                                            onChange={(v) => setDraft({
                                                ...draft,
                                                quiz: {
                                                    ...draft.quiz,
                                                    type: v as QuizType,
                                                    question: draft.quiz?.question ?? '',
                                                    options: v === 'YES_NO' ? YES_NO_OPTIONS : v === 'RATING' ? null : draft.quiz?.options ?? []
                                                }
                                            })}
                                            options={QUIZ_TYPES}
                                        />
                                        <TextField
                                            label="Question"
                                            hint="Question to ask passengers"
                                            full
                                            value={draft.quiz?.question ?? ''}
                                            onChange={(v) => setDraft({
                                                ...draft,
                                                quiz: { ...draft.quiz, question: v }
                                            })}
                                            placeholder="Are you enjoying the new service?"
                                            required={draft.collectResponses}
                                        />
                                        {draft.quiz?.type === 'MULTIPLE_CHOICE' && (
                                            <div className="quiz-options-editor" style={{ padding: 'var(--sp-2)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius)', gridColumn: 'span 2' }}>
                                                <h4>Options</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                                                    {(draft.quiz.options ?? []).map((opt, idx) => (
                                                        <div key={idx} style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
                                                            <TextField
                                                                label={`Option ${idx + 1}`}
                                                                value={opt.label}
                                                                onChange={(v) => {
                                                                    const newOptions = [...(draft.quiz?.options ?? [])];
                                                                    newOptions[idx] = { ...opt, label: v };
                                                                    setDraft({
                                                                        ...draft,
                                                                        quiz: { ...draft.quiz, options: newOptions }
                                                                    });
                                                                }}
                                                                required
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => {
                                                                    setDraft({
                                                                        ...draft,
                                                                        quiz: {
                                                                            ...draft.quiz,
                                                                            options: (draft.quiz?.options ?? []).filter((_, i) => i !== idx)
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            const newOptions = [...(draft.quiz?.options ?? []), { id: `opt-${Date.now()}`, label: 'New option' }];
                                                            setDraft({
                                                                ...draft,
                                                                quiz: { ...draft.quiz, options: newOptions }
                                                            });
                                                        }}
                                                    >
                                                        + Add Option
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {draft.quiz?.type === 'RATING' && (
                                            <div className="rating-config" style={{ gridColumn: 'span 2' }}>
                                                <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <TextField
                                                            label="Min Rating"
                                                            type="number"
                                                            value={String(draft.quiz.minRating ?? 1)}
                                                            onChange={(v) => setDraft({
                                                                ...draft,
                                                                quiz: { ...draft.quiz, minRating: v ? parseInt(v) : 1 }
                                                            })}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <TextField
                                                            label="Max Rating"
                                                            type="number"
                                                            value={String(draft.quiz.maxRating ?? 5)}
                                                            onChange={(v) => setDraft({
                                                                ...draft,
                                                                quiz: { ...draft.quiz, maxRating: v ? parseInt(v) : 5 }
                                                            })}
                                                        />
                                                    </div>
                                                </div>
                                                <p style={{ marginTop: 'var(--sp-1)', fontSize: '12px', color: 'var(--color-text-faint)' }}>
                                                    Configure the rating scale (e.g., 1-5 stars)
                                                </p>
                                            </div>
                                        )}
                                        {draft.quiz?.type === 'FREE_TEXT' && (
                                            <TextField
                                                label="Response Field Label"
                                                hint="Optional hint text for text input"
                                                full
                                                value={draft.quiz.options?.[0]?.label ?? 'Your answer'}
                                                onChange={(v) => setDraft({
                                                    ...draft,
                                                    quiz: {
                                                        ...draft.quiz,
                                                        options: [{ id: 'text', label: v || 'Your answer' }]
                                                    }
                                                })}
                                            />
                                        )}
                                        <CheckboxField
                                            label="Require response before dismiss"
                                            checked={draft.quiz?.requireResponse ?? false}
                                            onChange={(v) => setDraft({
                                                ...draft,
                                                quiz: { ...draft.quiz, requireResponse: v }
                                            })}
                                        />
                                        <TextField
                                            label="Response Timeout (seconds)"
                                            type="number"
                                            value={String(draft.quiz?.responseTimeoutSeconds ?? 60)}
                                            onChange={(v) => setDraft({
                                                ...draft,
                                                quiz: { ...draft.quiz, responseTimeoutSeconds: v ? parseInt(v) : 60 }
                                            })}
                                            hint="Auto-forward after this time"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-section">
                                <h3>Targeting</h3>
                                <div className="form-section__help">
                                    Leave fields blank to target the entire fleet.
                                </div>
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
                                        placeholder="12A, 12B, 14C"
                                    />
                                </div>
                            </div>

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
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={duplicate}
                                    >
                                        Duplicate
                                    </button>
                                </div>
                                <button type="submit" className="btn btn-primary">
                                    Send Notification
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
