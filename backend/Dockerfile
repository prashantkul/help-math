# Build stage
FROM rust:latest AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first for caching
COPY backend/Cargo.toml backend/Cargo.lock ./

# Create a dummy main.rs to build dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy actual source code
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/.sqlx ./.sqlx

# Remove the dummy binary to force rebuild with real source
RUN rm -f target/release/math-scaffold-backend target/release/deps/math_scaffold_backend*

# Build with offline mode (uses prepared queries from .sqlx)
ENV SQLX_OFFLINE=true
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/math-scaffold-backend .
COPY backend/migrations ./migrations

ENV PORT=8080
ENV RUST_LOG=info

EXPOSE 8080

CMD ["./math-scaffold-backend"]
