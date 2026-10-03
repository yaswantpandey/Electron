# Sudarshan AI

AI-assisted, local-first security research and bug bounty toolkit.  
Runs real industry-standard tools against authorized targets, then uses a
**local Ollama LLM** to produce structured, OWASP-mapped findings reports.

Everything stays on your machine — no scan data leaves the host.

**Model:** `hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M`

---

## Interfaces

Sudarshan ships two ways to use it — both talk to the same backend:

| Interface | How to run | When to use |
|---|---|---|
| **Web GUI** | `python api_server.py` → open `http://localhost:5174` | Everyday use — full UI in any browser |
| **CLI** | `python main.py --mode url --target …` | Scripting, automation, headless |

---

## Prerequisites

- **Python 3.10+** with pip
- **[Ollama](https://ollama.com)** running locally (`ollama serve`)
- **Go** (for ProjectDiscovery tools — subfinder, httpx, katana, nuclei, ffuf)

---

## Setup

```bash
# 1. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux / macOS

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Pull the model
ollama run hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M
```

Install external security tools (subfinder, httpx, katana, nuclei, ffuf)
per **Section 4 & 5** of `DOCUMENTATION.md`.

---

## Web GUI (recommended)

```bash
python api_server.py
```

Open **http://localhost:5174** in any browser. No Electron, no npm, no build step.

### What the UI gives you

- **New scan** — mode selector, target input, advanced options, authorization gate
- **Running** — live per-tool status rows, real-time log stream, animated progress bar
- **Report** — rendered Markdown viewer, one-click `.md` download
- **History** — every past report listed, click to re-open
- **OWASP coverage** — Top 10 (2021) tool coverage map

---

## CLI

```bash
# Scan a live authorized target
python main.py --mode url --target https://your-authorized-target.com

# Scan your local dev app
python main.py --mode localhost --target http://localhost:3000

# Static analysis of a codebase (no live requests)
python main.py --mode codebase --target /path/to/project

# Enable intrusive SQL injection testing (authorized targets only)
python main.py --mode url --target https://target.com --enable-sqlmap

# Custom wordlist
python main.py --mode url --target https://target.com --wordlist /path/to/wordlist.txt

# Non-default Ollama instance
python main.py --mode url --target https://target.com --ollama-host http://192.168.1.10:11434
```

### CLI flags

| Flag | Default | Description |
|---|---|---|
| `--mode` | *(required)* | `url`, `localhost`, or `codebase` |
| `--target` | *(required)* | URL or directory path |
| `--enable-sqlmap` | off | Enable intrusive sqlmap SQL injection test |
| `--wordlist` | from `config.yaml` | Custom wordlist path for ffuf |
| `--skip-confirm` | off | Skip the authorization confirmation prompt |
| `--ollama-host` | `http://localhost:11434` | Ollama server URL |

---

## Scan Pipeline

Each run executes four phases automatically:

1. **Recon** — subdomain enumeration (subfinder), live host detection (httpx), endpoint crawling (katana)
2. **Vulnerability scanning** — nuclei templates, directory fuzzing (ffuf), optional sqlmap; or semgrep / gitleaks / pip-audit / npm audit in codebase mode
3. **AI analysis** — WhiteRabbitNeo reads raw tool output and produces OWASP-mapped findings with severity ratings and remediation notes
4. **Report** — timestamped Markdown saved to `reports/sudarshan_report_<target>_<timestamp>.md`

### Mode coverage

| Mode | Tools run |
|---|---|
| `url` | subfinder → httpx → katana → nuclei → ffuf → sqlmap (opt-in) → AI |
| `localhost` | httpx → katana → nuclei → ffuf → AI |
| `codebase` | semgrep → gitleaks → pip-audit → npm audit → AI |

---

## OWASP Top 10 (2021) Coverage

| ID | Category | Tool |
|---|---|---|
| A01 | Broken Access Control | ffuf |
| A02 | Cryptographic Failures | nuclei, testssl.sh (manual) |
| A03 | Injection (SQLi / XSS) | sqlmap, nuclei |
| A04 | Insecure Design | semgrep |
| A05 | Security Misconfiguration | nuclei, ffuf |
| A06 | Vulnerable & Outdated Components | nuclei, pip-audit, npm audit |
| A07 | Authentication Failures | nuclei, manual |
| A08 | Software & Data Integrity Failures | gitleaks |
| A09 | Logging & Monitoring Failures | manual review |
| A10 | SSRF | nuclei |

---

## Project Structure

```
sudarshan-project/
├── api_server.py              # Flask backend + web UI server (port 5174)
├── main.py                    # CLI entry point & scan orchestrator
├── config.yaml                # Scan defaults (model, severity, wordlist, …)
├── requirements.txt           # Python dependencies
├── README.md                  # This file
├── DOCUMENTATION.md           # Full setup & usage guide
├── sudarshan-instructions.md  # AI behavior rules / system prompt
├── tools.md                   # External tool reference
│
├── web/                       # Standalone browser UI
│   ├── index.html             # App shell & styles
│   └── app.js                 # All front-end logic (no build step)
│
├── renderer/                  # Electron renderer (legacy, still works)
│   ├── index.html
│   ├── renderer.js
│   └── marked.min.js          # Shared by both web and Electron UIs
│
├── modules/
│   ├── recon.py               # subfinder, httpx, katana wrappers
│   ├── web_scan.py            # nuclei, ffuf, sqlmap wrappers
│   ├── code_scan.py           # semgrep, gitleaks, pip-audit, npm audit
│   ├── ollama_client.py       # Local LLM interface (Ollama)
│   └── report.py              # Markdown report builder
│
└── reports/                   # Generated reports (auto-created)
```

---

## Python Dependencies

| Package | Version | Purpose |
|---|---|---|
| `flask` | ≥ 3.1.0 | Web server & REST API |
| `flask-cors` | ≥ 6.0.0 | Cross-origin requests (Electron renderer) |
| `requests` | 2.31.0 | HTTP client |
| `pyyaml` | 6.0.1 | Config file parsing |
| `rich` | 13.7.1 | Terminal output formatting |
| `click` | 8.1.7 | CLI argument parsing |
| `ollama` | 0.1.9 | Ollama Python client |
| `semgrep` | 1.62.0 | Static code analysis |
| `pip-audit` | 2.7.2 | Python dependency vulnerability checks |

---

## Configuration (`config.yaml`)

```yaml
ollama:
  model: "hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M"
  host:  "http://localhost:11434"

scan_defaults:
  nuclei_severity: "low,medium,high,critical"
  ffuf_wordlist:   "/usr/share/wordlists/dirb/common.txt"
  enable_sqlmap:   false

report:
  output_dir: "reports"
```

All CLI flags and web UI fields override these defaults per run.

---

## ⚠️ Legal & Ethics

**Only test targets you own or have explicit written authorization to test.**

- All AI findings are unverified leads — manually confirm before submitting to a bug bounty program.
- Keep `--enable-sqlmap` off unless you have a likely injection point and confirmed authorization.
- Respect bug bounty program scope, rate limits, and rules of engagement.
- Unauthorized testing may violate laws including the CFAA.

See `DOCUMENTATION.md` Section 10 for full guidelines.
