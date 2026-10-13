package com.sridar.ticket.booking;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByMovieId(Long movieId);

    Optional<Seat> findByMovieIdAndSeatNo(Long movieId, String seatNo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Seat s where s.movieId = :movieId and s.seatNo in :seatNos")
    List<Seat> lockSeats(@Param("movieId") Long movieId, @Param("seatNos") List<String> seatNos);
}