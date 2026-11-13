package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.SearchAnalyticsEvent;
import aero.panasonic.ek.ops.store.SearchAnalyticsStore;
import aero.panasonic.ek.ops.web.SeatPingController;
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
 *   POST /api/v1/search/events                       Seatback posts a typed query event
 *   GET  /api/v1/search/events/summary               Dashboard reads aggregated stats
 *   GET  /api/v1/search/events/recent                Dashboard reads recent events (per subtype)
 *   GET  /api/v1/search/events/seats                 Dashboard reads the set of known seat keys
 *   GET  /api/v1/search/events/seats/{seat}          Dashboard reads recent events for one seat
 *   GET  /api/v1/search/events/devices/{deviceId}    Dashboard reads recent events for one device
 *
 * The store is in-memory; data resets when the backend restarts.
 */
@RestController
@RequestMapping("/api/v1/search")
public class SearchAnalyticsController {

    private final SearchAnalyticsStore store;
    private final SeatPingController seatPingController;

    public SearchAnalyticsController(SearchAnalyticsStore store, SeatPingController seatPingController) {
        this.store = store;
        this.seatPingController = seatPingController;
    }

    @PostMapping("/events")
    public Map<String, Object> record(@Valid @RequestBody SearchAnalyticsEvent event) {
        // Stamp occurredAt server-side if the client didn't supply it.
        SearchAnalyticsEvent stamped = (event.occurredAt() == null || event.occurredAt().isBlank())
                ? new SearchAnalyticsEvent(
                    event.subtype(), event.query(), event.resultCount(),
                    Instant.now().toString(),
                    event.seatNumber(), event.language(), event.audience(), event.deviceId())
                : event;
        store.record(stamped);
        // Also record this as a seat ping
        seatPingController.recordPingFromSearchEvent(stamped);
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

    @GetMapping("/events/seats")
    public List<String> seats() {
        return store.knownSeats();
    }

    @GetMapping("/events/seats/{seat}")
    public List<SearchAnalyticsEvent> recentForSeat(@org.springframework.web.bind.annotation.PathVariable("seat") String seat) {
        return store.recentForSeat(seat);
    }

    @GetMapping("/events/devices/{deviceId}")
    public List<SearchAnalyticsEvent> recentForDevice(@org.springframework.web.bind.annotation.PathVariable("deviceId") String deviceId) {
        return store.recentForDevice(deviceId);
    }
}
