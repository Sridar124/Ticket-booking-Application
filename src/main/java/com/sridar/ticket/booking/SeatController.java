package com.sridar.ticket.booking;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/movies/{movieId}/seats")
public class SeatController {

    private static final String ROWS = "ABCDEF";
    private static final int SEATS_PER_ROW = 10;

    private final SeatRepository seatRepository;
    private final MovieRepository movieRepository;

    public SeatController(SeatRepository seatRepository, MovieRepository movieRepository) {
        this.seatRepository = seatRepository;
        this.movieRepository = movieRepository;
    }


    @GetMapping
    public List<Seat> list(@PathVariable Long movieId) {
        requireMovie(movieId);
        return seatRepository.findByMovieId(movieId);
    }

    @PostMapping("/generate")
    @Transactional
    public Map<String, Object> generate(@PathVariable Long movieId) {
        requireMovie(movieId);
        Set<String> existing = seatRepository.findByMovieId(movieId).stream()
                .map(Seat::getSeatNo)
                .collect(Collectors.toSet());

        List<Seat> created = new ArrayList<>();
        for (char row : ROWS.toCharArray()) {
            for (int number = 1; number <= SEATS_PER_ROW; number++) {
                String seatNo = String.valueOf(row) + number;
                if (!existing.contains(seatNo)) {
                    Seat seat = new Seat();
                    seat.setMovieId(movieId);
                    seat.setSeatNo(seatNo);
                    seat.setBooked(false);
                    created.add(seat);
                }
            }
        }
        seatRepository.saveAll(created);
        return Map.of("created", created.size(), "total", existing.size() + created.size());
    }

    private void requireMovie(Long movieId) {

        if (!movieRepository.existsById(movieId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found");
        }
    }
}