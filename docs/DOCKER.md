# Running the INDRA backend in Docker

This is for the production/operations team running the INDRA backend on a
server or workstation, not for developers building INDRA itself. It covers
one thing: running the Rust `indra` backend (the ACP server the desktop app
talks to) in a container, so nobody has to install Rust, CMake, a C/C++
toolchain, or fight `llama-cpp-sys-2` on the host.

**This setup has been verified by reading the code, not by running
`docker build`.** No Docker daemon was available while writing it. Before
you rely on it, run the quick start below once on a real machine and treat
the first run as validation, not as a known-working deployment. See "Known
limitations" at the end for the specific things that could not be checked.

## What this does and does not run

- **Runs in the container:** the Rust `indra` backend, started as
  `indra serve` - an ACP (Agent Client Protocol) server over HTTP and
  WebSocket. This is the same backend process the Electron desktop app
  normally spawns for itself on your machine.
- **Does not run in the container:** the desktop app itself. It is a GUI
  (Electron/Chromium) application; containerizing a GUI is awkward and not
  what you want here. The desktop app is installed normally on each user's
  machine (as a packaged installer built by CI) and is pointed at this
  container over the network - see "Connecting the desktop client" below.

This split only works because the desktop app talks to the backend over a
**WebSocket**, not over stdio. Confirmed by reading
`ui/desktop/src/acp/acpConnection.ts` (it opens a WebSocket via
`createWebSocketStream` from `@agentclientprotocol/sdk/experimental/ws-client`
to a `ws://.../acp?token=...` URL) and `crates/indra-cli/src/cli.rs`'s `serve`
subcommand (binds an `axum` HTTP server and upgrades `/acp` to a WebSocket).
There is a separate `indra acp` subcommand that speaks ACP over stdio, used
for local/editor integrations - that one is not what the desktop app uses
and would not survive being put behind a container boundary. Everything
below is about `indra serve`.

## Quick start

```bash
cd /path/to/indra
cp .env.docker.example .env
# edit .env and set INDRA_SERVER_SECRET_KEY to a random string, e.g.:
#   openssl rand -hex 32
docker compose up --build
```

That builds the image from source (multi-stage Dockerfile, no host Rust
toolchain needed) and starts the backend listening on `0.0.0.0:3284` inside
the container, published to `localhost:3284` on the host by default.

Check it came up:

```bash
curl http://localhost:3284/health
```

To stop it: `docker compose down` (add `-v` only if you also want to discard
named volumes; this setup uses host-directory bind mounts instead, see
below, so plain `docker compose down` keeps your data).

## What gets mounted, and why

`docker-compose.yml` bind-mounts three host directories, created next to
`docker-compose.yml` on first run (override the paths via `.env`):

| Host path (default) | Container path | Purpose |
|---|---|---|
| `./indra-data` | `/data` | Config, session history, and agent state. Set via `GOOSE_PATH_ROOT=/data`, which makes `crates/indra/src/config/paths.rs` put config/data/state/`.agents` all under this one root. Back this up if session history matters to you. |
| `./indra-models` | `/models` | Local GGUF model cache. Set via `HF_HOME=/models`, which is what `indra-local-inference`'s Hugging Face client (the `hf-hub` crate) uses to decide where to cache downloaded model files. Mount an existing `~/.cache/huggingface` here to avoid re-downloading models you already have. |
| `./indra-workspace` | `/workspace` | The directory (or directories) the agent is allowed to read/write as a project workspace. Set via `ADDITIONAL_AGENT_SOURCE_ROOTS=/workspace` (`crates/indra/src/source_roots.rs`). **Read the limitation below before relying on this.** |

## Ports

Only one port is used: **3284**, the `indra serve` default
(`crates/indra-cli/src/cli.rs`), publishing the ACP WebSocket endpoint at
`/acp`, plus unauthenticated `/health` and `/status` endpoints used for
readiness checks (also used by the container's own `HEALTHCHECK`). Override
the host-side port with `INDRA_HOST_PORT` in `.env` if 3284 is taken.

## Connecting the desktop client

The packaged desktop app normally spawns and manages its own local backend
process. To point an already-installed desktop app at this container
instead, set these environment variables when launching it (confirmed in
`ui/desktop/src/main.ts`):

```bash
INDRA_EXTERNAL_BACKEND=1
INDRA_EXTERNAL_BACKEND_URL=http://<container-host>:3284
INDRA_SERVER__SECRET_KEY=<the same value as INDRA_SERVER_SECRET_KEY in .env>
```

The desktop app also has a Settings-based equivalent (`externalGoosed` in
its settings store: enabled/url/secret/workingDir) if you'd rather configure
it through the UI than the environment.

**Do not use `GOOSE_BINARY` for this.** That variable (see
`ui/desktop/src/indraServe.ts`) points the desktop app's own process spawner
at a different local binary on disk - it is development-only and explicitly
disabled in packaged builds. It is unrelated to attaching to a remote or
containerized backend; `INDRA_EXTERNAL_BACKEND`/`INDRA_EXTERNAL_BACKEND_URL`
is the actual mechanism, and it already exists in the shipped app.

If you serve this over anything other than localhost/loopback, also read
the TLS note below.

## Known limitations (read before deploying)

- **Not build-tested.** This Dockerfile/compose file was written by reading
  `crates/indra-cli/src/cli.rs`, `crates/indra/src/config/paths.rs`,
  `crates/indra-local-inference/src/hf_models.rs`, `ui/desktop/src/main.ts`,
  and `ui/desktop/src/indraServe.ts`, and by checking `Cargo.lock` for native
  and git dependencies - not by running `docker build`. The environment this
  was written in has no Docker daemon. Run the quick start once yourself and
  treat that as the real verification.
- **Workspace folders need matching paths, not just a mount.** The desktop
  app's native OS folder picker shows *host* paths (e.g.
  `C:\Users\you\project` or `/Users/you/project`). The container only sees
  whatever you bind-mounted, at whatever container path you chose. There is
  no automatic translation between the two. If someone picks a workspace
  folder in the desktop UI that isn't the same path you bind-mounted into
  `/workspace`, the backend will not be able to see it. For a container
  deployment, plan to standardize on one or a few bind-mounted directories
  (e.g. always mount the team's shared project directory at `/workspace`)
  rather than relying on the picker to "just work" against a remote backend.
- **Model auto-discovery was only partly verified.** `HF_HOME=/models`
  correctly points the Hugging Face client's cache root at the mounted
  volume (confirmed against the `hf-hub` crate's documented environment
  variables). What was *not* independently verified is whether a `.gguf`
  file placed directly into that folder (rather than downloaded through the
  app, which populates the Hugging Face cache's expected
  `models--org--name/snapshots/<rev>/...` layout) is picked up the same way.
  If you're pre-seeding models, mirror an existing `~/.cache/huggingface`
  layout rather than dropping loose `.gguf` files in, until this is
  confirmed.
- **No TLS by default.** The compose file runs plain HTTP inside a Docker
  network published to the host. `indra serve` supports `--tls` with a cert
  and key (see `cli.rs`), but this setup does not wire that up, to keep the
  one-command path simple. The ACP secret token is passed in the WebSocket
  URL's query string (`?token=...`); over plain HTTP that is visible to
  anything that can see the traffic. Fine for localhost or a trusted private
  network; add `--tls` (with mounted cert/key files) or put this behind a
  TLS-terminating reverse proxy before exposing it beyond that.
- **Build needs network access.** `crates/indra/Cargo.toml` depends on
  `agent-client-protocol` and `agent-client-protocol-http` via `git`
  dependencies (see `Cargo.lock`), plus the usual crates.io fetches. The
  *build* stage therefore needs outbound access to GitHub and crates.io the
  first time (and whenever `Cargo.lock` changes) - this is separate from
  INDRA's runtime sovereignty/air-gap goals, which are about the *running
  server* making no external calls, not about the build process. If you
  need a fully offline build, you'll need to vendor dependencies
  (`cargo vendor`) first; this setup does not do that.
- **`linux/arm64` via buildx is untested.** The Dockerfile is written to be
  arch-generic (no `x86_64`-specific flags), and `.github/workflows/publish-docker.yml`
  already builds `linux/amd64,linux/arm64` for the published image, so
  cross-arch building clearly works in CI for this Dockerfile as it stood
  before this change. What's unverified is build *time* under QEMU emulation
  specifically for the `llama-cpp-sys-2` (llama.cpp/CMake) step, which was
  the slow, fragile part of the native Windows ARM64 build this setup exists
  to avoid. If you need arm64 images regularly, prefer a native arm64
  builder over `buildx --platform linux/amd64,linux/arm64` on x86_64 hardware.
- **Rust version pin is unverified against a live registry.** The Dockerfile
  pins `rust:1.96.1-bookworm` to match `rust-toolchain.toml`. Whether that
  exact tag exists on Docker Hub at the time you build was not checked (no
  network access while writing this). If the tag doesn't resolve, use
  `rust:1-bookworm` and add `RUN rustup install 1.96.1 && rustup default 1.96.1`
  in the builder stage as a fallback - see the comment at the top of the
  `Dockerfile`.

## What's still not "one command"

- **Generating and distributing the shared secret** (`INDRA_SERVER_SECRET_KEY`
  / `INDRA_SERVER__SECRET_KEY`). This is deliberately not auto-generated by
  `docker compose up`, because that secret also has to reach every desktop
  client that connects - `docker-compose.yml` fails fast with a clear error
  if it's unset rather than silently generating one nobody else has.
- **Getting GGUF model files into `./indra-models`.** Either let the backend
  download them on first use (needs outbound network from the container) or
  copy an existing Hugging Face cache in - either way it's a manual,
  one-time step per model.
- **TLS / reverse proxy setup**, if you're exposing this beyond localhost or
  a trusted private network (see above).
- **Building and shipping the desktop client installer.** That remains a
  separate, existing CI process (packaged Electron app); it is out of scope
  for this container and was not touched.

## Existing Docker-related files in this repo

Before adding anything, the repo was checked for existing Docker setups.
Found and reused/fixed rather than duplicated:

- `Dockerfile` (repo root) - already existed and already did most of the
  right things (multi-stage build, non-root runtime user, apt deps for
  `llama-cpp-sys-2`/CMake). Fixed as part of this change: it was missing
  `git` in the builder stage even though `crates/indra/Cargo.toml`
  unconditionally depends on two crates via `git` (the build would have
  failed on a clean checkout); pinned the Rust version to
  `rust-toolchain.toml`'s `1.96.1` (it was on `1.82`); narrowed the build to
  `--bin indra` explicitly; added `EXPOSE 3284`, a `HEALTHCHECK` against
  `/health`, and pre-created `/data`/`/models` for the non-root user.
- `.dockerignore` (repo root) - already existed and already excluded
  `target/`, `node_modules/`, `.git/`, `ui/desktop/out/`, etc. Only small
  additions were made (`.claude/`, top-level media files).
- `.github/workflows/publish-docker.yml` - already builds and publishes this
  same `Dockerfile` (multi-arch, `linux/amd64,linux/arm64`) to
  `ghcr.io/<owner>/indra` on pushes to `main` and on tags. Not modified; the
  Dockerfile fixes above apply to it automatically.
- `BUILDING_DOCKER.md` (repo root) - a pre-existing, developer/CI-facing
  guide for using the image generically as a CLI tool (`docker run indra
  run -t "..."`, provider API keys, etc.). It still has some pre-existing
  branding/naming left over from before this project was named INDRA (e.g.
  `goose:local`, `GOOSE_PROVIDER`). It was left as-is other than a pointer to
  this document, since rewriting it was out of scope here and it serves a
  different audience (developers using the CLI image generically) than this
  document (production team running the backend as a persistent service).
- `.devcontainer/` - a VS Code dev container for local development, unrelated
  to production deployment. Not touched.

No other Dockerfiles, compose files, or container-building CI existed.
