package com.sridar.ticket.booking;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    List<Feedback> findAllByOrderByCreatedAtDesc();

    @Query("select avg(f.rating) from Feedback f")
    Double averageRating();
}