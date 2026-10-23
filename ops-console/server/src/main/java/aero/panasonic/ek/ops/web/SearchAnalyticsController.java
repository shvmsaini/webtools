package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.SearchAnalyticsEvent;
import aero.panasonic.ek.ops.store.SearchAnalyticsStore;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * REST endpoints for search analytics.
 *
 *   POST /api/v1/search/events         Seatback posts a typed query event
 *   GET  /api/v1/search/events/summary Dashboard reads aggregated stats
 *   GET  /api/v1/search/events/recent  Dashboard reads recent events (per subtype)
 *
 * The store is in-memory; data resets when the backend restarts.
 */
@RestController
@RequestMapping("/api/v1/search")
public class SearchAnalyticsController {

    private final SearchAnalyticsStore store;

    public SearchAnalyticsController(SearchAnalyticsStore store) {
        this.store = store;
    }

    @PostMapping("/events")
    public Map<String, Object> record(@Valid @RequestBody SearchAnalyticsEvent event) {
        // Stamp occurredAt server-side if the client didn't supply it.
        SearchAnalyticsEvent stamped = (event.occurredAt() == null || event.occurredAt().isBlank())
                ? new SearchAnalyticsEvent(event.subtype(), event.query(), event.resultCount(), Instant.now().toString())
                : event;
        store.record(stamped);
        return Map.of("ok", true);
    }

    @GetMapping("/events/summary")
    public List<SearchAnalyticsStore.SubtypeSummary> summary() {
        return store.summary();
    }

    @GetMapping("/events/recent")
    public Map<String, List<SearchAnalyticsEvent>> recent() {
        Map<String, List<SearchAnalyticsEvent>> out = new java.util.LinkedHashMap<>();
        for (SearchAnalyticsStore.SubtypeSummary s : store.summary()) {
            out.put(s.subtype(), s.recent());
        }
        return out;
    }
}
