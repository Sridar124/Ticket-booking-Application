package com.sridar.ticket.booking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Set<String> METHODS = Set.of("CARD", "UPI", "GPAY", "PHONEPE", "PAYTM");

    public record PaymentRequest(Long movieId, List<String> seatNos, String method) {
    }

    private final MovieRepository movieRepository;
    private final SeatRepository seatRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final AppUserRepository userRepository;

    public PaymentController(MovieRepository movieRepository, SeatRepository seatRepository,
                             BookingRepository bookingRepository, PaymentRepository paymentRepository,
                             AppUserRepository userRepository) {
        this.movieRepository = movieRepository;
        this.seatRepository = seatRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Payment pay(@RequestBody PaymentRequest request, Authentication authentication) {
        AppUser user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in"));

        if (request.movieId() == null || request.seatNos() == null || request.seatNos().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Movie and seats are required");
        }
        String method = request.method() == null ? "" : request.method().trim().toUpperCase();
        if (!METHODS.contains(method)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported payment method");
        }

        Movie movie = movieRepository.findById(request.movieId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found"));
        List<String> seatNos = request.seatNos().stream().map(String::trim).distinct().toList();

        List<Seat> seats = seatRepository.lockSeats(movie.getId(), seatNos);
        if (seats.size() != seatNos.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "One or more seats do not exist");
        }
        if (seats.stream().anyMatch(Seat::isBooked)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "One or more seats are already booked");
        }

        Payment payment = new Payment();
        payment.setMovieId(movie.getId());
        payment.setCustomerName(user.getName());
        payment.setUserEmail(user.getEmail());
        payment.setSeats(String.join(",", seatNos));
        payment.setAmount(Math.round(movie.getPrice() * seatNos.size() * 100.0) / 100.0);
        payment.setMethod(method);
        payment.setStatus("SUCCESS");
        payment.setTransactionId("TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        payment.setCreatedAt(LocalDateTime.now());
        Payment saved = paymentRepository.save(payment);

        for (Seat seat : seats) {
            seat.setBooked(true);
            seatRepository.save(seat);

            Booking booking = new Booking();
            booking.setMovieId(movie.getId());
            booking.setSeatNo(seat.getSeatNo());
            booking.setCustomerName(user.getName());
            booking.setUserEmail(user.getEmail());
            booking.setPaymentId(saved.getId());
            booking.setStatus("CONFIRMED");
            booking.setBookedAt(LocalDateTime.now());
            bookingRepository.save(booking);
        }
        return saved;
    }
}