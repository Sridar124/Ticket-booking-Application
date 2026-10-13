package com.sridar.ticket.booking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackRepository feedbackRepository;

    public FeedbackController(FeedbackRepository feedbackRepository) {
        this.feedbackRepository = feedbackRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Feedback add(@RequestBody Feedback request) {
        if (request.getRating() < 1 || request.getRating() > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1 to 5");
        }
        String name = request.getCustomerName() == null ? "" : request.getCustomerName().trim();
        String message = request.getMessage() == null ? "" : request.getMessage().trim();

        Feedback feedback = new Feedback();
        feedback.setCustomerName(name.isEmpty() ? "Anonymous" : name);
        feedback.setRating(request.getRating());
        feedback.setMessage(message.length() > 500 ? message.substring(0, 500) : message);
        feedback.setCreatedAt(LocalDateTime.now());
        return feedbackRepository.save(feedback);
    }

    @GetMapping
    public List<Feedback> getAll() {
        return feedbackRepository.findAllByOrderByCreatedAtDesc();
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        Double average = feedbackRepository.averageRating();
        double rounded = average == null ? 0 : Math.round(average * 10.0) / 10.0;
        return Map.of("average", rounded, "count", feedbackRepository.count());
    }
}