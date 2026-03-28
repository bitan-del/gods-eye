# Gods Eye — The AI Gateway That Fixes Everything OpenClaw Got Wrong

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/bitan-del/gods-eye/main/docs/assets/godseye-logo-text-dark.svg">
        <img src="https://raw.githubusercontent.com/bitan-del/gods-eye/main/docs/assets/godseye-logo-text.svg" alt="Gods Eye" width="500">
    </picture>
</p>

<p align="center">
  <strong>Built in India. Built to be unstoppable.</strong>
</p>

<p align="center">
  <a href="https://github.com/bitan-del/gods-eye/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/bitan-del/gods-eye/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/bitan-del/gods-eye/releases"><img src="https://img.shields.io/github/v/release/bitan-del/gods-eye?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Made_in-India-FF9933?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSIjMDAwMDgwIi8+PC9zdmc+" alt="Made in India">
</p>

---

**Gods Eye** is a personal AI gateway you run on your own hardware. It connects to 25+ messaging channels, speaks and listens across macOS/iOS/Android, and gives you a single AI assistant that actually works — without the chaos, cost explosions, and security nightmares of alternatives like OpenClaw.

We studied every complaint users had about OpenClaw and competitors, researched the best solutions from LiteLLM, RouteLLM, Mem0, LlamaFirewall, and Flutter Doctor, then built **24 production modules with 635+ tests** to solve all 8 major pain points.

[Website](https://gods-eye.org) · [Docs](https://docs.gods-eye.org) · [Getting Started](https://docs.gods-eye.org/start/getting-started) · [Discord](https://discord.gg/clawd)

---

## Install (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/bitan-del/gods-eye/main/scripts/install.sh | bash
```

The installer handles everything: Node.js, dependencies, system health checks, and walks you through setup with the quickstart wizard.

**Or install manually:**

```bash
npm install -g godseye@latest
godseye quickstart
```

Runtime: **Node 22+** (Node 24 recommended).

---

## What Makes Gods Eye Different

### The 8 Problems We Solved

Every AI gateway out there (OpenClaw, etc.) suffers from the same pain points. We didn't just patch them — we engineered proper solutions backed by research from the best in the industry.

| Problem                   | What Others Do                           | What Gods Eye Does                                                                              |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Setup Hell**            | 47-step manual config, cryptic errors    | `godseye quickstart` — one-command wizard with Flutter-style `godseye doctor` health checks     |
| **Cost Explosions**       | No budget controls, $200 surprise bills  | LiteLLM-style token budgets (per-session/hour/day) + RouteLLM-style smart model routing         |
| **Context Amnesia**       | Compaction destroys critical info        | Mem0-style pinned memory + structured JSON compaction that never loses key facts                |
| **Runaway Agents**        | Infinite loops, no guardrails            | 3-state circuit breaker + progressive autonomy (supervised -> semi-auto -> autonomous)          |
| **Security Gaps**         | No input scanning, prompt injection risk | Meta LlamaFirewall-inspired 3-layer runtime firewall (input + execution + output)               |
| **Over-Permissioning**    | Root-level access by default             | OWASP-aligned permission profiles (minimal/standard/power/unrestricted) + 5-layer audit trail   |
| **Not Beginner-Friendly** | "Read the docs" is the onboarding        | Interactive tutorial, Elm-style friendly errors (E001-E010), and 6 ready-to-use agent templates |
| **Channel Failures**      | Silent disconnects, no diagnostics       | Per-channel health diagnostics with auto-fix hints for Telegram/Discord/Slack/WhatsApp/Signal   |

---

## Architecture at a Glance

```
WhatsApp / Telegram / Slack / Discord / Signal / iMessage / Teams / Matrix / 25+ channels
               |
               v
+-------------------------------+     +---------------------------+
|        Gods Eye Gateway       |     |    Gods Eye Online        |
|      (local control plane)    |<--->|   (AI Creative Suite)     |
|    ws://127.0.0.1:18789       |     |   MCP Bridge :18790       |
+-------------------------------+     +---------------------------+
               |
    +----------+----------+
    |          |          |
    v          v          v
 Pi Agent   CLI Tools   Apps
 (RPC)      (godseye)   (macOS/iOS/Android)
```

---

## The 24 Modules (635+ Tests, Zero Compromises)

### Phase 1 — Setup & Security Hardening

> _"If setup is hard, users never get to the good stuff."_

- **Doctor Framework** — Flutter-style system health checks with auto-fix (Node, ports, Docker, disk, config)
- **API Key Validation** — 3-step validation: format regex, API probe, capability check
- **Auto Token Generation** — Cryptographically secure gateway tokens (no more "change-me" defaults)
- **Network Exposure Audit** — Detect dangerous bind configurations and Docker exposure
- **Supply Chain Integrity** — SHA256 verification + prompt injection detection in MCP tool descriptions
- **Agent Firewall** — Meta LlamaFirewall-inspired 3-layer runtime protection (input scanning, execution auditing, output leak detection)

### Phase 2 — Cost Control & Agent Behavior

> _"Your AI should work for you, not burn your wallet."_

- **Token Budget Engine** — LiteLLM-style per-session, per-hour, per-day spending caps with configurable warning thresholds
- **Smart Model Router** — RouteLLM-style complexity classification that routes simple queries to cheap models and complex ones to powerful models
- **Semantic Cache** — GPTCache-style two-tier caching (exact hash + trigram Jaccard similarity) with LRU eviction
- **Loop Detection v2** — 3-state circuit breaker (closed/degraded/open), objective drift detection, and tool repetition analysis
- **Autonomy Governor** — Progressive trust system: supervised -> semi-autonomous -> autonomous, with automatic escalation at trust score thresholds
- **Task Verification** — Structured completion checking with accept/retry/escalate recommendations

### Phase 3 — Memory, Context & Permissions

> _"An AI that forgets what you told it is an AI that wastes your time."_

- **Context Health Monitor** — Real-time token utilization tracking with warning/critical thresholds and estimated turns remaining
- **Pinned Memory** — Mem0-style persistent facts that survive compaction, with priority scoring, search, and /remember /forget commands
- **Structured Compaction** — Factory.ai-style anchored iterative merging using typed JSON sections (not free-text summaries)
- **Session Checkpointing** — LangGraph-style save/resume/time-travel with full diff support
- **Permission Profiles** — OWASP-aligned presets (minimal/standard/power/unrestricted) with glob-pattern tool policies and path restrictions
- **Permission Audit Trail** — 5-layer structured logging (Identity -> Input -> Reasoning -> Execution -> Outcome) with automatic secret redaction

### Phase 4 — Beginner Experience & Channel Diagnostics

> _"If your grandma can't set it up, your onboarding is broken."_

- **Quickstart Command** — One-command setup wizard: detects environment, validates API keys in real-time, generates config, starts gateway
- **Elm-Style Friendly Errors** — Color-coded error catalog (E001-E010) with plain-English problems and actionable fix hints
- **Agent Templates** — 6 ready-to-use configs: code-reviewer, research-assistant, devops-automator, content-writer, data-analyst, security-auditor
- **Interactive Tutorial** — 7-step guided walkthrough with progress tracking and completion percentage
- **Channel Diagnostics** — Per-channel health checks for Telegram, Discord, Slack, WhatsApp, Signal — with auto-fix suggestions
- **Unified Auth Error Handler** — Provider-specific error messages with remediation links and exponential backoff retry logic

---

## Quick Start

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/bitan-del/gods-eye/main/scripts/install.sh | bash

# Or if already installed:
godseye quickstart          # guided setup wizard
godseye doctor              # system health check
godseye tutorial            # interactive walkthrough

# Start the gateway
godseye gateway --port 18789 --verbose

# Talk to your assistant
godseye agent --message "Hello from Gods Eye" --thinking high

# Send a message via any channel
godseye message send --to +1234567890 --message "Hello from Gods Eye"
```

---

## Gods Eye Studio

The unified creative brain for your assistant — image generation, video generation, brand intelligence, and content calendar management.

```bash
godseye agent --message "generate a hero image for my landing page"
godseye agent --message "scan my brand from https://example.com"
godseye agent --message "show my content calendar for this week"
```

**BYOK (bring your own keys):** Studio uses your API keys for fal.ai, Google Gemini, and OpenAI. Set them during `godseye quickstart` or via `godseye config set`.

Docs: [Getting started](https://docs.gods-eye.org/studio/getting-started) · [Brain architecture](https://docs.gods-eye.org/studio/brain) · [Creative providers](https://docs.gods-eye.org/studio/providers)

---

## Gods Eye Online (Web App)

The cloud-hosted creative suite that connects to your local Gods Eye gateway via MCP bridge:

- **Image Generation** — Gemini Flash, Flux Ultra, SeedDream v4.5
- **Video Generation** — Kling 3 Pro, Veo 3.1 Fast
- **Chat Intelligence** — Gemini 3.x, Kimi K2.5
- **Brand DNA Scanner** — Extract colors, fonts, tone from any website
- **Content Calendar** — Plan and schedule across 10+ social platforms

Connect your local gateway to Gods Eye Online:

```bash
godseye quickstart  # sets up the MCP bridge automatically
```

---

## Supported Channels (25+)

WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, BlueBubbles (iMessage), iMessage (legacy), IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, WebChat, macOS, iOS, Android.

Every channel gets per-channel diagnostics:

```bash
godseye doctor  # checks all connected channels
```

---

## From Source (Development)

```bash
git clone https://github.com/bitan-del/gods-eye.git
cd gods-eye

pnpm install
pnpm build

pnpm godseye quickstart

# Dev loop (auto-reload)
pnpm gateway:watch

# Run tests (635+ tests)
pnpm test
```

---

## Companion Apps

- **[macOS App](https://docs.gods-eye.org/platforms/macos)** — Menu bar control plane, Voice Wake/PTT, Talk Mode overlay, WebChat, debug tools
- **[iOS Node](https://docs.gods-eye.org/platforms/ios)** — Canvas, Voice Wake, Talk Mode, camera, screen recording, Bonjour pairing
- **[Android Node](https://docs.gods-eye.org/platforms/android)** — Chat, voice, Canvas, camera/screen recording, device commands

---

## Security

Gods Eye treats security as a first-class citizen, not an afterthought:

- **3-layer Agent Firewall** — Input scanning (10 injection patterns + base64 detection), execution auditing (privilege escalation, exfiltration, dangerous sequences), output scanning (API key leaks, sensitive paths, XSS)
- **Supply Chain Verification** — SHA256 integrity checks + prompt injection detection in MCP tool descriptions
- **Permission Profiles** — OWASP-aligned presets so you never over-permission your agent
- **5-layer Audit Trail** — Every action logged with automatic secret redaction
- **Network Exposure Audit** — Detects risky bind configurations before they become breaches
- **DM Pairing** — Unknown senders get a pairing code; no message processing until approved

Full security guide: [Security](https://docs.gods-eye.org/gateway/security)

---

## Made in India

Gods Eye is proudly built in India. We believe the next generation of AI infrastructure should come from everywhere, not just Silicon Valley. This project represents Indian engineering at its finest — solving real problems with world-class solutions, backed by rigorous testing and research from the best open-source projects globally.

**24 modules. 635+ tests. 12,000+ lines of production code. Zero compromises.**

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built with intensity in India by <a href="https://github.com/bitan-del">@bitan-del</a></sub>
</p>
