<div align="center">

# INDRA

**Sovereign On-Premise Agentic AI Workbench**

_Open-weight multimodal LLMs for confidential industrial work — nothing leaves your premises_

<p align="center">
  <img src="https://img.shields.io/badge/runs-100%25%20local-success" alt="Runs fully local">
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey" alt="Platforms">
</p>

</div>

## What INDRA is

Refineries, PSUs, defence-linked manufacturing and government offices produce a
lot of routine but sensitive knowledge work — approval notes, board decks,
engineering calculations, internal tooling code, review of scanned drawings and
inspection reports. None of it can go through a cloud assistant, because the
underlying material is confidential: P&IDs, financials, vendor negotiations,
unreleased designs, internal correspondence.

So the work gets done by hand, or the confidential material quietly gets pasted
into a public tool anyway.

INDRA is the third option: a self-hosted, air-gapped AI workbench that runs
entirely on your own GPU server, and behaves like the assistants people
actually want to use.

## What it does

**Runs fully on-premise.** No external calls at any point. Not as a claim — the
workbench carries a live sovereignty indicator on every screen, backed by a real
egress log, and ships an interactive probe box so a sceptic can type any URL and
watch it get blocked and recorded.

**Picks the right model for the job.** Multiple open-weight models loaded at
once, selected automatically by what the task actually needs — a coding request
routed differently from a document summary. New models drop in without
redesigning anything.

**Acts like an agent, not a chatbot.** Plans multi-step work, calls local tools
(file read/write, sandboxed code execution, document search), observes results,
and iterates toward a real deliverable instead of answering once and stopping.
The plan is visible while it runs, including when it gets revised mid-task.

**Handles more than text.** Scanned PDFs, handwritten notes, engineering
drawings, P&IDs and photographs, read through on-device OCR and vision models.

**Grounds answers in your own documents.** A local knowledge base over your
manuals, SOPs and past correspondence — with box-level citations back to the
source page, so every claim can be checked.

**Produces real files.** Approval notes, Word/Excel/PowerPoint, working code,
calculations with the steps shown — not just chat replies.

## One-command run

Builds the backend and launches the desktop app together:

```bash
just run-ui
```

That is the whole thing — backend binary and UI, one command, on Linux, macOS
and Windows. First run compiles the Rust backend, so give it a few minutes;
after that it is near-instant.

**Prerequisites:** Rust, Node 20+, pnpm, CMake and a C/C++ toolchain.
[`DEPENDENCIES.md`](DEPENDENCIES.md) lists exactly what to install per platform
— including the Windows specifics that are easy to get wrong. A CI job installs
only what that file prescribes on all three OSes and builds from scratch, so it
stays honest.

Don't want a host toolchain at all? Run the backend in a container instead:

```bash
cp .env.docker.example .env    # set a secret
docker compose up --build
```

See [`docs/DOCKER.md`](docs/DOCKER.md).

## Using it

The left rail is the whole app: **Work** (the conversation), **Models**,
**Sources**, **Memory**, **Trace**, **Sovereignty**.

In the composer:
- `/` — run an installed skill
- `//` — hand the task to a specialist agent
- **Auto / Manual** — whether the agent acts on its own or asks before each action

Workspace folders are granted explicitly: pick specific folders (each
read-only or write-with-approval), or grant full access deliberately. The model
only ever sees what you've granted.

`⌘K` / `Ctrl+K` opens the command palette, which reaches everything.

## Built on

Rust backend, Electron + React desktop client, and the Agent Client Protocol
between them. Local inference through llama.cpp, with Ollama and
OpenAI-compatible local endpoints also supported. Tools and integrations attach
over the Model Context Protocol.

## Project docs

- [`DEPENDENCIES.md`](DEPENDENCIES.md) — per-platform install requirements
- [`docs/DOCKER.md`](docs/DOCKER.md) — containerized backend deployment
- [`AGENTS.md`](AGENTS.md) — contributor and build command reference
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute

---

Built for SIH Problem Statement 26117 — Sovereign On-Premise Agentic AI
Workbench using Open-Weight Multimodal LLMs for Confidential Industrial Work,
Mangalore Refinery and Petrochemicals Limited (MRPL).

<sub>Derived from the goose project. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).</sub>
