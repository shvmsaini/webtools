package aero.panasonic.ek.ops.web;

import aero.panasonic.ek.ops.model.DomainModels.QuizResponse;
import aero.panasonic.ek.ops.model.DomainModels.QuizResponseSummary;
import aero.panasonic.ek.ops.store.InMemoryOpsStore;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST endpoints for quiz/survey responses.
 *
 *   POST   /api/v1/quiz/responses              Ingest a passenger response
 *   GET    /api/v1/quiz/responses              List all responses
 *   GET    /api/v1/quiz/responses/{notifId}    Get responses for a specific notification
 *   GET    /api/v1/quiz/responses/seats/{seat} Get responses from a specific seat
 *   GET    /api/v1/quiz/summary                Aggregate summary by notification
 */
@RestController
@RequestMapping("/api/v1/quiz")
public class QuizController {

    private final InMemoryOpsStore store;

    public QuizController(InMemoryOpsStore store) {
        this.store = store;
    }

    /**
     * Ingest a passenger's response to a quiz/survey notification.
     */
    @PostMapping("/responses")
    public ResponseEntity<QuizResponse> ingest(@Valid @RequestBody QuizResponse response) {
        return ResponseEntity.ok(store.saveQuizResponse(response));
    }

    /**
     * List all quiz responses across all notifications.
     */
    @GetMapping("/responses")
    public List<QuizResponse> listAll() {
        return store.listQuizResponses();
    }

    /**
     * Get responses for a specific notification.
     */
    @GetMapping("/responses/{notificationId}")
    public List<QuizResponse> listByNotification(@PathVariable String notificationId) {
        return store.listQuizResponsesByNotification(notificationId);
    }

    /**
     * Get responses from a specific seat.
     */
    @GetMapping("/responses/seats/{seatNumber}")
    public List<QuizResponse> listBySeat(@PathVariable String seatNumber) {
        return store.listQuizResponsesBySeat(seatNumber);
    }

    /**
     * Get aggregated summary of responses per notification.
     * Shows impressions, response counts, breakdown by option, etc.
     */
    @GetMapping("/summary")
    public List<QuizResponseSummary> getSummary() {
        return store.getQuizResponseSummary();
    }
}