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

    /** Max events retained per subtype — keeps memory bounded. */
    public static final int MAX_RECENT_PER_SUBTYPE = 100;

    private final ConcurrentHashMap<String, SubtypeStats> bySubtype = new ConcurrentHashMap<>();

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

    /** Lightweight DTO returned by the /api/v1/search/events endpoint. */
    public record SubtypeSummary(
            String subtype,
            int queries,
            int zeroResults,
            int totalResults,
            List<SearchAnalyticsEvent> recent
    ) {}
}
