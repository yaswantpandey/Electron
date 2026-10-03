"""
report.py — Builds the final Markdown report from scan + AI analysis results.
Output: reports/sudarshan_report_<target>_<timestamp>.md
"""

import os
import re
import textwrap
from datetime import datetime, timezone
from rich.console import Console

console = Console()

REPORT_DIR = "reports"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_filename(target: str) -> str:
    """Strip URL scheme and replace non-alphanumeric chars for safe filenames."""
    cleaned = re.sub(r"https?://", "", target)
    cleaned = re.sub(r"[^\w\-.]", "_", cleaned)
    return cleaned[:60]


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _section(title: str, level: int = 2) -> str:
    prefix = "#" * level
    return f"\n{prefix} {title}\n"


# ---------------------------------------------------------------------------
# Report builder
# ---------------------------------------------------------------------------

def build_report(
    target: str,
    mode: str,
    model: str,
    scan_results: dict,
    analyses: dict,
    executive_summary: str,
    output_dir: str = REPORT_DIR,
) -> str:
    """
    Assemble and write the Markdown report.

    Parameters
    ----------
    target           : the scan target (URL or path)
    mode             : 'url' | 'localhost' | 'codebase'
    model            : Ollama model used for analysis
    scan_results     : {'tool_name': 'raw output', ...}
    analyses         : {'tool_name': 'AI analysis text', ...}
    executive_summary: consolidated summary from the AI
    output_dir       : directory to write the report file into

    Returns the path to the written report file.
    """
    os.makedirs(output_dir, exist_ok=True)

    ts = _timestamp()
    safe_target = _safe_filename(target)
    filename = f"sudarshan_report_{safe_target}_{ts}.md"
    filepath = os.path.join(output_dir, filename)

    lines: list[str] = []

    # ── Title & metadata ────────────────────────────────────────────────────
    lines.append("# Sudarshan AI — Security Scan Report\n")
    lines.append(f"| Field | Value |")
    lines.append(f"|---|---|")
    lines.append(f"| **Target** | `{target}` |")
    lines.append(f"| **Mode** | `{mode}` |")
    lines.append(f"| **Model** | `{model}` |")
    lines.append(f"| **Generated** | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} |")
    lines.append(f"| **Status** | ⚠️ Findings are unverified until manually confirmed |")
    lines.append("")

    # ── Legal / authorization reminder ──────────────────────────────────────
    lines.append("> **Authorization reminder:** This report was generated against")
    lines.append(f"> `{target}`. Ensure you have explicit written authorization to test")
    lines.append("> this target before sharing or acting on any findings.")
    lines.append("")

    # ── Executive Summary ───────────────────────────────────────────────────
    lines.append(_section("Executive Summary"))
    lines.append(executive_summary or "_No summary generated._")
    lines.append("")

    # ── OWASP Coverage Map ──────────────────────────────────────────────────
    lines.append(_section("OWASP Top 10 (2021) Coverage"))
    owasp_map = [
        ("A01", "Broken Access Control",              "ffuf"),
        ("A02", "Cryptographic Failures",             "nuclei / testssl.sh (manual)"),
        ("A03", "Injection (SQLi / XSS)",             "sqlmap, nuclei"),
        ("A04", "Insecure Design",                    "semgrep (codebase mode)"),
        ("A05", "Security Misconfiguration",          "nuclei, ffuf"),
        ("A06", "Vulnerable & Outdated Components",   "nuclei, pip-audit, npm audit"),
        ("A07", "Authentication Failures",            "nuclei, manual"),
        ("A08", "Software & Data Integrity Failures", "gitleaks"),
        ("A09", "Logging & Monitoring Failures",      "manual review"),
        ("A10", "SSRF",                               "nuclei"),
    ]
    lines.append("| ID | Category | Primary Tool(s) |")
    lines.append("|---|---|---|")
    for cid, cname, tools in owasp_map:
        lines.append(f"| {cid} | {cname} | {tools} |")
    lines.append("")

    # ── Detailed findings by tool ────────────────────────────────────────────
    lines.append(_section("Detailed Findings by Tool"))

    all_tools = list(scan_results.keys())
    if not all_tools:
        lines.append("_No scan results recorded._\n")
    else:
        for tool in all_tools:
            lines.append(_section(f"Tool: `{tool}`", level=3))

            # Raw output (collapsed)
            lines.append("<details>")
            lines.append(f"<summary>Raw output — {tool}</summary>\n")
            lines.append("```")
            raw = scan_results.get(tool, "(no output)")
            lines.append(raw[:8000] + (" [truncated]" if len(raw) > 8000 else ""))
            lines.append("```")
            lines.append("</details>\n")

            # AI analysis
            lines.append("**AI Analysis (Sudarshan)**\n")
            analysis = analyses.get(tool, "_Analysis not available._")
            lines.append(analysis)
            lines.append("")
            lines.append("---")
            lines.append("")

    # ── Next steps ──────────────────────────────────────────────────────────
    lines.append(_section("Recommended Next Steps"))
    lines.append(textwrap.dedent("""\
        1. **Manually verify** every finding marked Medium severity or above.
        2. For confirmed findings, draft a bug bounty report:
           - Impact statement
           - Step-by-step reproduction
           - Proof-of-concept (screenshot / request-response)
           - Remediation recommendation
        3. Work through remaining OWASP categories not yet covered by this scan.
        4. Rerun with `--enable-sqlmap` only after confirming likely injection points
           and ensuring you are authorized to run intrusive tests.
    """))

    # ── Footer ──────────────────────────────────────────────────────────────
    lines.append("---")
    lines.append(
        "_Report generated by Sudarshan AI. "
        "All findings must be manually verified before submission or disclosure._"
    )

    # ── Write file ──────────────────────────────────────────────────────────
    content = "\n".join(lines)
    with open(filepath, "w", encoding="utf-8") as fh:
        fh.write(content)

    return filepath
