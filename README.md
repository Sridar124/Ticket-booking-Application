# CineBook - Movie Ticket Booking

A full-stack movie ticket booking web app built with Spring Boot, MySQL and plain HTML/CSS/JavaScript.

## Features
- Sign up and log in (BCrypt-hashed passwords, session-based security)
- Browse movies by genre and search by title
- Interactive seat map with live availability
- Payment flow (simulated) with a printable receipt
- My Bookings page with cancel and refund
- Movie reviews, ratings and app feedback
- Seat booking is protected against double booking with database row locks

## Tech stack
Java 21, Spring Boot, Spring Security, Spring Data JPA, MySQL, HTML, CSS, JavaScript

## How seat locking works
When a user pays, the server locks the chosen seat rows (`PESSIMISTIC_WRITE`) inside one transaction, checks they are free, then saves the payment and bookings. Seats are always locked in the same order to avoid deadlocks, and the database has a unique constraint on (movie, seat).

## Run it locally
1. Install Java 21 and MySQL.
2. Set your database password, then start the app:
```
   $env:DB_PASSWORD='your-mysql-password'
   .\mvnw.cmd spring-boot:run
```
3. Open http://localhost:8080

On first start the app creates the database, 3 sample movies and their seats automatically.

## Project structure
- `src/main/java/.../booking` - controllers, entities, repositories, security

- `src/main/resources/static` - frontend (index.html, style.css, app.js, images)

## Screenshots
Add screenshots here (home page, seat map, receipt, My Bookings).