package aero.panasonic.ek.ops.store;

import aero.panasonic.ek.ops.model.SearchAnalyticsEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory store for search analytics events posted by the seatback.
 *
 * Data is intentionally per-subtype so the dashboard can render
 * per-subtype cards (AUDIO, VIDEO, MOVIE, TV, GAME) without scanning
 * a flat log. Counts and zero-result tallies are aggregated on read;
 * the raw event ring buffer keeps the most recent N events per
 * subtype so "recent queries" lists stay bounded.
 *
 * A secondary per-seat index tracks events whose seat number is known
 * so the dashboard can answer "what did seat 12A search for?" without
 * scanning every event.
 *
 * Thread-safe via ConcurrentHashMap.
 */
@Component
public class SearchAnalyticsStore {

    /** Per-subtype state — both counters and a ring of recent events. */
    public static class SubtypeStats {
        public final AtomicInteger queries = new AtomicInteger();
        public final AtomicInteger zeroResults = new AtomicInteger();
        public final AtomicInteger totalResults = new AtomicInteger();
        public final List<SearchAnalyticsEvent> recent = new ArrayList<>();
    }

    /** Per-seat state — ring buffer of recent events for one seat across all subtypes. */
    public static class SeatStats {
        public final List<SearchAnalyticsEvent> recent = new ArrayList<>();
    }

    /** Max events retained per subtype — keeps memory bounded. */
    public static final int MAX_RECENT_PER_SUBTYPE = 100;

    /** Max events retained per seat — keeps the per-seat memory bounded. */
    public static final int MAX_RECENT_PER_SEAT = 50;

    private final ConcurrentHashMap<String, SubtypeStats> bySubtype = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, SeatStats> bySeat = new ConcurrentHashMap<>();

    public void record(SearchAnalyticsEvent event) {
        if (event == null || event.subtype() == null || event.subtype().isBlank()) {
            return;
        }
        SubtypeStats stats = bySubtype.computeIfAbsent(event.subtype().toUpperCase(), k -> new SubtypeStats());
        stats.queries.incrementAndGet();
        if (event.resultCount() <= 0) {
            stats.zeroResults.incrementAndGet();
        } else {
            stats.totalResults.addAndGet(event.resultCount());
        }
        synchronized (stats.recent) {
            stats.recent.add(event);
            // Trim to most recent N
            if (stats.recent.size() > MAX_RECENT_PER_SUBTYPE) {
                int excess = stats.recent.size() - MAX_RECENT_PER_SUBTYPE;
                stats.recent.subList(0, excess).clear();
            }
        }

        // Per-seat index — keyed on seat number when known, else on
        // deviceId so the dashboard can still attribute events to a
        // specific seatback even before its seat number is loaded.
        String seatKey = (event.seatNumber() != null && !event.seatNumber().isBlank())
                ? event.seatNumber()
                : (event.deviceId() != null && !event.deviceId().isBlank() ? "device:" + event.deviceId() : null);
        if (seatKey != null) {
            SeatStats seat = bySeat.computeIfAbsent(seatKey, k -> new SeatStats());
            synchronized (seat.recent) {
                seat.recent.add(event);
                if (seat.recent.size() > MAX_RECENT_PER_SEAT) {
                    int excess = seat.recent.size() - MAX_RECENT_PER_SEAT;
                    seat.recent.subList(0, excess).clear();
                }
            }
        }
    }

    public Map<String, SubtypeStats> snapshot() {
        return bySubtype;
    }

    /** Aggregated view used by the dashboard card. */
    public List<SubtypeSummary> summary() {
        List<SubtypeSummary> out = new ArrayList<>();
        for (Map.Entry<String, SubtypeStats> e : bySubtype.entrySet()) {
            SubtypeStats s = e.getValue();
            out.add(new SubtypeSummary(
                    e.getKey(),
                    s.queries.get(),
                    s.zeroResults.get(),
                    s.totalResults.get(),
                    recentForSubtype(e.getKey())
            ));
        }
        out.sort(Comparator.comparing(SubtypeSummary::subtype));
        return out;
    }

    /** Returns a snapshot of recent events for a subtype (immutable copy). */
    public List<SearchAnalyticsEvent> recentForSubtype(String subtype) {
        SubtypeStats stats = bySubtype.get(subtype == null ? "" : subtype.toUpperCase());
        if (stats == null) return List.of();
        synchronized (stats.recent) {
            // Return the most recent first, capped
            List<SearchAnalyticsEvent> copy = new ArrayList<>(stats.recent);
            copy.sort(Comparator.comparing(SearchAnalyticsEvent::occurredAt).reversed());
            if (copy.size() > MAX_RECENT_PER_SUBTYPE) {
                return List.copyOf(copy.subList(0, MAX_RECENT_PER_SUBTYPE));
            }
            return List.copyOf(copy);
        }
    }

    /**
     * Returns the recent queries for a specific seat, most-recent-first.
     * Empty list if the seat has no recorded events (or if the seat
     * number is unknown to the seatback — see {@link #recentForDevice}).
     */
    public List<SearchAnalyticsEvent> recentForSeat(String seatNumber) {
        if (seatNumber == null || seatNumber.isBlank()) return List.of();
        SeatStats stats = bySeat.get(seatNumber);
        if (stats == null) return List.of();
        synchronized (stats.recent) {
            List<SearchAnalyticsEvent> copy = new ArrayList<>(stats.recent);
            copy.sort(Comparator.comparing(SearchAnalyticsEvent::occurredAt).reversed());
            return List.copyOf(copy);
        }
    }

    /**
     * Returns the recent queries for a seatback deviceId, used when the
     * seat number hasn't loaded yet. Caller supplies the raw deviceId;
     * the implementation looks it up under the "device:" prefix.
     */
    public List<SearchAnalyticsEvent> recentForDevice(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) return List.of();
        return recentForSeat("device:" + deviceId);
    }

    /** All known seat keys (raw seat numbers and "device:..." placeholders). */
    public List<String> knownSeats() {
        List<String> out = new ArrayList<>(bySeat.keySet());
        out.sort(Comparator.naturalOrder());
        return out;
    }

    /** Lightweight DTO returned by the /api/v1/search/events endpoint. */
    public record SubtypeSummary(
            String subtype,
            int queries,
            int zeroResults,
            int totalResults,
            List<SearchAnalyticsEvent> recent
    ) {}
}
