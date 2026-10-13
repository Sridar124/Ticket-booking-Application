package com.sridar.ticket.booking;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByMovieIdOrderByCreatedAtDesc(Long movieId);

    @Query("select r.movieId, avg(r.rating), count(r) from Review r group by r.movieId")
    List<Object[]> summarize();
}