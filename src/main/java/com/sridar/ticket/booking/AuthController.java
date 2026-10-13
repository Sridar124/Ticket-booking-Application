package com.sridar.ticket.booking;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterRequest(String name, String email, String password) {
    }

    public record LoginRequest(String email, String password) {
    }

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    public AuthController(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request,
                                      HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String name = clean(request.name());
        String email = clean(request.email()).toLowerCase();
        String password = request.password() == null ? "" : request.password();

        if (name.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Name is required");
        }
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            return error(HttpStatus.BAD_REQUEST, "Enter a valid email address");
        }
        if (password.length() < 8) {
            return error(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
        }
        if (userRepository.existsByEmail(email)) {
            return error(HttpStatus.CONFLICT, "This email is already registered");
        }

        AppUser user = new AppUser();
        user.setName(name);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole("USER");
        user.setCreatedAt(LocalDateTime.now());
        userRepository.save(user);

        signIn(user, httpRequest, httpResponse);
        return ResponseEntity.status(HttpStatus.CREATED).body(profile(user));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request,
                                   HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String email = clean(request.email()).toLowerCase();
        String password = request.password() == null ? "" : request.password();
        AppUser user = userRepository.findByEmail(email).orElse(null);

        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        signIn(user, httpRequest, httpResponse);
        return ResponseEntity.ok(profile(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken
                || !authentication.isAuthenticated()) {
            return ResponseEntity.noContent().build();
        }
        AppUser user = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(profile(user));
    }

    private void signIn(AppUser user, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                user.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole())));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private Map<String, String> profile(AppUser user) {
        return Map.of("name", user.getName(), "email", user.getEmail(), "role", user.getRole());
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
