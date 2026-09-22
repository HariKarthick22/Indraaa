# Dependencies

Everything needed to build and run INDRA from source, per platform. This file
exists because building this project from scratch on a bare machine surfaced
every one of the gaps below the hard way — if you hit an error this file
doesn't cover, the fix almost certainly belongs back in this file.

If you just want to *run* INDRA without building it, use the Docker backend
instead (see `docs/DOCKER.md`) — none of this is needed there.

## All platforms

| Dependency | Why | Get it |
|---|---|---|
| **Rust** (pinned by `rust-toolchain.toml`, currently 1.96.1) | Backend (`crates/`) | `rustup` — https://rustup.rs |
| **Node.js 20+** | Desktop UI (`ui/desktop/`) | https://nodejs.org, or a version manager (`nvm`, `fnm`) |
| **pnpm** | UI package manager, workspace root is `ui/` | `corepack enable` (bundled with Node ≥16.9), or `npm i -g pnpm` |
| **CMake** | Builds `llama.cpp` for local model inference (`local-inference` feature, on by default) | See per-OS section |
| **A C/C++ toolchain** | Compiles several native Rust dependencies (`aws-lc-sys`/`ring` for TLS, `zstd-sys`, `llama-cpp-sys-2`) | See per-OS section — **this is the one every platform gets wrong first** |
| **git** | `crates/indra` depends on `agent-client-protocol` via a git source | Usually already present |
| **just** (optional but recommended) | Runs the recipes in `justfile` (`just release-binary`, `just run-ui`, etc.) | https://github.com/casey/just |

## Linux

```bash
# Debian/Ubuntu
sudo apt install build-essential cmake pkg-config libclang-dev git

# Fedora/RHEL
sudo dnf install gcc gcc-c++ cmake pkgconfig clang-devel git
```
`build-essential`/`gcc`/`gcc-c++` gives you `cc`/`c++`, which is all the C/C++
toolchain requirement above means here — nothing exotic, this is the easy
platform.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -fsSL https://fnm.vercel.app/install | bash   # or your Node manager of choice
corepack enable
```

## macOS

```bash
xcode-select --install        # C/C++ toolchain (clang) + git
brew install cmake node pnpm just
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Xcode Command Line Tools alone satisfy the C/C++ toolchain requirement — no
separate LLVM/Clang install needed on macOS.

## Windows

This is the platform every dependency above turns into a real fight, because
Windows has no C/C++ toolchain by default. **Do these in order**; skipping the
ARM64 or Clang component if you're on Windows-on-ARM (Snapdragon-based
laptops) is the single most time-consuming mistake to make here.

1. **Rust** — install via https://rustup.rs (choose the `-msvc` toolchain, not
   `-gnu`).
2. **Visual Studio Build Tools 2022** — https://visualstudio.microsoft.com/downloads/
   (the free "Build Tools" installer, not the full IDE). In the installer,
   select the **"Desktop development with C++"** workload, which pulls in:
   - The MSVC C++ compiler/linker (`cl.exe`, `link.exe`) — without this,
     `cargo build` fails immediately with a linker-not-found error.
   - **If you're on Windows ARM64**: also explicitly check
     **"C++ ARM64 build tools"** under the workload's optional components —
     it is *not* selected by default even on an ARM64 host, and its absence
     produces a much more confusing failure (`cl.exe`/`link.exe` exist but
     target the wrong architecture).
   - **"C++ Clang Compiler for Windows"** — also an optional component under
     the same workload, and required regardless of CPU architecture:
     `aws-lc-sys`/`ring`'s Windows build explicitly refuses plain MSVC `cl.exe`
     for some of their assembly/C sources and requires `clang`/`clang-cl`.
   You can add any of the above later via **Visual Studio Installer → Modify**
   without reinstalling everything.
3. **CMake** — https://cmake.org/download (or `winget install Kitware.CMake`).
   Needed for `llama-cpp-sys-2`'s `llama.cpp` build.
4. **Ninja** — already bundled inside Visual Studio Build Tools at
   `VC\Tools\Llvm\ARM64\bin\` (Clang) and
   `Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\` (Ninja itself); no
   separate install needed, but **on ARM64 you must point `CMAKE_GENERATOR`
   at Ninja explicitly** — CMake's default Visual Studio generator invokes
   plain `cl.exe`, and `llama.cpp`'s own `CMakeLists.txt` hard-refuses MSVC on
   ARM with "MSVC is not supported for ARM, use clang".
5. **Node.js + pnpm** — https://nodejs.org, then `corepack enable`.
6. **Windows Smart App Control** — if it's turned on (Settings → Privacy &
   security → Windows Security → App & browser control), it silently blocks
   freshly-compiled, unsigned executables from running — including your own
   build's `build.rs` scripts, which makes `cargo build` fail with
   `os error 4551` for no apparent reason. **Turning it off requires a
   reboot to fully take effect**, and Microsoft does not allow turning it
   back on without reinstalling Windows — know that before you flip it.

### Windows ARM64 build environment variables

On Windows ARM64 specifically, set these before `cargo build` (adjust the
Visual Studio path if yours differs — this assumes the free Build Tools
edition; a full VS install uses a different base path):

```powershell
$vsLlvm = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\Llvm\ARM64\bin"
$env:PATH = "C:\Program Files\CMake\bin;$vsLlvm;C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja;$env:PATH"
$env:CC = "$vsLlvm\clang-cl.exe"
$env:CXX = "$vsLlvm\clang-cl.exe"
$env:AR = "$vsLlvm\llvm-lib.exe"
$env:CXXFLAGS = "/EHsc"          # llama.cpp's C++ sources need exceptions enabled
$env:CMAKE_GENERATOR = "Ninja"   # forces the ARM64-safe generator instead of the VS/MSVC one
```
If you're building from Git Bash rather than PowerShell, also set
`MSYS_NO_PATHCONV=1` and `MSYS2_ARG_CONV_EXCL="*"` — Git Bash's MSYS layer
otherwise mangles a bare `/EHsc`-style flag into a fake Windows path.

On Windows **x64**, the plain MSVC toolchain (`cl.exe`) works without the
Clang/Ninja detour — only ARM64 needs the above.

## Building

Once dependencies are installed:

```bash
# Backend
cargo build --release -p indra-cli --bin indra

# Desktop UI (from repo root)
cd ui && pnpm install
cd desktop && pnpm run start-gui   # dev mode, builds + launches
```

See `justfile` for the `just release-binary` / `just run-ui` recipes that
wrap the above, and `AGENTS.md` for the full command reference.
