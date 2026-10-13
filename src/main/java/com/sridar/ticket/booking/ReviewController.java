package com.sridar.ticket.booking;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final MovieRepository movieRepository;

    public ReviewController(ReviewRepository reviewRepository, MovieRepository movieRepository) {
        this.reviewRepository = reviewRepository;
        this.movieRepository = movieRepository;
    }

    @GetMapping("/movies/{movieId}/reviews")
    public List<Review> getReviews(@PathVariable Long movieId) {
        return reviewRepository.findByMovieIdOrderByCreatedAtDesc(movieId);
    }

    @PostMapping("/movies/{movieId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public Review addReview(@PathVariable Long movieId, @RequestBody Review request) {
        if (!movieRepository.existsById(movieId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found");
        }
        if (request.getCustomerName() == null || request.getCustomerName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        if (request.getRating() < 1 || request.getRating() > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1 to 5");
        }
        String comment = request.getComment() == null ? "" : request.getComment().trim();

        Review review = new Review();
        review.setMovieId(movieId);
        review.setCustomerName(request.getCustomerName().trim());
        review.setRating(request.getRating());
        review.setComment(comment.length() > 500 ? comment.substring(0, 500) : comment);
        review.setCreatedAt(LocalDateTime.now());
        return reviewRepository.save(review);
    }

    @GetMapping("/reviews/summary")
    public Map<Long, Map<String, Object>> summary() {
        Map<Long, Map<String, Object>> result = new HashMap<>();
        for (Object[] row : reviewRepository.summarize()) {
            Map<String, Object> item = new HashMap<>();
            item.put("average", Math.round(((Double) row[1]) * 10.0) / 10.0);
            item.put("count", row[2]);
            result.put((Long) row[0], item);
        }
        return result;
    }
}
