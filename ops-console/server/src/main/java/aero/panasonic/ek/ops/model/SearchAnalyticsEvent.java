package aero.panasonic.ek.ops.model;

/**
 * Analytics events posted by the seatback SearchAnalyticsBridge.
 *
 * Captures typed queries (and whether they returned results) so the
 * operator dashboard can see what passengers searched for on the
 * fleet — including zero-result queries that indicate a content gap.
 */
public record SearchAnalyticsEvent(
        String subtype,        // AUDIO | VIDEO | MOVIE | TV | GAME
        String query,          // raw text the passenger typed
        int resultCount,       // 0 = no-results event
        String occurredAt      // ISO-8601 UTC, set client-side
) {}
