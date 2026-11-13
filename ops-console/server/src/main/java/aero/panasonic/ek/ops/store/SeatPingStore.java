package aero.panasonic.ek.ops.store;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * In-memory store for tracking seat connections to the webtool.
 *
 * Seats "ping" the webtool when they:
 * - Fetch the operations bundle (/api/v1/config/bundle)
 * - Report menu state (/api/v1/config/menu-state)
 * - Post search analytics (/api/v1/search/events)
 * - Report APK update status
 *
 * Each ping updates the seat's lastSeen timestamp and metadata.
 * Thread-safe via {@link ConcurrentHashMap}.
 */
@Component
public class SeatPingStore {

    /** Per-seat tracking data */
    public record SeatInfo(
            String deviceId,
            String seatNumber,
            String airlineCode,
            String appVersion,
            String firstSeen,
            String lastSeen,
            String audience,
            String language
    ) {}

    /** Minimal ping payload from seat */
    public record SeatPing(
            String deviceId,
            String seatNumber,
            String airlineCode,
            String appVersion,
            String audience,
            String language
    ) {}

    /** Response when a seat pings */
    public record PingResponse(
            boolean ok,
            int totalSeats,
            String message
    ) {}

    /** Seat data for UI dashboard */
    public record SeatDashboardRow(
            String deviceId,
            String seatNumber,
            String airlineCode,
            String appVersion,
            String audience,
            String language,
            long firstSeenMs,
            String firstSeenFormatted,
            long lastSeenMs,
            String lastSeenFormatted,
            String timeAgo,
            /** Number of pings received from this seat (cumulative, capped at max). */
            int pingCount
    ) {}

    /** A single ping event for the recent pings log */
    public record PingEvent(
            String deviceId,
            String seatNumber,
            long timestampMs,
            String timestamp,
            String timeAgo
    ) {}

    private final ConcurrentMap<String, SeatRecord> seats = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Integer> pingCounts = new ConcurrentHashMap<>();
    private final List<PingEvent> recentPings = new ArrayList<>();
    private final Object recentPingsLock = new Object();
    private static final int MAX_RECENT_PINGS = 100;

    /** Store a seat ping, updating if exists */
    public void ping(SeatPing ping) {
        if (ping == null || ping.deviceId() == null || ping.deviceId().isBlank()) {
            return;
        }

        Instant now = Instant.now();
        String nowIso = now.toString();

        seats.compute(ping.deviceId(), (key, existing) -> {
            if (existing == null) {
                return new SeatRecord(
                        ping.deviceId(),
                        ping.seatNumber(),
                        ping.airlineCode(),
                        ping.appVersion(),
                        nowIso,  // firstSeen
                        nowIso,  // lastSeen
                        ping.audience(),
                        ping.language()
                );
            } else {
                return new SeatRecord(
                        ping.deviceId(),
                        ping.seatNumber() != null && !ping.seatNumber().isBlank() ? ping.seatNumber() : existing.seatNumber,
                        ping.airlineCode() != null && !ping.airlineCode().isBlank() ? ping.airlineCode() : existing.airlineCode,
                        ping.appVersion() != null && !ping.appVersion().isBlank() ? ping.appVersion() : existing.appVersion,
                        existing.firstSeen,  // preserve firstSeen
                        nowIso,  // update lastSeen
                        ping.audience() != null && !ping.audience().isBlank() ? ping.audience() : existing.audience,
                        ping.language() != null && !ping.language().isBlank() ? ping.language() : existing.language
                );
            }
        });

        // Bump ping counter (capped)
        pingCounts.merge(ping.deviceId(), 1, (a, b) -> a + b);

        // Record this individual ping event for the recent-pings feed
        SeatRecord r = seats.get(ping.deviceId());
        String seatNumber = (ping.seatNumber() != null && !ping.seatNumber().isBlank())
                ? ping.seatNumber()
                : (r != null && r.seatNumber != null ? r.seatNumber : "-");
        synchronized (recentPingsLock) {
            recentPings.add(0, new PingEvent(
                    ping.deviceId(),
                    seatNumber,
                    now.toEpochMilli(),
                    nowIso,
                    formatTimeAgo(now)
            ));
            if (recentPings.size() > MAX_RECENT_PINGS) {
                recentPings.subList(MAX_RECENT_PINGS, recentPings.size()).clear();
            }
        }
    }

    /** Get all seats sorted by last seen (most recent first) */
    public List<SeatDashboardRow> getAllSeats() {
        Instant now = Instant.now();
        return seats.values().stream()
                .sorted(Comparator.comparing((SeatRecord r) -> parseTimestamp(r.lastSeen)).reversed())
                .map(r -> {
                    long lastSeenMs = parseTimestamp(r.lastSeen);
                    long firstSeenMs = parseTimestamp(r.firstSeen);
                    Instant lastSeenInstant = Instant.ofEpochMilli(lastSeenMs);

                    int pingCount = pingCounts.getOrDefault(r.deviceId, 0);

                    return new SeatDashboardRow(
                            r.deviceId,
                            r.seatNumber != null ? r.seatNumber : "-",
                            r.airlineCode != null ? r.airlineCode : "-",
                            r.appVersion != null ? r.appVersion : "-",
                            r.audience != null ? r.audience : "-",
                            r.language != null ? r.language : "-",
                            firstSeenMs,
                            formatTime(firstSeenMs),
                            lastSeenMs,
                            formatTime(lastSeenMs),
                            formatTimeAgo(lastSeenInstant),
                            pingCount
                    );
                })
                .toList();
    }

    /** Get the recent ping events feed (most recent first) */
    public List<PingEvent> getRecentPings() {
        synchronized (recentPingsLock) {
            return new ArrayList<>(recentPings);
        }
    }

    /** Get count of known seats */
    public int getSeatCount() {
        return seats.size();
    }

    /** Get seat by deviceId */
    public Optional<SeatInfo> getSeat(String deviceId) {
        return Optional.ofNullable(seats.get(deviceId)).map(r -> new SeatInfo(
                r.deviceId,
                r.seatNumber,
                r.airlineCode,
                r.appVersion,
                r.firstSeen,
                r.lastSeen,
                r.audience,
                r.language
        ));
    }

    /** Clear all seat data */
    public void clear() {
        seats.clear();
        pingCounts.clear();
        synchronized (recentPingsLock) {
            recentPings.clear();
        }
    }

    private long parseTimestamp(String iso) {
        if (iso == null || iso.isBlank()) return 0;
        try {
            return Instant.parse(iso).toEpochMilli();
        } catch (Exception e) {
            return 0;
        }
    }

    private String formatTime(long epochMs) {
        if (epochMs <= 0) return "-";
        try {
            return java.time.Instant.ofEpochMilli(epochMs)
                    .atZone(java.time.ZoneId.systemDefault())
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception e) {
            return "-";
        }
    }

    private String formatTimeAgo(Instant instant) {
        if (instant == null) return "-";
        try {
            java.time.Duration diff = java.time.Duration.between(instant, Instant.now());
            long seconds = diff.getSeconds();
            if (seconds < 60) return seconds + "s ago";
            long minutes = seconds / 60;
            if (minutes < 60) return minutes + "m ago";
            long hours = minutes / 60;
            if (hours < 24) return hours + "h ago";
            long days = hours / 24;
            return days + "d ago";
        } catch (Exception e) {
            return "-";
        }
    }

    private record SeatRecord(
            String deviceId,
            String seatNumber,
            String airlineCode,
            String appVersion,
            String firstSeen,
            String lastSeen,
            String audience,
            String language
    ) {}
}