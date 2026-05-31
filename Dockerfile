# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Rust backend
FROM rust:1.85-slim AS backend-builder
WORKDIR /app/backend

# Install build dependencies (pkg-config and libssl-dev are often needed)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY backend/Cargo.toml backend/Cargo.lock ./
# Create dummy src to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src
COPY backend/src ./src
RUN touch src/main.rs && cargo build --release

# Stage 3: Final runtime image
FROM debian:bookworm-slim
WORKDIR /app

# Install CA certificates for external HTTPS requests if needed by Rust
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the compiled Rust binary
COPY --from=backend-builder /app/backend/target/release/poker-equity-api ./server

# Copy the built React static files
COPY --from=frontend-builder /app/frontend/dist ./public

# Set the environment variable so Rust knows where to find the static files
ENV STATIC_FILES_DIR=./public

# Expose the port the server runs on
EXPOSE 3000

# Start the server
CMD ["./server"]
