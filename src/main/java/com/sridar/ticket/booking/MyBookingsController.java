package com.sridar.ticket.booking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/my/bookings")
public class MyBookingsController {

    public record MyBookingResponse(Long paymentId, Long movieId, String movieTitle, String posterUrl,
                                    List<String> seats, double amount, String method, String transactionId,
                                    String status, LocalDateTime bookedAt, LocalDateTime cancelledAt) {
    }

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final SeatRepository seatRepository;
    private final MovieRepository movieRepository;

    public MyBookingsController(PaymentRepository paymentRepository, BookingRepository bookingRepository,
                                SeatRepository seatRepository, MovieRepository movieRepository) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.seatRepository = seatRepository;
        this.movieRepository = movieRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<MyBookingResponse> mine(Authentication authentication) {
        List<Payment> payments = paymentRepository.findByUserEmailOrderByCreatedAtDesc(authentication.getName());
        List<Long> movieIds = payments.stream().map(Payment::getMovieId).distinct().toList();
        Map<Long, Movie> movies = movieRepository.findAllById(movieIds).stream()
                .collect(Collectors.toMap(Movie::getId, Function.identity()));
        return payments.stream()
                .map(payment -> toResponse(payment, movies.get(payment.getMovieId())))
                .toList();
    }

    @PostMapping("/{paymentId}/cancel")
    @Transactional
    public MyBookingResponse cancel(@PathVariable Long paymentId, Authentication authentication) {
        Payment payment = paymentRepository.findForUpdate(paymentId)
                .filter(found -> authentication.getName().equals(found.getUserEmail()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (!"SUCCESS".equals(payment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking already cancelled");
        }

        List<Booking> bookings = bookingRepository.findByPaymentId(paymentId);
        List<String> seatNos = bookings.stream().map(Booking::getSeatNo).toList();
        List<Seat> seats = seatNos.isEmpty() ? List.of() : seatRepository.lockSeats(payment.getMovieId(), seatNos);

        seats.forEach(seat -> seat.setBooked(false));
        bookings.forEach(booking -> booking.setStatus("CANCELLED"));
        payment.setStatus("REFUNDED");
        payment.setCancelledAt(LocalDateTime.now());

        seatRepository.saveAll(seats);
        bookingRepository.saveAll(bookings);
        paymentRepository.save(payment);

        Movie movie = movieRepository.findById(payment.getMovieId()).orElse(null);
        return toResponse(payment, movie);
    }

    private MyBookingResponse toResponse(Payment payment, Movie movie) {
        return new MyBookingResponse(
                payment.getId(),
                payment.getMovieId(),
                movie == null ? "Unknown movie" : movie.getTitle(),
                movie == null ? null : movie.getPosterUrl(),
                List.of(payment.getSeats().split(",")),
                payment.getAmount(),
                payment.getMethod(),
                payment.getTransactionId(),
                "SUCCESS".equals(payment.getStatus()) ? "CONFIRMED" : "CANCELLED",
                payment.getCreatedAt(),
                payment.getCancelledAt());
    }
}