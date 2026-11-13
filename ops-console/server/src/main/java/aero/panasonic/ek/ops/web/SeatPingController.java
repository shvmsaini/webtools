package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels;
import aero.panasonic.ek.ops.model.SearchAnalyticsEvent;
import aero.panasonic.ek.ops.store.SeatPingStore;
import aero.panasonic.ek.ops.store.SearchAnalyticsStore;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for seat connection tracking (pings).
 *
 * The seatback pings the webtool when:
 * - Fetching the operations bundle
 * - Reporting menu state
 * - Posting analytics events
 *
 * This gives operators visibility into which seats are online
 * and when they last communicated with the server.
 */
@RestController
@RequestMapping("/api/v1/seats")
public class SeatPingController {

    private final SeatPingStore seatPingStore;
    private final SearchAnalyticsStore searchAnalyticsStore;

    public SeatPingController(SeatPingStore seatPingStore, SearchAnalyticsStore searchAnalyticsStore) {
        this.seatPingStore = seatPingStore;
        this.searchAnalyticsStore = searchAnalyticsStore;
    }

    /**
     * Record a seat ping. The seatback calls this when it comes online
     * or refreshes its connection.
     */
    @PostMapping("/ping")
    public Map<String, Object> ping(@Valid @RequestBody SeatPingStore.SeatPing ping) {
        seatPingStore.ping(ping);
        return Map.of(
                "ok", true,
                "totalSeats", seatPingStore.getSeatCount(),
                "message", "Ping recorded for " + ping.deviceId()
        );
    }

    /**
     * List all seats that have pinged, sorted by most recent activity.
     */
    @GetMapping
    public List<SeatPingStore.SeatDashboardRow> listSeats() {
        return seatPingStore.getAllSeats();
    }

    /**
     * Get count of known seats.
     */
    @GetMapping("/count")
    public Map<String, Object> count() {
        return Map.of(
                "count", seatPingStore.getSeatCount(),
                "searchAnalyticsSeats", searchAnalyticsStore.knownSeats().size()
        );
    }

    /**
     * Clear all seat tracking data.
     */
    @PostMapping("/clear")
    public Map<String, Object> clear() {
        seatPingStore.clear();
        return Map.of("ok", true, "message", "All seat tracking data cleared");
    }

    /**
     * Bridge: Also record a ping when seats post search events.
     * This is called from SearchAnalyticsController.
     */
    void recordPingFromSearchEvent(SearchAnalyticsEvent event) {
        if (event == null) return;
        seatPingStore.ping(new SeatPingStore.SeatPing(
                event.deviceId(),
                event.seatNumber(),
                null,  // airlineCode not in search event
                null,  // appVersion not in search event
                event.audience(),
                event.language()
        ));
    }

    /**
     * Bridge: Record a ping when menu state is reported.
     */
    void recordPingFromMenuState(DomainModels.MenuStateReport report) {
        if (report == null) return;
        seatPingStore.ping(new SeatPingStore.SeatPing(
                report.deviceId(),
                null,  // seatNumber not in menu state
                report.airlineCode(),
                report.appVersion(),
                null,  // audience not in menu state
                null   // language not in menu state
        ));
    }
}