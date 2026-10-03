"""
web_scan.py — Phase 2 OWASP vulnerability scan wrappers
Tools: nuclei, ffuf, sqlmap
"""

from __future__ import annotations

import subprocess
import shutil
import tempfile
import os
from rich.console import Console

console = Console()


def _tool_available(name: str) -> bool:
    return shutil.which(name) is not None


def _run(cmd: list[str], label: str, timeout: int = 600) -> str:
    console.print(f"[cyan]  → Running:[/cyan] {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
        if result.returncode != 0 and result.stderr:
            console.print(f"[yellow]  [WARN] {label} stderr:[/yellow] {result.stderr[:500]}")
        return output if output else "(no output)"
    except FileNotFoundError:
        return f"[NOT INSTALLED] {label} — install it per the documentation."
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT] {label} exceeded {timeout} s."
    except Exception as exc:
        return f"[ERROR] {label}: {exc}"


# ---------------------------------------------------------------------------
# nuclei — template-based vulnerability scanner
# ---------------------------------------------------------------------------

def run_nuclei(target: str, severity: str = "low,medium,high,critical") -> str:
    """
    Run nuclei against *target* using the installed community templates.
    Returns JSON-lines output as a single string.
    """
    if not _tool_available("nuclei"):
        return "[NOT INSTALLED] nuclei — see Section 4 of DOCUMENTATION.md"

    cmd = [
        "nuclei",
        "-u", target,
        "-severity", severity,
        "-silent",
        "-jsonl",           # structured output for the AI to parse
        "-timeout", "10",
        "-rate-limit", "50",
    ]
    return _run(cmd, "nuclei", timeout=900)


# ---------------------------------------------------------------------------
# ffuf — directory / parameter fuzzer
# ---------------------------------------------------------------------------

def run_ffuf(target: str, wordlist: str) -> str:
    """
    Fuzz directories and common parameters on *target*.
    Falls back to a built-in minimal wordlist if the specified one is missing.
    """
    if not _tool_available("ffuf"):
        return "[NOT INSTALLED] ffuf — see Section 4 of DOCUMENTATION.md"

    # Ensure the wordlist exists; if not, write a tiny built-in fallback
    if not os.path.isfile(wordlist):
        console.print(
            f"[yellow]  [WARN] Wordlist not found at {wordlist!r} — "
            "using built-in minimal list.[/yellow]"
        )
        wordlist = _write_builtin_wordlist()

    # Make sure the target URL has a FUZZ placeholder
    if "FUZZ" not in target:
        fuzz_url = target.rstrip("/") + "/FUZZ"
    else:
        fuzz_url = target

    cmd = [
        "ffuf",
        "-u", fuzz_url,
        "-w", wordlist,
        "-mc", "200,204,301,302,307,401,403,405",
        "-t", "40",
        "-timeout", "10",
        "-of", "json",
    ]
    return _run(cmd, "ffuf", timeout=600)


def _write_builtin_wordlist() -> str:
    """Write a minimal built-in wordlist to a temp file and return its path."""
    words = [
        "admin", "login", "dashboard", "api", "api/v1", "api/v2",
        "config", "backup", ".env", ".git", "robots.txt", "sitemap.xml",
        "wp-admin", "phpmyadmin", "console", "actuator", "health",
        "metrics", "debug", "test", "upload", "uploads", "static",
        "assets", "js", "css", "img", "images", "files", "docs",
        "swagger", "swagger-ui", "openapi.json", "graphql",
    ]
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, prefix="sudarshan_wordlist_"
    )
    tmp.write("\n".join(words))
    tmp.close()
    return tmp.name


# ---------------------------------------------------------------------------
# sqlmap — SQL injection testing (opt-in, intrusive)
# ---------------------------------------------------------------------------

def run_sqlmap(target: str) -> str:
    """
    Run sqlmap against *target*.
    Only called when --enable-sqlmap is explicitly passed by the user.
    """
    if not _tool_available("sqlmap"):
        return "[NOT INSTALLED] sqlmap — pip install sqlmap"

    cmd = [
        "sqlmap",
        "-u", target,
        "--batch",           # non-interactive
        "--level", "2",
        "--risk", "1",
        "--output-dir", "reports/sqlmap",
        "--forms",
        "--crawl", "2",
        "--timeout", "30",
    ]
    return _run(cmd, "sqlmap", timeout=900)


# ---------------------------------------------------------------------------
# Public entry point called by main.py
# ---------------------------------------------------------------------------

def run_web_scan(
    target: str,
    mode: str,
    nuclei_severity: str = "low,medium,high,critical",
    wordlist: str = "/usr/share/wordlists/dirb/common.txt",
    enable_sqlmap: bool = False,
) -> dict:
    """
    Run the full Phase 2 web scan suite.

    Returns:
        {
            "nuclei":  <str>,
            "ffuf":    <str>,
            "sqlmap":  <str>,   # empty string if not enabled
        }
    Codebase mode skips all web scans.
    """
    results: dict = {}

    if mode == "codebase":
        console.print("[yellow]  Codebase mode — skipping web scans.[/yellow]")
        results["nuclei"] = "N/A (codebase mode)"
        results["ffuf"] = "N/A (codebase mode)"
        results["sqlmap"] = "N/A (codebase mode)"
        return results

    console.print("\n[bold green][WEB SCAN] nuclei[/bold green]")
    results["nuclei"] = run_nuclei(target, severity=nuclei_severity)

    console.print("\n[bold green][WEB SCAN] ffuf[/bold green]")
    results["ffuf"] = run_ffuf(target, wordlist=wordlist)

    if enable_sqlmap:
        console.print("\n[bold green][WEB SCAN] sqlmap (intrusive — opt-in)[/bold green]")
        results["sqlmap"] = run_sqlmap(target)
    else:
        results["sqlmap"] = "Skipped (pass --enable-sqlmap to enable)."

    return results
