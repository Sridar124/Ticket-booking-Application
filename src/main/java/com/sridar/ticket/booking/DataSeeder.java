package com.sridar.ticket.booking;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final String ROWS = "ABCDEF";
    private static final int SEATS_PER_ROW = 10;

    private final MovieRepository movieRepository;
    private final SeatRepository seatRepository;

    public DataSeeder(MovieRepository movieRepository, SeatRepository seatRepository) {
        this.movieRepository = movieRepository;
        this.seatRepository = seatRepository;
    }

    @Override
    public void run(String... args) {
        if (movieRepository.count() == 0) {
            movieRepository.saveAll(List.of(
                    movie("Interstellar", "Sci-Fi", 250.0, "/images/interstellar.jpg",
                            "A team of astronauts travels through a wormhole in search of a new home for humanity."),
                    movie("The Dark Knight", "Action", 220.0, "/images/dark-knight.jpg",
                            "Batman faces the Joker, a criminal mastermind who pushes Gotham into chaos."),
                    movie("3 Idiots", "Comedy", 180.0, "/images/3-idiots.jpg",
                            "Three friends in an engineering college learn to follow their passion instead of just chasing marks.")));

        }

        for (Movie movie : movieRepository.findAll()) {
            if (seatRepository.findByMovieId(movie.getId()).isEmpty()) {
                List<Seat> seats = new ArrayList<>();
                for (char row : ROWS.toCharArray()) {
                    for (int number = 1; number <= SEATS_PER_ROW; number++) {
                        Seat seat = new Seat();
                        seat.setMovieId(movie.getId());
                        seat.setSeatNo(String.valueOf(row) + number);
                        seat.setBooked(false);
                        seats.add(seat);
                    }
                }
                seatRepository.saveAll(seats);
            }
        }
    }

    private Movie movie(String title, String genre, double price, String posterUrl, String description) {
        Movie movie = new Movie();
        movie.setTitle(title);
        movie.setGenre(genre);
        movie.setPrice(price);
        movie.setPosterUrl(posterUrl);
        movie.setDescription(description);
        return movie;
    }
}