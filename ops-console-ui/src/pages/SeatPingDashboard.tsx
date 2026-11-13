/*
 * Copyright (c) 2024 Panasonic Avionics
 *
 * Seat Ping Dashboard — Shows all seats that have pinged the webtool.
 *
 * Seats ping when they:
 * - Fetch the operations bundle
 * - Report menu state
 * - Post search analytics
 * - Report APK update status
 *
 * The dashboard shows seat number, device ID, app version, when they
 * first/last connected, and the "last ping" timestamp with relative
 * time for quick visibility. A "Recent Pings" feed shows the most
 * recent ping events across all seats.
 */

import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { EmptyState, ErrorState, LoadingState } from '../components/ListColumn';
import type { PingEvent, SeatPing } from '../types';

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function TimeAgo({ timestamp }: { timestamp: number | null | undefined }) {
    if (!timestamp) return <span>-</span>;

    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return <span className="text-muted">{seconds}s ago</span>;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return <span className="text-muted">{minutes}m ago</span>;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return <span className="text-muted">{hours}h ago</span>;
    const days = Math.floor(hours / 24);
    return <span className="text-muted">{days}d ago</span>;
}

export function SeatPingDashboard() {
    const [seats, setSeats] = useState<SeatPing[]>([]);
    const [recentPings, setRecentPings] = useState<PingEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const refresh = async () => {
        setError(null);
        try {
            const [seatsData, pingsData] = await Promise.all([
                api.listSeats(),
                api.getRecentPings(),
            ]);
            setSeats(seatsData);
            setRecentPings(pingsData);
            setLastUpdate(new Date());
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : String(e);
            setError(msg);
            setSeats([]);
            setRecentPings([]);
        }
    };

    useEffect(() => {
        void refresh();
        const id = setInterval(refresh, 5_000);
        return () => clearInterval(id);
    }, []);

    const handleClear = async () => {
        if (!confirm('Clear all seat tracking data? This cannot be undone.')) return;
        try {
            await api.clearSeats();
            await refresh();
        } catch (e) {
            alert('Failed to clear: ' + String(e));
        }
    };

    const totalSeats = seats.length;
    const activeInLastMinute = seats.filter(s => (Date.now() - (s.lastSeenMs ?? 0)) < 60000).length;
    const activeInLastHour = seats.filter(s => (Date.now() - (s.lastSeenMs ?? 0)) < 3600000).length;
    const lastPingOverall = seats.length > 0 ? Math.max(...seats.map(s => s.lastSeenMs ?? 0)) : 0;

    return (
        <section className="tab-panel active">
            <div className="panel-header">
                <div>
                    <h2>Seat Ping Dashboard</h2>
                    <div className="panel-header__sub">
                        Live view of all seats that have connected to the webtool.
                        Seats ping on bundle fetch, menu reports, and analytics events.
                    </div>
                </div>
                <div className="panel-actions">
                    <span className="text-muted" style={{ marginRight: 'var(--sp-2)' }}>
                        Updated: {lastUpdate?.toLocaleTimeString() ?? '-'}
                    </span>
                    <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
                    <button className="btn btn-danger" onClick={handleClear} style={{ marginLeft: 'var(--sp-2)' }}>Clear All</button>
                </div>
            </div>

            {error ? (
                <ErrorState message={error} />
            ) : seats === null ? (
                <LoadingState />
            ) : (
                <>
                    {/* Summary stats */}
                    <div className="config-grid" style={{ marginBottom: 'var(--sp-4)' }}>
                        <div className="config-card">
                            <h3>Total Seats</h3>
                            <p className="stat stat--large">{totalSeats}</p>
                        </div>
                        <div className="config-card">
                            <h3>Active (Last Minute)</h3>
                            <p className="stat stat--large stat--success">{activeInLastMinute}</p>
                        </div>
                        <div className="config-card">
                            <h3>Active (Last Hour)</h3>
                            <p className="stat stat--large stat--info">{activeInLastHour}</p>
                        </div>
                        <div className="config-card">
                            <h3>Inactive</h3>
                            <p className="stat stat--large stat--warn">{totalSeats - activeInLastHour}</p>
                        </div>
                        <div className="config-card">
                            <h3>Last Ping (Fleet-wide)</h3>
                            <p className="stat stat--large">
                                {lastPingOverall > 0
                                    ? <TimeAgo timestamp={lastPingOverall} />
                                    : <span className="text-muted">-</span>}
                            </p>
                            {lastPingOverall > 0 && (
                                <p className="text-faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-1)' }}>
                                    {formatTime(new Date(lastPingOverall).toISOString())}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Seat table */}
                    <div className="config-card">
                        <h3>Connected Seats</h3>
                        {seats.length === 0 ? (
                            <EmptyState text="No seats have pinged yet. Seats will appear here when they connect." />
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Seat</th>
                                            <th>Device ID</th>
                                            <th>Airline</th>
                                            <th>App Version</th>
                                            <th>Audience</th>
                                            <th>Language</th>
                                            <th>First Seen</th>
                                            <th>Last Ping</th>
                                            <th>Last Ping (Relative)</th>
                                            <th>Ping Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {seats.map((seat) => {
                                            const secondsSince = (Date.now() - (seat.lastSeenMs ?? 0)) / 1000;
                                            const isRecent = secondsSince < 60;
                                            const isStale = secondsSince >= 3600;
                                            const rowClass = isRecent ? 'row-success' : (isStale ? 'row-warn' : '');
                                            return (
                                                <tr key={seat.deviceId} className={rowClass}>
                                                    <td>
                                                        <strong>
                                                            {seat.seatNumber && seat.seatNumber !== '-'
                                                                ? seat.seatNumber
                                                                : <span className="text-muted">-</span>}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <code>{seat.deviceId}</code>
                                                    </td>
                                                    <td>{seat.airlineCode || '-'}</td>
                                                    <td>
                                                        <code>{seat.appVersion || '-'}</code>
                                                    </td>
                                                    <td>{seat.audience || '-'}</td>
                                                    <td>{seat.language || '-'}</td>
                                                    <td>
                                                        <span className="text-muted" title={seat.firstSeenFormatted}>
                                                            {formatTime(seat.firstSeenFormatted)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <strong title={seat.lastSeenFormatted}>
                                                            {formatTime(seat.lastSeenFormatted)}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <TimeAgo timestamp={seat.lastSeenMs} />
                                                    </td>
                                                    <td>
                                                        <span className="badge badge--ok">{seat.pingCount ?? 0}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Recent pings feed */}
                    <div className="config-card">
                        <h3>Recent Pings</h3>
                        {recentPings.length === 0 ? (
                            <EmptyState text="No pings yet. Every seat ping will appear here in real time." />
                        ) : (
                            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>When</th>
                                            <th>Time Ago</th>
                                            <th>Seat</th>
                                            <th>Device ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentPings.map((ping, i) => {
                                            const secondsSince = (Date.now() - (ping.timestampMs ?? 0)) / 1000;
                                            const isRecent = secondsSince < 60;
                                            return (
                                                <tr key={`${ping.deviceId}-${ping.timestampMs}-${i}`} className={isRecent ? 'row-success' : ''}>
                                                    <td>
                                                        <strong>{formatTime(ping.timestamp)}</strong>
                                                    </td>
                                                    <td>
                                                        <TimeAgo timestamp={ping.timestampMs} />
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {ping.seatNumber && ping.seatNumber !== '-'
                                                                ? ping.seatNumber
                                                                : <span className="text-muted">-</span>}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <code>{ping.deviceId}</code>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
