# syntax=docker/dockerfile:1.4
# INDRA CLI and Server Docker Image
# Multi-stage build for minimal final image size
#
# NOTE: the Rust version below is pinned to match rust-toolchain.toml (1.96.1).
# That tag was not verified against a live registry in this change (no Docker
# daemon / network access available while authoring it) - if `rust:1.96.1-bookworm`
# is not yet published when you build this, use `rust:1-bookworm` and add
# `RUN rustup install 1.96.1 && rustup default 1.96.1` as a fallback.

# Build stage
FROM rust:1.96.1-bookworm AS builder

# Install build dependencies.
#
# - build-essential/cmake/pkg-config/libclang-dev: required by llama-cpp-sys-2
#   (vendored llama.cpp, built via cmake) and by aws-lc-sys/ring/zstd-sys, which
#   all need a C/C++ toolchain; libclang-dev backs bindgen for llama-cpp-sys-2
#   and aws-lc-sys.
# - git: crates/indra/Cargo.toml depends on `agent-client-protocol` and
#   `agent-client-protocol-http` via git (see Cargo.toml/Cargo.lock), which
#   cargo fetches with the `git` binary - this was missing from this stage
#   before and would fail the build.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    libssl-dev \
    libdbus-1-dev \
    libclang-dev \
    protobuf-compiler \
    libprotobuf-dev \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /build

# Copy source code
COPY . .

# Build release binaries with optimizations
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_LTO=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1
ENV CARGO_PROFILE_RELEASE_OPT_LEVEL=z
ENV CARGO_PROFILE_RELEASE_STRIP=true
RUN cargo build --release -p indra-cli --bin indra

# Runtime stage - minimal Debian
FROM debian:bookworm-slim@sha256:b1a741487078b369e78119849663d7f1a5341ef2768798f7b7406c4240f86aef

# Install only runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libdbus-1-3 \
    libgomp1 \
    libxcb1 \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /build/target/release/indra /usr/local/bin/indra

# Create non-root user, plus /data as the mount point for persistent
# config/session state and /models for local GGUF/HF model files. Both are
# created (and owned by the non-root user) unconditionally so a plain
# `docker run indra ...` (no volumes, e.g. CI usage per BUILDING_DOCKER.md)
# still works; docker-compose.yml is what actually mounts volumes there.
RUN useradd -m -u 1000 -s /bin/bash indra && \
    mkdir -p /home/indra/.config/indra /data /models && \
    chown -R indra:indra /home/indra /data /models

# Set up environment
ENV PATH="/usr/local/bin:${PATH}"
ENV HOME="/home/indra"

# Switch to non-root user
USER indra
WORKDIR /home/indra

# 3284 is the default port for `indra serve` (ACP over HTTP/WebSocket) -
# see crates/indra-cli/src/cli.rs's Serve command. This is documentation only;
# docker-compose.yml (or `docker run -p`) is what actually publishes it.
EXPOSE 3284

# `indra serve` exposes an unauthenticated /health endpoint specifically for
# checks like this one (see crates/indra-cli/src/cli.rs and
# ui/desktop/src/acp/acpConnection.ts's buildLocalServeUrls). Port 3284 is the
# `indra serve` default; if docker-compose.yml's command overrides --port,
# override this HEALTHCHECK too. It has no effect for other subcommands
# (e.g. `indra --help`), where it will just fail/skip, which is harmless
# outside the compose-managed `serve` use case.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
    CMD curl -fsS http://127.0.0.1:3284/health || exit 1

# Default to indra CLI; docker-compose.yml overrides this with
# `serve --host 0.0.0.0 ...` to run it as the backend/ACP server.
ENTRYPOINT ["/usr/local/bin/indra"]
CMD ["--help"]

# Labels for metadata
LABEL org.opencontainers.image.title="indra"
LABEL org.opencontainers.image.description="INDRA CLI"
LABEL org.opencontainers.image.vendor="AAIF"
LABEL org.opencontainers.image.source="https://github.com/HariKarthick22/indra"
