/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Search dashboard — surfaces the search analytics the seatback
 * SearchAnalyticsBridge posts to /api/v1/search/events.
 *
 * Per-subtype cards show query counts, zero-result tallies, and total
 * results returned. A "Recent Queries" list at the bottom shows the
 * actual text passengers typed, with zero-result entries highlighted
 * so the operator can spot content gaps at a glance.
 *
 * Each row carries the seat number (or deviceId fallback) so operators
 * can answer "what did seat 12A search for?". A seat-filter dropdown
 * narrows the recent list to one passenger for quick triage.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import { SearchPieChart } from '../components/SearchPieChart';
import type { SearchEvent, SearchSubtypeSummary } from '../types';

const SUBTYPES = ['AUDIO', 'VIDEO', 'MOVIE', 'TV', 'GAME'];
const ALL_SEATS = '__all__';

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function seatLabel(e: SearchEvent): string {
    if (e.seatNumber && e.seatNumber.length > 0) return e.seatNumber;
    if (e.deviceId && e.deviceId.length > 0) return `(unknown seat · ${e.deviceId})`;
    return '(unknown seat)';
}

export function SearchDashboard() {
    const [summary, setSummary] = useState<SearchSubtypeSummary[] | null>(null);
    const [seats, setSeats] = useState<string[]>([]);
    const [seatFilter, setSeatFilter] = useState<string>(ALL_SEATS);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const [data, seatList] = await Promise.all([
                api.getSearchSummary(),
                api.getSearchSeats().catch(() => [] as string[]),
            ]);
            setSummary(data);
            setSeats(seatList);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : String(e);
            setError(msg);
            setSummary([]);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const id = setInterval(refresh, 5_000);
        return () => clearInterval(id);
    }, [refresh]);

    // When the operator picks a seat, fetch its per-seat history and
    // replace the fleet-wide recent list with just those events. This
    // is what makes "show me seat 12A" actually do something useful.
    const [seatEvents, setSeatEvents] = useState<SearchEvent[] | null>(null);
    useEffect(() => {
        if (seatFilter === ALL_SEATS) {
            setSeatEvents(null);
            return;
        }
        let cancelled = false;
        const fetcher = seatFilter.startsWith('device:')
            ? api.getSearchEventsForDevice(seatFilter.substring('device:'.length))
            : api.getSearchEventsForSeat(seatFilter);
        fetcher
            .then((events) => {
                if (!cancelled) setSeatEvents(events);
            })
            .catch(() => {
                if (!cancelled) setSeatEvents([]);
            });
        const id = setInterval(() => {
            fetcher
                .then((events) => {
                    if (!cancelled) setSeatEvents(events);
                })
                .catch(() => {
                    if (!cancelled) setSeatEvents([]);
                });
        }, 5_000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [seatFilter]);

    // Build a card for every known subtype, even if no events yet, so
    // the layout doesn't jump around when traffic starts flowing.
    const cards = SUBTYPES.map((subtype) => {
        const found = summary?.find((s) => s.subtype === subtype);
        return {
            subtype,
            queries: found?.queries ?? 0,
            zeroResults: found?.zeroResults ?? 0,
            totalResults: found?.totalResults ?? 0,
            recent: found?.recent ?? [],
        };
    });

    // Flatten all recent events across subtypes for the "Recent Queries" list.
    // Use optional chaining + null guards throughout — the backend can
    // return empty/null fields and we don't want to crash on missing data.
    const allRecent: SearchEvent[] = (summary ?? [])
        .flatMap((s) =>
            (s.recent ?? []).map((e) => ({
                ...e,
                // Inject subtype from the parent summary if missing on the event
                subtype: e?.subtype ?? s.subtype,
            }))
        )
        .filter((e) => e && typeof e === 'object' && (e.query ?? '').length > 0);

    // When a seat filter is active, prefer the per-seat history (more
    // complete — pulls from the seat's own ring buffer rather than
    // scanning recent subtype events). Fall back to filtering the fleet
    // recent list by seat if the per-seat endpoint returns nothing.
    const filteredRecent: SearchEvent[] = seatFilter === ALL_SEATS
        ? allRecent
        : (seatEvents && seatEvents.length > 0)
            ? seatEvents
            : allRecent.filter((e) => seatLabel(e).startsWith(seatFilter));

    const sortedRecent = filteredRecent
        .sort((a, b) => {
            const ta = a.occurredAt ? Date.parse(a.occurredAt) : 0;
            const tb = b.occurredAt ? Date.parse(b.occurredAt) : 0;
            return tb - ta;
        })
        .slice(0, 100);

    const hasAnyActivity = cards.some((c) => c.queries > 0);

    // Build data for the pie chart: total results per subtype
    const pieChartData = useMemo(
        () =>
            cards
                .filter((c) => c.totalResults > 0)
                .map((c) => ({
                    label: c.subtype,
                    value: c.totalResults,
                })),
        [cards]
    );

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>Search Dashboard</h2>
                    <div className="panel-header__sub">
                        Live view of queries typed by passengers across the fleet.
                        Zero-result queries are highlighted.
                    </div>
                </div>
                <div className="panel-actions">
                    <label style={{ marginRight: 'var(--sp-2)' }}>
                        <span style={{ marginRight: 6 }}>Seat:</span>
                        <select
                            className="input"
                            value={seatFilter}
                            onChange={(e) => setSeatFilter(e.target.value)}
                        >
                            <option value={ALL_SEATS}>All seats ({seats.length})</option>
                            {seats.map((s) => (
                                <option key={s} value={s}>
                                    {s.startsWith('device:') ? `device ${s.substring('device:'.length)}` : s}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                </div>
            </div>
            {error ? (
                <ErrorState message={error} />
            ) : summary === null ? (
                <LoadingState />
            ) : (
                <>
                    {/* Pie chart showing result distribution by subtype */}
                    <SearchPieChart
                        data={pieChartData}
                        title="Result Distribution by Category"
                    />

                    {/* Grid of cards for each subtype */}
                    <div className="config-grid">
                        {cards.map((c) => (
                            <div className="config-card" key={c.subtype}>
                                <h3>{c.subtype}</h3>
                                <p>Queries: <strong>{c.queries}</strong></p>
                                <p>
                                    Zero-Result Events:{' '}
                                    <strong className={c.zeroResults > 0 ? 'badge--warn' : ''}>
                                        {c.zeroResults}
                                    </strong>
                                </p>
                                <p>Total Results Returned: <strong>{c.totalResults}</strong></p>
                            </div>
                        ))}
                    </div>

                    <div className="config-card" style={{ marginTop: 'var(--sp-4)' }}>
                        <h3>
                            Recent Queries
                            {seatFilter !== ALL_SEATS && (
                                <span className="badge" style={{ marginLeft: 'var(--sp-2)' }}>
                                    {seatFilter.startsWith('device:') ? `device ${seatFilter.substring('device:'.length)}` : `seat ${seatFilter}`}
                                </span>
                            )}
                        </h3>
                        {!hasAnyActivity ? (
                            <EmptyState text="No queries yet. Run a search on the seatback to populate this list." />
                        ) : sortedRecent.length === 0 ? (
                            <EmptyState text="No query text available." />
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Subtype</th>
                                        <th>Seat</th>
                                        <th>Language</th>
                                        <th>Cabin</th>
                                        <th>Query</th>
                                        <th>Results</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRecent.map((e, i) => {
                                        const isZero = (e.resultCount ?? 0) <= 0;
                                        return (
                                            <tr
                                                key={`${e.occurredAt}-${i}`}
                                                className={isZero ? 'row-warn' : ''}
                                            >
                                                <td>{formatTime(e.occurredAt)}</td>
                                                <td>{e.subtype ?? ''}</td>
                                                <td>
                                                    <code>{seatLabel(e)}</code>
                                                </td>
                                                <td>{e.language ?? ''}</td>
                                                <td>{e.audience ?? ''}</td>
                                                <td>
                                                    <code>{e.query ?? ''}</code>
                                                </td>
                                                <td>
                                                    <strong className={isZero ? 'badge--warn' : ''}>
                                                        {e.resultCount ?? 0}
                                                    </strong>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
