# Sudarshan AI — Complete Project Documentation

**An AI-assisted, local-first security research and bug bounty automation
toolkit, built around the OWASP Top 10 (2021) and powered by Ollama.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Philosophy & Rules](#2-core-philosophy--rules)
3. [Project Structure](#3-project-structure)
4. [Installation — Step by Step](#4-installation--step-by-step)
5. [Choosing & Installing an Ollama Model](#5-choosing--installing-an-ollama-model)
6. [Configuration](#6-configuration)
7. [Usage Guide](#7-usage-guide)
8. [OWASP Top 10 Testing Workflow](#8-owasp-top-10-testing-workflow)
9. [Understanding the Report](#9-understanding-the-report)
10. [Safety, Legal & Ethical Guidelines](#10-safety-legal--ethical-guidelines)
11. [Troubleshooting](#11-troubleshooting)
12. [Roadmap — What's Next](#12-roadmap--whats-next)

---

## 1. Project Overview

**Sudarshan AI** automates the repetitive parts of web application security
testing and bug bounty recon — running real, industry-standard tools
against a target, then using a **local LLM (via Ollama)** to read the raw
output and turn it into a structured, OWASP-mapped findings report.

Everything runs on your machine. No target data or scan output is sent to
any cloud API — the analysis model runs locally through Ollama.

**Three modes:**
| Mode | Use case |
|---|---|
| `url` | A live, authorized website (e.g. a bug bounty program target) |
| `localhost` | Your own app running locally during development |
| `codebase` | Full source code, scanned statically (no live requests) |

---

## 2. Core Philosophy & Rules

These rules are enforced in both the project's behavior and its system
instructions (`sudarshan-instructions.md`):

- **Authorization first.** The tool asks you to confirm authorization
  before running anything. Never point it at a target you don't own or
  don't have explicit permission to test.
- **No fake data.** Every finding comes from real tool output. If a tool
  finds nothing, the report says so — it never invents results.
- **Verify before you submit.** AI-generated analysis (especially from an
  uncensored model like WhiteRabbitNeo) is a *lead*, not a confirmed bug.
  Manually verify everything before submitting to a bug bounty program.
- **Tools over custom exploits.** Sudarshan orchestrates mature,
  community-maintained tools (nuclei, ffuf, sqlmap, semgrep, etc.) instead
  of generating exploit code from scratch.
- **Intrusive tests are opt-in.** sqlmap is disabled by default and must
  be explicitly enabled per run.

---

## 3. Project Structure

```
sudarshan-project/
├── main.py                 # CLI orchestrator — entry point
├── config.yaml             # Default model names, scan settings
├── requirements.txt        # Python dependencies
├── README.md                # Quick-start instructions
├── DOCUMENTATION.md        # This file — full guide
├── sudarshan-instructions.md  # AI behavior rules / system prompt
├── tools.md                 # Full external tool reference
├── modules/
│   ├── __init__.py
│   ├── recon.py            # subfinder, httpx, katana wrappers
│   ├── web_scan.py         # nuclei, ffuf, sqlmap wrappers
│   ├── code_scan.py        # semgrep, gitleaks, dependency checks
│   ├── ollama_client.py    # sends tool output to local LLM, gets analysis
│   └── report.py           # builds final Markdown report
└── reports/                 # generated reports land here (auto-created)
```

---

## 4. Installation — Step by Step

### Step 1 — System prerequisites
```bash
sudo apt update && sudo apt install -y golang-go python3-pip python3-venv git nodejs npm
```

### Step 2 — Set up Go's bin path (for ProjectDiscovery tools)
Add this to `~/.bashrc` or `~/.zshrc`, then `source` it:
```bash
export PATH=$PATH:$(go env GOPATH)/bin
```

### Step 3 — Install Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve   # run this in a separate terminal/tab, keep it running
```

### Step 4 — Set up the Python project
```bash
cd sudarshan-project
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 5 — Install the security tools
```bash
# Recon
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest

# Scanning
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install github.com/ffuf/ffuf/v2@latest
pip install sqlmap

# Codebase static analysis
pip install semgrep pip-audit
# gitleaks — download the binary for your OS from:
# https://github.com/gitleaks/gitleaks/releases

# Keep nuclei templates current
nuclei -update-templates
```

### Step 6 — Verify everything installed correctly
```bash
subfinder -version
httpx -version
katana -version
nuclei -version
ffuf -V
semgrep --version
ollama list
```

---

## 5. Choosing & Installing an Ollama Model

| Model | Best for | Pull command |
|---|---|---|
| `llama3.1` | General-purpose web scan analysis | `ollama pull llama3.1` |
| `deepseek-coder-v2` | Reading source code (`--mode codebase`) | `ollama pull deepseek-coder-v2` |
| WhiteRabbitNeo 8B v2.0 | More direct, security-focused (uncensored) analysis | see below |

### Installing WhiteRabbitNeo (optional, more offense-focused model)
```bash



```
This pulls and registers it in one step. Use the same string as your
`--model` value afterward. Treat its output with extra scrutiny — it's
less likely to hedge or refuse, so verify everything manually.

---

## 6. Configuration

`config.yaml` holds your defaults:
```yaml
ollama:
  default_model: "llama3.1"
  code_model: "deepseek-coder-v2"
  host: "http://localhost:11434"

scan_defaults:
  nuclei_severity: "low,medium,high,critical"
  ffuf_wordlist: "/usr/share/wordlists/dirb/common.txt"
  enable_sqlmap: false

report:
  output_dir: "reports"
```
CLI flags in `main.py` currently override these — editing this file is
mainly for your own reference and future automation.

---

## 7. Usage Guide

### Scan a live, authorized website
```bash
python main.py --mode url --target https://your-authorized-target.com --model llama3.1
```

### Scan your own localhost app
```bash
python main.py --mode localhost --target http://localhost:3000 --model llama3.1
```

### Scan a full codebase (static analysis, no live requests)
```bash
python main.py --mode codebase --target /path/to/project --model deepseek-coder-v2
```

### Enable the (intrusive) sqlmap pass
```bash
python main.py --mode url --target https://target.com --model llama3.1 --enable-sqlmap
```

### Use a custom wordlist for ffuf
```bash
python main.py --mode url --target https://target.com --model llama3.1 \
  --wordlist /path/to/your/wordlist.txt
```

Every run (unless `--skip-confirm` is passed) will ask:
```
Type 'yes' to confirm you are authorized:
```
Do not bypass this on targets you're unsure about.

---

## 8. OWASP Top 10 Testing Workflow

Work through categories in order. Don't try to "cover everything" in one
pass — go deep on one category, confirm or rule out findings, then move on.

| # | Category | Primary tools in this project |
|---|---|---|
| A01 | Broken Access Control | ffuf, manual testing (Burp Suite) |
| A02 | Cryptographic Failures | testssl.sh (add separately), manual header checks |
| A03 | Injection (SQLi/XSS) | sqlmap (opt-in), dalfox, nuclei |
| A04 | Insecure Design | manual review, semgrep (codebase mode) |
| A05 | Security Misconfiguration | nuclei, nikto, httpx tech-detect |
| A06 | Vulnerable Components | nuclei, retire.js, pip-audit/npm audit |
| A07 | Auth Failures | jwt_tool (add separately), manual session testing |
| A08 | Software/Data Integrity | gitleaks, trufflehog |
| A09 | Logging & Monitoring Failures | manual review — mostly a design/process gap |
| A10 | SSRF | nuclei templates, manual parameter testing |

**Per-category loop:**
1. Run the relevant Sudarshan scan (or targeted manual test).
2. Read the AI-generated analysis section for that tool in the report.
3. Manually verify any finding marked Medium severity or above.
4. If confirmed, draft the bug bounty report (impact, PoC, remediation).
5. Move to the next category.

---

## 9. Understanding the Report

Each run produces a timestamped file in `reports/`:
```
reports/sudarshan_report_<target>_<timestamp>.md
```

Structure:
- **Executive Summary** — consolidated view across all tools, prioritized.
- **Detailed Findings by Tool** — one section per tool, with the AI's
  OWASP mapping, severity, evidence, and remediation notes.

Treat every finding as **unverified until you manually confirm it.**

---

## 10. Safety, Legal & Ethical Guidelines

- Only ever point this at targets you own or have explicit written
  authorization to test (bug bounty program scope, signed engagement).
- Keep `--enable-sqlmap` off unless you've already identified a likely
  injection point and are authorized to test it — it sends a large
  volume of requests.
- Respect program-specific rate limits and out-of-scope rules — automated
  tools don't know a program's rules of engagement, you do.
- Don't rely on an uncensored model (like WhiteRabbitNeo) as a source of
  truth — use it for faster analysis, but verify everything yourself
  before acting on it or submitting a report.

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `[NOT INSTALLED] <tool>` in output | Install the tool per Section 4/5, or ignore if you don't need that category yet |
| Ollama connection error | Make sure `ollama serve` is running in another terminal |
| Analysis seems cut off / incomplete | Tool output was truncated for context length — raise `max_chars` in `modules/ollama_client.py`, or use a model with a larger context window |
| ffuf returns nothing | Check your wordlist path (`--wordlist`) exists and target URL is reachable |
| nuclei scan is very slow | Narrow `--severity` in `web_scan.py`, or scan a smaller target scope |

---

## 12. Roadmap — What's Next

- Business logic & API-specific testing (BOLA, rate limiting) — Phase 3
- Vulnerability chaining suggestions from the AI analysis layer
- Direct export to bug bounty platform report formats
- Optional web dashboard (only if you decide you want one — not required)

---

*This project is for authorized security research and bug bounty work
only. You are responsible for ensuring you have permission to test any
target you point it at.*
