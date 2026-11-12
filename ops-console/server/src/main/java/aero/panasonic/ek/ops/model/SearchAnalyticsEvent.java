package aero.panasonic.ek.ops.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Analytics events posted by the seatback SearchAnalyticsBridge.
 *
 * Captures typed queries (and whether they returned results) so the
 * operator dashboard can see what passengers searched for on the
 * fleet — including zero-result queries that indicate a content gap.
 *
 * Seat context fields (seatNumber / language / audience / deviceId) are
 * populated when the seatback knows them and null otherwise. The dashboard
 * uses them to attribute queries to specific passengers and to surface
 * per-seat activity (e.g. "what did seat 12A search for?").
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SearchAnalyticsEvent(
        String subtype,        // AUDIO | VIDEO | MOVIE | TV | GAME
        String query,          // raw text the passenger typed
        int resultCount,       // 0 = no-results event
        String occurredAt,     // ISO-8601 UTC, set client-side
        String seatNumber,     // e.g. "12A"; null if seatback doesn't know its seat yet
        String language,       // ISO code (e.g. "en"); null if unknown
        String audience,       // cabin class ("FIRST"/"BUSINESS"/"ECONOMY"); null if unknown
        String deviceId        // stable seatback identifier so the dashboard can group by seat
) {
    /**
     * Backwards-compatible constructor for older seatback builds that
     * don't yet send seat context. Keeps the wire schema additive —
     * existing seatback code continues to deserialize after a refresh.
     */
    public SearchAnalyticsEvent(String subtype, String query, int resultCount, String occurredAt) {
        this(subtype, query, resultCount, occurredAt, null, null, null, null);
    }
}
