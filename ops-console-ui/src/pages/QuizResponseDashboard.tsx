/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Quiz/Survey Response Dashboard — shows passenger responses to questions.
 *
 * Real-time analytics across notifications, with per-quiz breakdowns and
 * immediate visibility into passenger sentiment.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { SearchPieChart } from '../components/SearchPieChart';
import type { QuizResponse, QuizResponseSummary } from '../types';

export function QuizResponseDashboard() {

const ALL_SEATS = '__all__';

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function seatLabel(e: QuizResponse): string {
    if (e.seatNumber && e.seatNumber.length > 0) return e.seatNumber;
    if (e.deviceId && e.deviceId.length > 0) return `(unknown seat · ${e.deviceId})`;
    return '(unknown seat)';
}

function countPercent(total: number, count: number | undefined): string {
    if (total <= 0) return '—';
    const value = count ?? 0;
    const percent = Math.round((value / total) * 100);
    return `${value} (${percent}%)`;
}

function quizTypeLabel(type: string | undefined): string {
    switch (type) {
        case 'YES_NO': return 'Yes/No';
        case 'MULTIPLE_CHOICE': return 'Multiple Choice';
        case 'RATING': return 'Rating';
        case 'FREE_TEXT': return 'Free Text';
        default: return type || '';
    }
}

export function QuizResponseDashboard() {
    const [summary, setSummary] = useState<QuizResponseSummary[] | null>(null);
    const [responses, setResponses] = useState<QuizResponse[] | null>(null);
    const [seats, setSeats] = useState<string[]>([]);
    const [seatFilter, setSeatFilter] = useState<string>(ALL_SEATS);
    const [quizFilter, setQuizFilter] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const [summaryData, allResponses, seatList] = await Promise.all([
                api.getQuizResponseSummary(),
                api.listQuizResponses(),
                api.getQuizResponsesForSeat(':seats').catch(() => [] as QuizResponse[])
            ]);
            setSummary(summaryData);
            setResponses(allResponses);
            // Extract unique seat numbers
            const uniqueSeats = Array.from(new Set([
                ...seatList.map((r: any) => r.seatNumber),
                ...allResponses.map(r => r.seatNumber).filter(Boolean)
            ])).filter(Boolean) as string[];
            setSeats(uniqueSeats);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : String(e);
            setError(msg);
            setSummary([]);
            setResponses([]);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const id = setInterval(() => {
            if (autoRefresh) void refresh();
        }, 5_000);
        return () => clearInterval(id);
    }, [refresh, autoRefresh]);

    // Filter responses based on seat and quiz
    const filteredSummary = useMemo(() => {
        if (!summary) return null;
        const q = quizFilter.trim().toLowerCase();
        if (!q) return summary;
        return summary.filter(s =>
            s.notificationId.toLowerCase().includes(q) ||
            (s.notificationTitle?.toLowerCase() || '').includes(q) ||
            s.question.toLowerCase().includes(q)
        );
    }, [summary, quizFilter]);

    const filteredResponses = useMemo(() => {
        if (!responses) return null;
        let result = [...responses];
        if (seatFilter !== ALL_SEATS) {
            result = result.filter(r => seatLabel(r) === seatFilter || r.seatNumber === seatFilter);
        }
        if (quizFilter.trim()) {
            const q = quizFilter.trim().toLowerCase();
            result = result.filter(r =>
                r.notificationId.toLowerCase().includes(q)
            );
        }
        return result.sort((a, b) =>
            Date.parse(b.respondedAt) - Date.parse(a.respondedAt)
        );
    }, [responses, seatFilter, quizFilter]);

    // Build aggregated data for charts
    const aggregatedByQuiz: Record<string, number> = useMemo(() => {
        const counts: Record<string, number> = {};
        (filteredResponses ?? []).forEach(r => {
            counts[r.notificationId] = (counts[r.notificationId] || 0) + 1;
        });
        return counts;
    }, [filteredResponses]);

    const pieData = useMemo(() => {
        return Object.entries(aggregatedByQuiz)
            .map(([notificationId, count]) => {
                const summaryItem = summary?.find(s => s.notificationId === notificationId);
                return {
                    id: notificationId,
                    label: summaryItem?.notificationTitle || notificationId,
                    value: count,
                    question: summaryItem?.question || ''
                };
            })
            .filter(d => d.value > 0);
    }, [aggregatedByQuiz, summary]);

    const totalImpressions = summary?.reduce((sum, s) => sum + s.impressions, 0) ?? 0;
    const totalResponses = summary?.reduce((sum, s) => sum + s.responses, 0) ?? 0;
    const responseRate = totalImpressions > 0 ? Math.round((totalResponses / totalImpressions) * 100) : 0;

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>📊 Quiz / Survey Analytics</h2>
                    <div className="panel-header__sub">
                        Real-time passenger response dashboard. Track participation rates, sentiment, and per-seat engagement.
                    </div>
                </div>
                <div className="panel-actions">
                    <label style={{ marginRight: 'var(--sp-2)' }}>
                        <span style={{ marginRight: 6 }}>Auto-refresh:</span>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                    </label>
                    <button className="btn btn-ghost" onClick={refresh}>Refresh Now</button>
                </div>
            </div>

            {error ? (
                <ErrorState message={error} />
            ) : summary === null || responses === null ? (
                <LoadingState />
            ) : (
                <>
                    {/* Overview KPIs */}
                    <div className="config-grid">
                        <div className="config-card">
                            <h3>Overview</h3>
                            <p><strong>Total Impressions:</strong> {totalImpressions}</p>
                            <p><strong>Total Responses:</strong> {totalResponses}</p>
                            <p><strong>Response Rate:</strong> {responseRate}%</p>
                            <p><strong>Unique Participants:</strong> {seats.length}</p>
                        </div>
                        <div className="config-card">
                            <h3>Types</h3>
                            {summary.map(s => (
                                <p key={s.notificationId} style={{ margin: '2px 0' }}>
                                    <strong>{quizTypeLabel(s.quizType)}</strong>: {countPercent(totalResponses, s.responses)}<br/>
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}>{s.question}</span>
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Distribution charts */}
                    <div className="config-grid">
                        <div className="config-card">
                            <h3>Response Distribution</h3>
                            {pieData.length > 0 ? (
                                <SearchPieChart
                                    data={pieData.map(d => ({ label: d.id, value: d.value }))}
                                    title=""
                                    onSliceClick={(slice) => {
                                        const clickedQuiz = pieData[sliceindex];
                                        setQuizFilter(clickedQuiz.id);
                                    }}
                                />
                            ) : (
                                <EmptyState text="No response data available." />
                            )}
                        </div>
                        <div className="config-card">
                            <h3>Per-Quiz Metrics</h3>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="data-table compact">
                                    <thead>
                                        <tr>
                                            <th>Notification</th>
                                            <th>Type</th>
                                            <th>Impressions</th>
                                            <th>Responses</th>
                                            <th>Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary?.sort((a, b) => b.responses - a.responses).map((s, i) => {
                                            const rate = s.impressions > 0 ? Math.round((s.responses / s.impressions) * 100) : 0;
                                            return (
                                                <tr key={s.notificationId}>
                                                    <td>
                                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{s.notificationTitle}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>{s.question}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>{s.notificationId}</div>
                                                    </td>
                                                    <td><strong style={{ fontStyle: 'italic' }}>{quizTypeLabel(s.quizType)}</strong></td>
                                                    <td>{s.impressions} shown</td>
                                                    <td><strong>{s.responses}</strong> responses</td>
                                                    <td>
                                                        <strong style={{ color: rate > 50 ? 'var(--color-text-success)' : rate > 25 ? 'var(--color-text-warn)' : 'var(--color-text-danger)' }}>
                                                            {rate}%
                                                        </strong>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="config-card" style={{ marginTop: 'var(--sp-4)' }}>
                        <h3>Filter Responses</h3>
                        <div className="form-grid">
                            <label>
                                <span style={{ display: 'block', marginBottom: 'var(--sp-1)', fontWeight: 'bold' }}>Seat:</span>
                                <select
                                    className="input"
                                    value={seatFilter}
                                    onChange={(e) => setSeatFilter(e.target.value)}
                                >
                                    <option value={ALL_SEATS}>All seats ({seats.length})</option>
                                    {seats.map((s) => (
                                        <option key={s} value={s}>Seat {s}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span style={{ display: 'block', marginBottom: 'var(--sp-1)', fontWeight: 'bold' }}>Search:</span>
                                <input
                                    type="search"
                                    className="input"
                                    placeholder="Notification ID, title, question…"
                                    value={quizFilter}
                                    onChange={(e) => setQuizFilter(e.target.value)}
                                />
                                {quizFilter && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setQuizFilter('')}
                                        style={{ marginTop: 'var(--sp-1)' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Raw response table */}
                    <div className="config-card">
                        <h3>
                            Recent Responses
                            {seatFilter !== ALL_SEATS && (
                                <span className="badge" style={{ marginLeft: 'var(--sp-2)' }}>
                                    {seatFilter.startsWith('device:') ? `device ${seatFilter.substring('device:'.length)}` : `seat ${seatFilter}`}
                                </span>
                            )}
                        </h3>
                        {filteredResponses && filteredResponses.length > 0 ? (
                            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>When</th>
                                            <th>Seat</th>
                                            <th>Language</th>
                                            <th>Type</th>
                                            <th>Notification</th>
                                            <th>Question</th>
                                            <th>Answer</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResponses.map((r, i) => {
                                            const summaryItem = summary.find(s => s.notificationId === r.notificationId);
                                            const responseText = (
                                                r.optionId && (r.optionId === 'yes' || r.optionId === 'no')
                                                    ? r.optionId.equals('yes') ? '🟢 Yes' : '🔴 No'
                                                    : r.optionId
                                                        ? summaryItem?.optionLabels?.[r.optionId] || r.optionId
                                                    : r.optionIds
                                                        ? (r.optionIds.map(id => summaryItem?.optionLabels?.[id] || id).join(', ') || 'Multiple')
                                                    : r.rating
                                                        ? `⭐ ${r.rating}/5`
                                                    : r.freeText
                                                        ? `"${r.freeText}"`
                                                        : 'No response'
                                            );
                                            return (
                                                <tr key={r.id || `${r.notificationId}-${i}`}>
                                                    <td>{formatTime(r.respondedAt)}</td>
                                                    <td><code>{seatLabel(r)}</code></td>
                                                    <td>{r.language || ''}</td>
                                                    <td><strong style={{ fontStyle: 'italic' }}>{quizTypeLabel(summaryItem?.quizType)}</strong></td>
                                                    <td>
                                                        <div style={{ fontSize: '11px' }}>{summaryItem?.notificationTitle || r.notificationId}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>id: {r.notificationId}</div>
                                                    </td>
                                                    <td style={{ fontSize: '12px' }}>{summaryItem?.question || ''}</td>
                                                    <td>
                                                        <strong style={r.optionId === 'yes' || (r.rating && r.rating >= 4) ? { color: 'var(--color-text-success)' } : r.optionId === 'no' || (r.rating && r.rating <= 2) ? { color: 'var(--color-text-danger)' } : {}}>
                                                            {responseText}
                                                        </strong>
                                                    </td>
                                                    <td>{r.timeToRespondMs ? `${Math.floor(r.timeToRespondMs / 1000)}s` : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState text={quizFilter ? 'No matching responses found.' : 'No responses yet. Send quiz/survey notifications to passengers and their responses will appear here.'} />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}