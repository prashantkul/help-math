# Build stage
FROM rust:latest as builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Cache buster - incrementing this forces rebuild
RUN echo "Build version: 2"

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Build with offline mode (uses prepared queries from .sqlx)
ENV SQLX_OFFLINE=true
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/math-scaffold-backend .
COPY migrations ./migrations

ENV PORT=8080

EXPOSE 8080

CMD ["./math-scaffold-backend"]
