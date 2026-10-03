# Sudarshan AI — Recommended Tools

A curated, OWASP Top 10–aligned toolset. All tools are free/open-source,
actively maintained, and scriptable — so Sudarshan (your AI co-pilot) can
read their output and reason about it.

Prerequisite: Go (for ProjectDiscovery tools) and Python 3.10+.
```bash
sudo apt update && sudo apt install -y golang-go python3-pip git
```

---

## 1. Recon Layer (Phase 1)

| Tool | Purpose | Install |
|---|---|---|
| **subfinder** | Passive subdomain enumeration | `go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` |
| **amass** | Deep subdomain + asset discovery | `o install -v github.com/owasp-amass/amass/v4/...@master` |
| **httpx** | Probe live hosts, get tech/status/title | `go install github.com/projectdiscovery/httpx/cmd/httpx@latest` |
| **katana** | Crawl site, discover endpoints/JS files | `go install github.com/projectdiscovery/katana/cmd/katana@latest` |
| **waybackurls** | Pull historical URLs from Wayback Machine | `go install github.com/tomnomnom/waybackurls@latest` |
| **gau** | Get All URLs (Wayback + Common Crawl + AlienVault) | `go install github.com/lc/gau/v2/cmd/gau@latest` |

**Why these:** fast, passive-first (low noise on the target), and output
plain text/JSON that Sudarshan can directly parse and reason over.

---

## 2. Vulnerability Scanning (Phase 2 — OWASP Top 10)

| Tool | Best for (OWASP mapping) | Install |
|---|---|---|
| **nuclei** | A05 Misconfig, A06 Vulnerable Components, general CVE templates | `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` |
| **sqlmap** | A03 Injection (SQLi) | `pip install sqlmap` or `git clone https://github.com/sqlmapproject/sqlmap.git` |
| **ffuf** | A01 Broken Access Control, A05 Misconfig (dir/param fuzzing) | `go install github.com/ffuf/ffuf/v2@latest` |
| **dalfox** | A03 Injection (XSS specifically) | `go install github.com/hahwul/dalfox/v2@latest` |
| **nikto** | A05 Misconfig (server-level scan) | `sudo apt install nikto` |
| **testssl.sh** | A02 Cryptographic Failures (TLS/SSL config) | `git clone https://github.com/drwetter/testssl.sh.git` |
| **jwt_tool** | A02/A07 (JWT auth weaknesses) | `git clone https://github.com/ticarpi/jwt_tool.git` |

---

## 3. Manual / Interactive Testing

| Tool | Purpose | Install |
|---|---|---|
| **Burp Suite (Community)** | Intercepting proxy, manual request tampering — essential for A01, A07, A08 | [portswigger.net/burp/communitydownload](https://portswigger.net/burp/communitydownload) |
| **OWASP ZAP** | Free alternative to Burp, has active+passive scan modes | `sudo apt install zaproxy` |
| **Browser DevTools + FoxyProxy** | Manual session/cookie/token inspection | Browser extension |

---

## 4. Component / Dependency Checks

| Tool | OWASP mapping | Install |
|---|---|---|
| **retire.js** | A06 Vulnerable Components (outdated JS libs) | `npm install -g retire` |
| **wappalyzer (CLI)** | Tech stack fingerprinting | `npm install -g wappalyzer` |
| **trufflehog** | A08 Data Integrity (leaked secrets/keys in repos/JS) | `go install github.com/trufflesecurity/trufflehog/v3@latest` |

---

## 5. Logging / Reporting Support

| Tool | Purpose |
|---|---|
| **nuclei -me / jsonl output** | Structured findings Sudarshan can parse directly |
| **Markdown templates (your Phase 1 report format)** | Human-readable report for bug bounty submission |

---

## What I'd Prioritize First (My Recommendation)

For your project specifically — AI-assisted, step-by-step, OWASP-first —
start with this minimal, high-value stack before adding anything else:

1. **subfinder + httpx** → recon foundation (Phase 1)
2. **katana** → endpoint discovery feeding into every later phase
3. **nuclei** → broadest OWASP coverage per scan, output is clean JSON
   (easiest for Sudarshan to analyze)
4. **ffuf** → access control + misconfig testing (A01, A05)
5. **sqlmap** → injection testing (A03), only against confirmed injection points
6. **Burp Suite Community** → manual verification layer for everything
   automated tools flag (reduces false positives)

Everything else in this file, add only when a specific OWASP category needs it.

---

## How to Set This Up (Step by Step)

```bash
# 1. Install Go + Python prerequisites
sudo apt update && sudo apt install -y golang-go python3-pip git

# 2. Add Go bin to PATH (add this line to ~/.bashrc or ~/.zshrc)
export PATH=$PATH:$(go env GOPATH)/bin

# 3. Install core recon tools
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest

# 4. Install core scanning tools
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install github.com/ffuf/ffuf/v2@latest
pip install sqlmap

# 5. Update nuclei templates (do this regularly)
nuclei -update-templates

# 6. Verify installs
subfinder -version
httpx -version
nuclei -version
ffuf -V
```

Once these are installed, Sudarshan can start recommending real commands
against your authorized target, and you paste the real output back for
analysis — per the workflow in `sudarshan-instructions.md`.
