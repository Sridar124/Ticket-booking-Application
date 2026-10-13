const METHODS = [
    { id: "CARD", label: "Credit / Debit Card", hint: "Visa, Mastercard, RuPay", icon: "💳" },
    { id: "UPI", label: "UPI", hint: "Pay with any UPI app", icon: "📲" },
    { id: "GPAY", label: "Google Pay", hint: "Fast UPI payment", icon: "G" },
    { id: "PHONEPE", label: "PhonePe", hint: "Pay using PhonePe", icon: "Pe" },
    { id: "PAYTM", label: "Paytm", hint: "Wallet or UPI", icon: "Pt" }
];

const SECTIONS = ["moviesSection", "detailsSection", "checkoutSection", "receiptSection", "bookingsSection"];
const BOOKING_FILTERS = ["All", "Confirmed", "Cancelled"];
const STEP_OF = { detailsSection: 1, checkoutSection: 2, receiptSection: 3 };
const MAX_SEATS = 8;

const state = {
    user: null,
    movies: [],
    ratings: {},
    genre: "All",
    search: "",
    movie: null,
    selectedSeats: new Set(),
    method: null,
    reviewRating: 0,
    appRating: 0,
    authMode: "login",
    afterLogin: null,
    bookings: [],
    bookingFilter: "All",
    cancelTarget: null
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function money(value) {
    return `₹${Number(value).toFixed(2)}`;
}

function priceLabel(value) {
    const number = Number(value);
    return `₹${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function stars(value) {
    const full = Math.round(value);
    return "★".repeat(full) + "☆".repeat(5 - full);
}

function cssUrl(path) {
    return `url("${String(path).replace(/"/g, "%22")}")`;
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        ...options
    });
    let data = null;
    if (response.status !== 204) {
        const text = await response.text();
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (error) {
                data = null;
            }
        }
    }
    return { ok: response.ok, status: response.status, data };
}

let toastTimer;
function toast(text, type = "success") {
    const box = $("toast");
    clearTimeout(toastTimer);
    box.textContent = text;
    box.className = `toast show ${type}`;
    toastTimer = setTimeout(() => { box.className = "toast"; }, 4500);
}

function showSection(id) {
    SECTIONS.forEach((section) => { $(section).hidden = section !== id; });
    const step = STEP_OF[id];
    $("stepper").hidden = !step;
    document.querySelectorAll("#stepper li").forEach((item) => {
        const number = Number(item.dataset.step);
        item.classList.toggle("active", number === step);
        item.classList.toggle("done", Boolean(step) && number < step);
    });
    window.scrollTo({ top: 0 });
}

function goHome() {
    showSection("moviesSection");
    loadMovies();
}

function row(label, value) {
    const item = el("div", "info-row");
    item.append(el("span", null, label), el("strong", null, value));
    return item;
}

/* ---------- Account ---------- */

function renderNav() {
    const nav = $("navActions");
    nav.replaceChildren();
    if (state.user) {
        const chip = el("span", "user-chip");
        chip.append(el("span", "avatar", state.user.name.charAt(0).toUpperCase()), el("span", null, state.user.name.split(" ")[0]));
        const logoutButton = el("button", "btn btn-ghost btn-sm", "Log out");
        logoutButton.type = "button";
        logoutButton.addEventListener("click", logout);
        const bookingsButton = el("button", "btn btn-ghost btn-sm", "My bookings");
        bookingsButton.type = "button";
        bookingsButton.addEventListener("click", openBookings);
        nav.append(bookingsButton, chip, logoutButton);
    } else {
        const loginButton = el("button", "btn btn-ghost btn-sm", "Log in");
        loginButton.type = "button";
        loginButton.addEventListener("click", () => openAuth("login"));
        const signupButton = el("button", "btn btn-primary btn-sm", "Sign up");
        signupButton.type = "button";
        signupButton.addEventListener("click", () => openAuth("signup"));
        nav.append(loginButton, signupButton);
    }
}

async function loadUser() {
    try {
        const result = await api("/api/auth/me");
        state.user = result.status === 200 ? result.data : null;
    } catch (error) {
        state.user = null;
    }
    renderNav();
    updateBookingPanel();
}

function setAuthMode(mode) {
    state.authMode = mode;
    const signup = mode === "signup";
    $("tabLogin").classList.toggle("active", !signup);
    $("tabSignup").classList.toggle("active", signup);
    $("nameField").hidden = !signup;
    $("authTitle").textContent = signup ? "Create your account" : "Welcome back";
    $("authSubmit").textContent = signup ? "Create account" : "Log in";
    $("authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("authError").hidden = true;
}

function openAuth(mode, message) {
    setAuthMode(mode);
    $("authSub").textContent = message || "Log in to book tickets securely.";
    $("authModal").hidden = false;
    document.body.classList.add("no-scroll");
    (mode === "signup" ? $("authName") : $("authEmail")).focus();
}

function hideAuth() {
    $("authModal").hidden = true;
    document.body.classList.remove("no-scroll");
}

function cancelAuth() {
    state.afterLogin = null;
    hideAuth();
}

function authError(message) {
    const box = $("authError");
    box.textContent = message;
    box.hidden = false;
}

async function submitAuth(event) {
    event.preventDefault();
    const signup = state.authMode === "signup";
    const name = $("authName").value.trim();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (signup && !name) return authError("Please enter your name");
    if (!email) return authError("Please enter your email");
    if (!password) return authError("Please enter your password");
    if (signup && password.length < 8) return authError("Password must be at least 8 characters");

    const button = $("authSubmit");
    button.disabled = true;
    try {
        const result = await api(signup ? "/api/auth/register" : "/api/auth/login", {
            method: "POST",
            body: JSON.stringify(signup ? { name, email, password } : { email, password })
        });
        if (result.ok) {
            state.user = result.data;
            renderNav();
            $("authForm").reset();
            hideAuth();
            toast(signup ? `Welcome to CineBook, ${state.user.name}!` : `Welcome back, ${state.user.name}!`);
            const next = state.afterLogin;
            state.afterLogin = null;
            updateBookingPanel();
            if (next) next();
        } else {
            authError((result.data && result.data.error) || "Something went wrong. Please try again.");
        }
    } catch (error) {
        authError("Network error. Please try again.");
    } finally {
        button.disabled = false;
    }
}

async function logout() {
    try {
        await api("/api/auth/logout", { method: "POST" });
    } catch (error) {
        /* the session is cleared on the next page load anyway */
    }
    state.user = null;
    renderNav();
    updateBookingPanel();
    goHome();
    toast("You have been logged out");
}

/* ---------- Movies ---------- */

function ratingShort(movieId) {
    const summary = state.ratings[movieId];
    return summary ? `★ ${summary.average}` : "New";
}

function ratingLine(movieId) {
    const summary = state.ratings[movieId];
    if (!summary) return "No ratings yet";
    return `${stars(summary.average)}  ${summary.average}/5 · ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`;
}

function posterElement(movie, className) {
    const fallback = el("div", `${className} poster-fallback`, movie.title.charAt(0));
    if (!movie.posterUrl) return fallback;
    const image = el("img", className);
    image.src = movie.posterUrl;
    image.alt = `${movie.title} poster`;
    image.loading = "lazy";
    image.addEventListener("error", () => image.replaceWith(fallback));
    return image;
}

function renderSkeletons() {
    const grid = $("movies");
    grid.replaceChildren();
    for (let i = 0; i < 4; i++) {
        const card = el("div", "card skeleton");
        card.append(el("div", "sk-poster"), el("div", "sk-line"), el("div", "sk-line short"));
        grid.append(card);
    }
}

function renderLoadError() {
    const grid = $("movies");
    grid.replaceChildren();
    const box = el("div", "empty");
    const retry = el("button", "btn btn-primary btn-sm", "Try again");
    retry.type = "button";
    retry.addEventListener("click", loadMovies);
    box.append(el("p", null, "We could not load the movies."), retry);
    grid.append(box);
}

async function loadMovies() {
    renderSkeletons();
    try {
        const [movies, summary] = await Promise.all([api("/api/movies"), api("/api/reviews/summary")]);
        if (!movies.ok) throw new Error("movies");
        state.movies = movies.data || [];
        state.ratings = summary.ok && summary.data ? summary.data : {};
        renderHero();
        renderChips();
        renderMovies();
    } catch (error) {
        renderLoadError();
    }
}

function featuredMovie() {
    const withPoster = state.movies.filter((movie) => movie.posterUrl);
    const pool = withPoster.length ? withPoster : state.movies;
    const average = (movie) => (state.ratings[movie.id] ? state.ratings[movie.id].average : 0);
    return pool.slice().sort((a, b) => average(b) - average(a))[0];
}

function renderHero() {
    const hero = $("hero");
    const movie = featuredMovie();
    if (!movie) {
        hero.hidden = true;
        return;
    }
    hero.hidden = false;
    hero.style.setProperty("--hero-image", movie.posterUrl ? cssUrl(movie.posterUrl) : "none");
    $("heroTitle").textContent = movie.title;
    $("heroMeta").textContent = `${movie.genre || "Movie"} · ${ratingShort(movie.id)} · from ${priceLabel(movie.price)}`;
    $("heroDesc").textContent = movie.description || "";
    $("heroBook").onclick = () => openMovie(movie);
}

function renderChips() {
    const genres = ["All", ...new Set(state.movies.map((movie) => movie.genre).filter(Boolean))];
    const box = $("genreChips");
    box.replaceChildren();
    genres.forEach((genre) => {
        const chip = el("button", "chip", genre);
        chip.type = "button";
        if (genre === state.genre) chip.classList.add("active");
        chip.addEventListener("click", () => {
            state.genre = genre;
            renderChips();
            renderMovies();
        });
        box.append(chip);
    });
}

function movieCard(movie) {
    const card = el("article", "card");
    card.tabIndex = 0;

    const media = el("div", "card-media");
    media.append(posterElement(movie, "poster"), el("span", "badge-rating", ratingShort(movie.id)));

    const meta = el("div", "card-meta");
    meta.append(el("span", "chip-static", movie.genre || "Movie"), el("span", "price", priceLabel(movie.price)));

    const button = el("button", "btn btn-primary btn-block", "Book now");
    button.type = "button";

    const body = el("div", "card-body");
    body.append(el("h3", null, movie.title), meta, button);
    card.append(media, body);

    card.addEventListener("click", () => openMovie(movie));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target === card) openMovie(movie);
    });
    return card;
}

function renderMovies() {
    const query = state.search.trim().toLowerCase();
    const list = state.movies.filter((movie) =>
        (state.genre === "All" || movie.genre === state.genre) &&
        movie.title.toLowerCase().includes(query));
    const grid = $("movies");
    grid.replaceChildren();
    $("moviesEmpty").hidden = list.length > 0;
    $("moviesEmpty").textContent = state.movies.length
        ? "No movies match your search."
        : "No movies are showing right now. Please check back soon.";
    list.forEach((movie) => grid.append(movieCard(movie)));
}

/* ---------- Movie details and seats ---------- */

async function openMovie(movie) {
    state.movie = movie;
    state.selectedSeats.clear();
    state.reviewRating = 0;

    $("detailHero").style.setProperty("--detail-image", movie.posterUrl ? cssUrl(movie.posterUrl) : "none");
    $("detailPoster").replaceChildren(posterElement(movie, "detail-poster"));
    $("detailGenre").textContent = movie.genre || "Movie";
    $("movieTitle").textContent = movie.title;
    $("movieRating").textContent = ratingLine(movie.id);
    $("movieDescription").textContent = movie.description || "";
    $("moviePrice").textContent = `${priceLabel(movie.price)} per seat`;
    $("reviewComment").value = "";
    renderReviewStars();

    showSection("detailsSection");
    updateBookingPanel();
    await Promise.all([loadSeats(), loadReviews()]);
}

function seatButton(seat) {
    const button = el("button", "seat", seat.seatNo.slice(1));
    button.type = "button";
    button.title = `Seat ${seat.seatNo}`;
    button.setAttribute("aria-label", `Seat ${seat.seatNo}${seat.booked ? " (booked)" : ""}`);
    if (seat.booked) {
        button.classList.add("taken");
        button.disabled = true;
    } else {
        if (state.selectedSeats.has(seat.seatNo)) button.classList.add("selected");
        button.addEventListener("click", () => toggleSeat(seat.seatNo, button));
    }
    return button;
}

async function loadSeats() {
    const grid = $("seats");
    const result = await api(`/api/movies/${state.movie.id}/seats`);
    grid.replaceChildren();
    if (!result.ok || !result.data || !result.data.length) {
        grid.append(el("p", "muted", "Seats are not available for this movie yet."));
        updateBookingPanel();
        return;
    }

    const seats = result.data.slice().sort((a, b) => a.seatNo.localeCompare(b.seatNo, undefined, { numeric: true }));
    const available = new Set(seats.filter((seat) => !seat.booked).map((seat) => seat.seatNo));
    [...state.selectedSeats].forEach((seatNo) => {
        if (!available.has(seatNo)) state.selectedSeats.delete(seatNo);
    });

    const rows = new Map();
    seats.forEach((seat) => {
        const key = seat.seatNo.charAt(0);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(seat);
    });

    rows.forEach((rowSeats, key) => {
        const line = el("div", "seat-row");
        line.append(el("span", "row-label", key));
        rowSeats.forEach((seat, index) => {
            if (index > 0 && index === Math.floor(rowSeats.length / 2)) line.append(el("span", "aisle"));
            line.append(seatButton(seat));
        });
        grid.append(line);
    });
    updateBookingPanel();
}

function toggleSeat(seatNo, button) {
    if (state.selectedSeats.has(seatNo)) {
        state.selectedSeats.delete(seatNo);
    } else {
        if (state.selectedSeats.size >= MAX_SEATS) {
            toast(`You can book up to ${MAX_SEATS} seats at a time`, "error");
            return;
        }
        state.selectedSeats.add(seatNo);
    }
    button.classList.toggle("selected");
    updateBookingPanel();
}

function orderTotal() {
    return state.movie ? state.movie.price * state.selectedSeats.size : 0;
}

function updateBookingPanel() {
    if (!state.movie) return;
    const seats = [...state.selectedSeats];
    const chips = $("selectedChips");
    chips.replaceChildren();
    seats.forEach((seatNo) => chips.append(el("span", "seat-chip", seatNo)));
    $("selectedText").textContent = seats.length
        ? `${seats.length} ${seats.length === 1 ? "seat" : "seats"} selected`
        : "No seats selected yet";
    $("totalText").textContent = money(orderTotal());
    $("bookBtn").disabled = !seats.length;
    $("loginHint").textContent = state.user
        ? `Booking as ${state.user.name}`
        : "You will be asked to log in before payment.";
    if (state.user && !$("reviewName").value) $("reviewName").value = state.user.name;
}

/* ---------- Checkout ---------- */

function startCheckout() {
    if (!state.selectedSeats.size) {
        toast("Please select at least one seat", "error");
        return;
    }
    if (!state.user) {
        state.afterLogin = startCheckout;
        openAuth("login", "Log in or create an account to continue to payment.");
        return;
    }
    state.method = null;
    renderOrderSummary();
    renderMethods();
    updatePayButton();
    showSection("checkoutSection");
}

function renderOrderSummary() {
    const box = $("orderSummary");
    box.replaceChildren();
    box.append(
        row("Movie", state.movie.title),
        row("Seats", [...state.selectedSeats].join(", ")),
        row("Price per seat", priceLabel(state.movie.price)),
        row("Booking as", state.user.name)
    );
    const total = el("div", "total-row");
    total.append(el("span", null, "Total"), el("strong", null, money(orderTotal())));
    box.append(total);
}

function renderMethods() {
    const box = $("methods");
    box.replaceChildren();
    METHODS.forEach((method) => {
        const text = el("span", "method-text");
        text.append(el("strong", null, method.label), el("small", "muted", method.hint));

        const button = el("button", "method");
        button.type = "button";
        button.append(el("span", "method-icon", method.icon), text, el("span", "radio"));
        if (method.id === state.method) button.classList.add("active");
        button.addEventListener("click", () => {
            state.method = method.id;
            renderMethods();
        });
        box.append(button);
    });
}

function updatePayButton() {
    $("payBtn").textContent = `Pay ${money(orderTotal())}`;
}

async function payNow() {
    if (!state.method) {
        toast("Please choose a payment method", "error");
        return;
    }
    const button = $("payBtn");
    button.disabled = true;
    button.textContent = "Processing payment...";
    try {
        await wait(1200);
        const result = await api("/api/payments", {
            method: "POST",
            body: JSON.stringify({
                movieId: state.movie.id,
                seatNos: [...state.selectedSeats],
                method: state.method
            })
        });
        if (result.status === 201) {
            showReceipt(result.data);
        } else if (result.status === 401 || result.status === 403) {
            state.user = null;
            renderNav();
            state.afterLogin = startCheckout;
            openAuth("login", "Your session has expired. Please log in again.");
        } else if (result.status === 409) {
            state.selectedSeats.clear();
            await loadSeats();
            showSection("detailsSection");
            toast("Sorry, one of your seats was just booked by someone else. Please choose again.", "error");
        } else {
            toast("Payment failed. Please try again.", "error");
        }
    } catch (error) {
        toast("Network error. Please try again.", "error");
    } finally {
        button.disabled = false;
        updatePayButton();
    }
}

function showReceipt(payment) {
    const method = METHODS.find((item) => item.id === payment.method);
    const box = $("receiptDetails");
    box.replaceChildren();
    [
        ["Movie", state.movie.title],
        ["Seats", payment.seats.split(",").join(", ")],
        ["Booked by", payment.customerName],
        ["Paid via", method ? method.label : payment.method],
        ["Amount paid", money(payment.amount)],
        ["Date", new Date(payment.createdAt).toLocaleString()]
    ].forEach(([label, value]) => box.append(row(label, value)));
    $("txnId").textContent = payment.transactionId;
    state.selectedSeats.clear();
    showSection("receiptSection");
}

/* ---------- My bookings ---------- */

async function openBookings() {
    if (!state.user) {
        state.afterLogin = openBookings;
        openAuth("login", "Log in to see your bookings.");
        return;
    }
    state.bookingFilter = "All";
    showSection("bookingsSection");
    await loadBookings();
}

function sessionExpired(next) {
    state.user = null;
    renderNav();
    state.afterLogin = next;
    openAuth("login", "Your session has expired. Please log in again.");
}

async function loadBookings() {
    const box = $("bookingList");
    box.replaceChildren(el("p", "muted", "Loading your bookings..."));
    $("bookingsEmpty").hidden = true;
    const result = await api("/api/my/bookings");
    if (result.status === 401 || result.status === 403) {
        sessionExpired(openBookings);
        return;
    }
    if (!result.ok) {
        box.replaceChildren(el("p", "muted", "Could not load your bookings. Please try again."));
        return;
    }
    state.bookings = result.data || [];
    renderBookings();
}

function renderBookings() {
    const chips = $("bookingChips");
    chips.replaceChildren();
    BOOKING_FILTERS.forEach((filter) => {
        const chip = el("button", "chip", filter);
        chip.type = "button";
        if (filter === state.bookingFilter) chip.classList.add("active");
        chip.addEventListener("click", () => {
            state.bookingFilter = filter;
            renderBookings();
        });
        chips.append(chip);
    });

    const wanted = state.bookingFilter.toUpperCase();
    const list = state.bookings.filter((booking) => state.bookingFilter === "All" || booking.status === wanted);
    const box = $("bookingList");
    box.replaceChildren();
    $("bookingsEmpty").hidden = list.length > 0;
    $("bookingsEmpty").textContent = state.bookings.length
        ? "No bookings in this category."
        : "You have not booked any tickets yet.";
    list.forEach((booking) => box.append(bookingCard(booking)));
}

function bookingCard(booking) {
    const confirmed = booking.status === "CONFIRMED";
    const method = METHODS.find((item) => item.id === booking.method);

    const top = el("div", "booking-top");
    top.append(
        el("h3", null, booking.movieTitle),
        el("span", confirmed ? "status-badge confirmed" : "status-badge cancelled", confirmed ? "Confirmed" : "Cancelled")
    );

    const info = el("div", "booking-info");
    info.append(
        top,
        row("Seats", booking.seats.join(", ")),
        row("Amount", money(booking.amount)),
        row("Paid via", method ? method.label : booking.method),
        row("Booked on", new Date(booking.bookedAt).toLocaleString()),
        row("Transaction ID", booking.transactionId)
    );
    if (!confirmed && booking.cancelledAt) {
        info.append(
            row("Cancelled on", new Date(booking.cancelledAt).toLocaleString()),
            row("Refund", `${money(booking.amount)} (demo)`)
        );
    }
    if (confirmed) {
        const button = el("button", "btn btn-ghost btn-sm cancel-btn", "Cancel booking");
        button.type = "button";
        button.addEventListener("click", () => askCancel(booking));
        info.append(button);
    }

    const card = el("article", confirmed ? "booking-card" : "booking-card cancelled");
    card.append(posterElement({ title: booking.movieTitle, posterUrl: booking.posterUrl }, "booking-poster"), info);
    return card;
}

function askCancel(booking) {
    state.cancelTarget = booking;
    $("confirmText").textContent =
        `${booking.movieTitle} · Seats ${booking.seats.join(", ")} · ${money(booking.amount)}. ` +
        "Your seats will be released and the amount refunded.";
    $("confirmModal").hidden = false;
    document.body.classList.add("no-scroll");
}

function closeConfirm() {
    state.cancelTarget = null;
    $("confirmModal").hidden = true;
    document.body.classList.remove("no-scroll");
}

async function confirmCancel() {
    const booking = state.cancelTarget;
    if (!booking) return;
    const button = $("confirmYes");
    button.disabled = true;
    try {
        const result = await api(`/api/my/bookings/${booking.paymentId}/cancel`, { method: "POST" });
        closeConfirm();
        if (result.ok) {
            toast(`Booking cancelled. Refund of ${money(booking.amount)} initiated (demo).`);
        } else if (result.status === 401 || result.status === 403) {
            sessionExpired(openBookings);
            return;
        } else if (result.status === 409) {
            toast("This booking was already cancelled.", "error");
        } else {
            toast("Could not cancel the booking. Please try again.", "error");
        }
        await loadBookings();
    } catch (error) {
        closeConfirm();
        toast("Network error. Please try again.", "error");
    } finally {
        button.disabled = false;
    }
}

/* ---------- Reviews ---------- */

function renderStarPicker(boxId, value, onPick) {
    const box = $(boxId);
    box.replaceChildren();
    for (let i = 1; i <= 5; i++) {
        const star = el("button", "star", "★");
        star.type = "button";
        star.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
        if (i <= value) star.classList.add("on");
        star.addEventListener("click", () => onPick(i));
        box.append(star);
    }
}

function renderReviewStars() {
    renderStarPicker("starInput", state.reviewRating, (value) => {
        state.reviewRating = value;
        renderReviewStars();
    });
}

async function loadReviews() {
    const result = await api(`/api/movies/${state.movie.id}/reviews`);
    const list = $("reviews");
    list.replaceChildren();
    if (!result.ok || !result.data || !result.data.length) {
        list.append(el("p", "muted", "No reviews yet. Be the first to review!"));
        return;
    }
    result.data.forEach((review) => {
        const head = el("div", "review-head");
        head.append(el("strong", null, review.customerName), el("span", "rating", stars(review.rating)));
        const item = el("div", "review");
        item.append(head);
        if (review.comment) item.append(el("p", null, review.comment));
        item.append(el("small", "muted", new Date(review.createdAt).toLocaleDateString()));
        list.append(item);
    });
}

async function submitReview() {
    const name = $("reviewName").value.trim();
    const comment = $("reviewComment").value.trim();
    if (!state.reviewRating) {
        toast("Please choose a star rating", "error");
        return;
    }
    if (!name) {
        toast("Please enter your name", "error");
        return;
    }
    const result = await api(`/api/movies/${state.movie.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ customerName: name, rating: state.reviewRating, comment })
    });
    if (result.status === 201) {
        toast("Thanks for your review!");
        $("reviewComment").value = "";
        state.reviewRating = 0;
        renderReviewStars();
        const summary = await api("/api/reviews/summary");
        if (summary.ok && summary.data) state.ratings = summary.data;
        $("movieRating").textContent = ratingLine(state.movie.id);
        await loadReviews();
    } else {
        toast("Could not save your review", "error");
    }
}

/* ---------- App feedback ---------- */

function renderAppStars() {
    renderStarPicker("appStarInput", state.appRating, (value) => {
        state.appRating = value;
        renderAppStars();
    });
}

async function loadAppRating() {
    const result = await api("/api/feedback/summary");
    if (!result.ok || !result.data) return;
    $("appRating").textContent = result.data.count
        ? `${stars(result.data.average)} ${result.data.average} (${result.data.count} ratings)`
        : "Be the first to rate CineBook";
}

async function sendFeedback() {
    if (!state.appRating) {
        toast("Please choose a star rating for CineBook", "error");
        return;
    }
    const result = await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
            customerName: $("feedbackName").value.trim(),
            rating: state.appRating,
            message: $("feedbackMessage").value.trim()
        })
    });
    if (result.status === 201) {
        toast("Thank you for your feedback!");
        $("feedbackName").value = "";
        $("feedbackMessage").value = "";
        state.appRating = 0;
        renderAppStars();
        await loadAppRating();
    } else {
        toast("Could not send feedback", "error");
    }
}

/* ---------- Events and start-up ---------- */

$("logo").addEventListener("click", (event) => {
    event.preventDefault();
    goHome();
});
$("backBtn").addEventListener("click", goHome);
$("doneBtn").addEventListener("click", goHome);
$("checkoutBackBtn").addEventListener("click", () => showSection("detailsSection"));
$("heroBrowse").addEventListener("click", () => $("nowShowing").scrollIntoView({ behavior: "smooth" }));
$("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderMovies();
});
$("bookBtn").addEventListener("click", startCheckout);
$("payBtn").addEventListener("click", payNow);
$("printBtn").addEventListener("click", () => window.print());
$("reviewBtn").addEventListener("click", submitReview);
$("feedbackBtn").addEventListener("click", sendFeedback);
$("receiptBookingsBtn").addEventListener("click", openBookings);
$("confirmNo").addEventListener("click", closeConfirm);
$("confirmYes").addEventListener("click", confirmCancel);
$("confirmModal").addEventListener("click", (event) => {
    if (event.target === $("confirmModal")) closeConfirm();
});

$("tabLogin").addEventListener("click", () => setAuthMode("login"));
$("tabSignup").addEventListener("click", () => setAuthMode("signup"));
$("authForm").addEventListener("submit", submitAuth);
$("authClose").addEventListener("click", cancelAuth);
$("authModal").addEventListener("click", (event) => {
    if (event.target === $("authModal")) cancelAuth();
});
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("authModal").hidden) cancelAuth();
    if (!$("confirmModal").hidden) closeConfirm();
});

$("year").textContent = new Date().getFullYear();
renderAppStars();
renderReviewStars();
loadUser();
loadMovies();
loadAppRating();
